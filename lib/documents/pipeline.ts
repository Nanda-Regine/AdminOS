/**
 * THE document pipeline — one implementation for every way a document enters
 * AdminOS: dashboard upload (inline for small files), the Inngest
 * `adminos/document.uploaded` job (large files), and the n8n file-received hook.
 *
 * Session 20 found three diverging copies of this logic. Between them:
 *  - every upload was classified twice (inline + Inngest) and paid for twice,
 *    with the two racing to write the same row;
 *  - no call was metered: document AI skipped the tenant budget entirely;
 *  - files ≥5 MB were processed by a promise left running after the response,
 *    which serverless kills — documents stuck on "processing" forever;
 *  - any document the model called an "invoice" was silently inserted as a
 *    RECEIVABLE ('unpaid'), so a supplier's bill uploaded for safekeeping
 *    became money the business was "owed" (cashflow, board pack, chasing);
 *    the n8n copy spread the model's JSON straight into that insert, so a
 *    crafted document could set tenant_id;
 *  - image/text uploads always failed: documents.file_type is an enum
 *    (pdf|docx|xlsx|csv|image|text) and the raw extension was written.
 *
 * Now: invoices are extracted into `extracted_data` and the owner chooses
 * what it is (a bill to pay → expense, or an invoice they issued → AR) from
 * the Documents page. Nothing creates money records behind their back.
 */

import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { parseFile, isImageType, type SupportedFileType } from '@/lib/files/parser'
import { callClaudeAgent, classifyDocument, extractGoalsFromDoc, tenantAI, type TenantAI } from '@/lib/ai/callClaude'
import { checkBudget, recordUsage, getModelForFeature } from '@/lib/ai/costControls'
import { writeAuditLog } from '@/lib/security/audit'

export type DbFileType = 'pdf' | 'docx' | 'xlsx' | 'csv' | 'image' | 'text'

/** Detected extension → the `file_type` enum. Null = not a storable document type. */
export function toDbFileType(ft: SupportedFileType): DbFileType | null {
  switch (ft) {
    case 'pdf': return 'pdf'
    case 'docx': case 'doc': return 'docx'
    case 'xlsx': case 'xls': return 'xlsx'
    case 'csv': return 'csv'
    case 'jpg': case 'jpeg': case 'png': case 'webp': case 'gif': case 'heic': return 'image'
    case 'txt': case 'md': case 'rtf': case 'json': case 'xml': case 'pptx': return 'text'
    default: return null
  }
}

/** Structured invoice data the Documents page turns into a bill or an AR invoice. */
export interface ExtractedInvoice {
  kind: 'invoice'
  counterparty: string | null
  counterparty_email: string | null
  counterparty_phone: string | null
  amount: number | null
  vat_amount: number | null
  invoice_number: string | null
  issue_date: string | null
  due_date: string | null
  /** The model's guess: 'bill' = addressed TO this business; 'issued' = FROM it. */
  direction_guess: 'bill' | 'issued' | 'unknown'
}

interface Ctx {
  docId: string
  tenantId: string
  filename: string
  actor: string
  isReference?: boolean
}

const BUDGET_NOTE = 'Stored safely. The AI summary was skipped because today\'s AI limit was reached — it resets at midnight.'

async function update(docId: string, patch: Record<string, unknown>) {
  const { error } = await supabaseAdmin.from('documents').update(patch).eq('id', docId)
  if (error) throw error
}

function parseJson<T>(raw: string, fallback: T): T {
  const m = raw.match(/[[{][\s\S]*[\]}]/)
  if (!m) return fallback
  try { return JSON.parse(m[0]) as T } catch { return fallback }
}

const isoDate = (v: unknown): string | null => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null
  return Number.isNaN(Date.parse(v)) ? null : v
}
const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.replace(/[^0-9.-]/g, '')) : NaN
  return Number.isFinite(n) ? Math.abs(n) : null
}
const str = (v: unknown, max = 200): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)

/** Parse a stored file and run it through the pipeline. Never throws. */
export async function processDocumentBuffer(ctx: Ctx & { buffer: Buffer; fileType: SupportedFileType; mimeType: string }): Promise<void> {
  try {
    const parsed = await parseFile(ctx.buffer, ctx.fileType, ctx.mimeType)

    if (parsed.needsTranscription) {
      await update(ctx.docId, {
        extracted_text: null,
        ai_summary: 'Audio/video stored securely. Transcription is not available yet.',
        processing_status: 'done',
        doc_category: 'other',
      })
      return
    }

    if (isImageType(ctx.fileType)) {
      await processImage(ctx, ctx.buffer, ctx.mimeType)
      return
    }

    await processDocumentText({ ...ctx, text: parsed.text })
  } catch (err) {
    console.error('[documents/pipeline] failed', ctx.docId, err)
    await update(ctx.docId, { processing_status: 'failed', ai_summary: 'Processing failed. Please try uploading again.' }).catch(() => {})
  }
}

async function processImage(ctx: Ctx, buffer: Buffer, mimeType: string) {
  const ai = await tenantAI(ctx.tenantId)
  const budget = await checkBudget(ai.tenantId, ai.plan, 600)
  if (!budget.allowed) {
    await update(ctx.docId, { processing_status: 'done', doc_category: 'other', ai_summary: BUDGET_NOTE })
    return
  }
  // Claude's image limit is 5 MB; bigger photos are stored without a preview.
  if (buffer.length > 5 * 1024 * 1024) {
    await update(ctx.docId, { processing_status: 'done', doc_category: 'other', ai_summary: 'Image stored. It is too large for an AI description (over 5 MB).' })
    return
  }
  const media = (['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mimeType) ? mimeType : 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
  const model = getModelForFeature('document_analysis', ai.plan)
  const t0 = Date.now()
  const anthropic = new Anthropic()
  const response = await anthropic.messages.create({
    model,
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: media, data: buffer.toString('base64') } },
        { type: 'text', text: 'This image was uploaded to a South African business\'s document system. Describe what it contains and classify it. Reply as JSON only: {"description":"...","summary":"one sentence","category":"strategy|invoice|hr|report|contract|compliance|other"}' },
      ],
    }],
  })
  void recordUsage({
    tenantId: ai.tenantId, plan: ai.plan, feature: 'document_analysis', model,
    tokensIn: response.usage.input_tokens, tokensOut: response.usage.output_tokens, durationMs: Date.now() - t0,
  })
  const text = response.content[0]?.type === 'text' ? response.content[0].text : '{}'
  const v = parseJson<{ description?: string; summary?: string; category?: string }>(text, {})
  const cats = ['strategy', 'invoice', 'hr', 'report', 'contract', 'compliance', 'other']
  await update(ctx.docId, {
    extracted_text: str(v.description, 5000),
    ai_summary: str(v.summary, 1000) ?? 'Image stored.',
    doc_category: cats.includes(v.category ?? '') ? v.category : 'other',
    document_type: cats.includes(v.category ?? '') ? v.category : 'other',
    processing_status: 'done',
  })
}

/** Classify extracted text, route by category, save. Never throws. */
export async function processDocumentText(ctx: Ctx & { text: string; ai?: TenantAI }): Promise<void> {
  try {
    const text = ctx.text ?? ''
    if (!text.trim()) {
      await update(ctx.docId, {
        processing_status: 'failed',
        ai_summary: 'Could not read text from this file. It may be a scanned image saved as PDF — upload a photo instead.',
      })
      return
    }

    const ai = ctx.ai ?? await tenantAI(ctx.tenantId)
    // One gate for the whole document (classify + extract + summary ≈ 1.5k tokens).
    const budget = await checkBudget(ai.tenantId, ai.plan, 1500)
    if (!budget.allowed) {
      await update(ctx.docId, { extracted_text: text.slice(0, 80_000), processing_status: 'done', doc_category: 'other', ai_summary: BUDGET_NOTE })
      return
    }

    const classification = await classifyDocument(text, ai)
    const category = classification.category
    let summary = ''
    let extractedGoals: unknown = null
    let extractedData: Record<string, unknown> | null = null
    const patch: Record<string, unknown> = {}

    switch (category) {
      case 'strategy': {
        const goals = await extractGoalsFromDoc(text, ai)
        extractedGoals = goals
        if (goals.length) {
          // Re-uploading the same plan must not duplicate every goal.
          const { data: existing } = await supabaseAdmin
            .from('goals').select('title').is('deleted_at', null).eq('tenant_id', ctx.tenantId)
          const have = new Set((existing ?? []).map((g) => String(g.title).trim().toLowerCase()))
          const fresh = goals
            .filter((g) => g.title && !have.has(String(g.title).trim().toLowerCase()))
            .map((g) => ({
              tenant_id: ctx.tenantId,
              title: String(g.title).slice(0, 200),
              description: str(g.description, 2000),
              quarter: str(g.quarter, 20),
              target_metric: str(g.target_metric, 200),
              target_value: num(g.target_value),
              current_value: 0,
              status: 'active',
            }))
          if (fresh.length) await supabaseAdmin.from('goals').insert(fresh)
        }
        summary = await callClaudeAgent('Summarise this strategy document in 3 clear sentences for a business manager.', text.slice(0, 4000), 200, { ...ai, feature: 'agent_summarise' })
        break
      }

      case 'invoice': {
        const raw = await callClaudeAgent(
          'Extract this invoice as strict JSON with ONLY these fields: {"from":"business that issued it","to":"business or person it is addressed to","counterparty_email":"string or null","counterparty_phone":"string or null","amount":number (total incl. VAT),"vat_amount":number or null,"invoice_number":"string or null","issue_date":"YYYY-MM-DD or null","due_date":"YYYY-MM-DD or null"}. No other text.',
          text.slice(0, 3000), 300, { ...ai, feature: 'document_extract' },
        )
        const inv = parseJson<Record<string, unknown>>(raw, {})
        const { data: tenant } = await supabaseAdmin.from('tenants').select('name').eq('id', ctx.tenantId).maybeSingle()
        const me = String(tenant?.name ?? '').trim().toLowerCase()
        const from = str(inv.from), to = str(inv.to)
        const direction: ExtractedInvoice['direction_guess'] =
          me && from?.toLowerCase().includes(me) ? 'issued'
          : me && to?.toLowerCase().includes(me) ? 'bill'
          : 'unknown'
        const data: ExtractedInvoice = {
          kind: 'invoice',
          counterparty: direction === 'issued' ? to : from,
          counterparty_email: str(inv.counterparty_email),
          counterparty_phone: str(inv.counterparty_phone, 30),
          amount: num(inv.amount),
          vat_amount: num(inv.vat_amount),
          invoice_number: str(inv.invoice_number, 60),
          issue_date: isoDate(inv.issue_date),
          due_date: isoDate(inv.due_date),
          direction_guess: direction,
        }
        extractedData = data as unknown as Record<string, unknown>
        summary = await callClaudeAgent('Summarise this invoice in one sentence: who issued it to whom, the amount, and when it is due.', text.slice(0, 1500), 120, { ...ai, feature: 'agent_summarise' })
        break
      }

      case 'contract': {
        const raw = await callClaudeAgent(
          'Extract contract data as strict JSON with ONLY these fields: {"parties":["string"],"start_date":"YYYY-MM-DD or null","end_date":"YYYY-MM-DD or null","renewal_date":"YYYY-MM-DD or null","payment_amount":number or null,"key_obligations":["string"]}. No other text.',
          text.slice(0, 4000), 400, { ...ai, feature: 'document_extract' },
        )
        const c = parseJson<Record<string, unknown>>(raw, {})
        const parties = Array.isArray(c.parties) ? c.parties.map((p) => String(p).slice(0, 200)).slice(0, 10) : []
        const obligations = Array.isArray(c.key_obligations) ? c.key_obligations.map((p) => String(p).slice(0, 500)).slice(0, 20) : []
        extractedData = {
          kind: 'contract', parties, key_obligations: obligations,
          start_date: isoDate(c.start_date), end_date: isoDate(c.end_date), renewal_date: isoDate(c.renewal_date),
          payment_amount: num(c.payment_amount),
        }
        patch.key_parties = parties
        patch.key_obligations = obligations
        patch.expiry_date = isoDate(c.end_date) ?? isoDate(c.renewal_date)
        summary = await callClaudeAgent('Summarise the key terms of this contract in 3 bullet points: parties, main obligations, key dates or amounts.', text.slice(0, 4000), 300, { ...ai, feature: 'agent_summarise' })
        break
      }

      case 'hr':
        summary = await callClaudeAgent('Summarise this HR document in 2 sentences for a manager.', text.slice(0, 3000), 150, { ...ai, feature: 'agent_summarise' })
        break

      default:
        summary = await callClaudeAgent('Summarise this document in 3 bullet points. Be concise and action-oriented for a business manager.', text.slice(0, 4000), 300, { ...ai, feature: 'agent_summarise' })
    }

    if (ctx.isReference) await storeReferenceSchema(ctx, ai, category, text)

    await update(ctx.docId, {
      ...patch,
      extracted_text: text.slice(0, 80_000),
      doc_category: category,
      document_type: category,
      ai_summary: summary || 'Document stored.',
      extracted_goals: extractedGoals,
      extracted_data: extractedData,
      processing_status: 'done',
    })

    await writeAuditLog({
      tenantId: ctx.tenantId,
      actor: ctx.actor,
      action: 'document.processed',
      resourceType: 'document',
      resourceId: ctx.docId,
      metadata: { filename: ctx.filename, category, confidence: classification.confidence },
    })
  } catch (err) {
    console.error('[documents/pipeline] failed', ctx.docId, err)
    await update(ctx.docId, { processing_status: 'failed', ai_summary: 'Processing failed. Please try uploading again.' }).catch(() => {})
  }
}

/** Reference documents: keep only the FIELD STRUCTURE (never values) as a template. */
async function storeReferenceSchema(ctx: Ctx, ai: TenantAI, category: string, text: string) {
  const raw = await callClaudeAgent(
    'Extract only the FIELD STRUCTURE (names and types) of this document. Do NOT include any actual values, names, amounts, or personal data. Return JSON: {"fields":[{"name":"...","type":"string|number|date|boolean","description":"..."}]}',
    text.slice(0, 3000), 500, { ...ai, feature: 'document_reference_schema' },
  )
  const fields = parseJson<{ fields?: unknown[] }>(raw, {}).fields ?? []
  await supabaseAdmin.from('document_templates').insert({
    tenant_id: ctx.tenantId,
    document_type: category,
    template_name: `${category}_template`,
    extracted_schema: { fields },
    is_reference: true,
    status: 'complete',
    processed_at: new Date().toISOString(),
  })
}
