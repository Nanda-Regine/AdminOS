import { inngest } from '@/inngest/client'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { writeAuditLog } from '@/lib/security/audit'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export const docIntelligencePipeline = inngest.createFunction(
  { id: 'doc-intelligence-pipeline', retries: 2, timeouts: { finish: '5m' }, triggers: [{ event: 'adminos/document.uploaded' }] },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ event, step }: any) => {
    const { document_id, tenant_id, is_reference } = event.data as {
      document_id: string
      tenant_id: string
      file_type: string
      is_reference: boolean
    }

    const rawText = await step.run('extract-text', async () => {
      const docRes = await supabaseAdmin
        .from('documents')
        .select('storage_path, file_type, file_name')
        .eq('id', document_id)
        .single()

      if (!docRes.data) return ''

      const { data: fileData } = await supabaseAdmin.storage
        .from('tenant-documents')
        .download(docRes.data.storage_path)

      if (!fileData) return ''

      const buffer = Buffer.from(await fileData.arrayBuffer())
      const fileType = docRes.data.file_type ?? ''

      if (fileType.includes('pdf')) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const pdfParse = require('pdf-parse')
        const parsed = await pdfParse(buffer)
        return parsed.text as string
      }

      if (fileType.includes('wordprocessingml') || fileType.includes('docx')) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const mammoth = require('mammoth')
        const result = await mammoth.extractRawText({ buffer })
        return result.value as string
      }

      if (fileType.includes('spreadsheet') || fileType.includes('xlsx') || fileType.includes('csv')) {
        return buffer.toString('utf8').slice(0, 10000)
      }

      return buffer.toString('utf8').slice(0, 10000)
    })

    if (!rawText) {
      await supabaseAdmin.from('documents').update({ status: 'failed' }).eq('id', document_id)
      return { status: 'failed', reason: 'empty_text' }
    }

    const classification = await step.run('classify-document', async () => {
      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: `Classify this document. Return JSON only:
{"type":"invoice|contract|sop|hr|strategy|report|quote|payroll|compliance|other","confidence":0.0,"language":"en","summary":"2 sentence summary","key_dates":[],"key_amounts":[],"key_parties":[]}

Document (first 3000 chars):
${rawText.slice(0, 3000)}`,
        }],
      })

      const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
      const match = text.match(/\{[\s\S]*\}/)
      try {
        return match ? JSON.parse(match[0]) : { type: 'other', confidence: 0.5 }
      } catch {
        return { type: 'other', confidence: 0.5 }
      }
    })

    const extracted = await step.run('extract-structured-data', async () => {
      if (!classification.type || classification.type === 'other') return {}

      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: `Extract structured data from this ${classification.type} document.
Return JSON only with all relevant fields (dates, amounts, parties, terms, obligations, etc).
Document: ${rawText.slice(0, 5000)}`,
        }],
      })

      const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
      const match = text.match(/\{[\s\S]*\}/)
      try {
        return match ? JSON.parse(match[0]) : {}
      } catch {
        return {}
      }
    })

    // For contracts: extract expiry date and update document
    if (classification.type === 'contract' && extracted.end_date) {
      await step.run('update-contract-expiry', async () => {
        const expiryDate = new Date(extracted.end_date as string)
        if (!isNaN(expiryDate.getTime())) {
          await supabaseAdmin.from('documents').update({
            expiry_date: expiryDate.toISOString().split('T')[0],
            key_parties: (extracted.parties as string[]) ?? [],
            key_obligations: (extracted.obligations as string[]) ?? [],
          }).eq('id', document_id)
        }
      })
    }

    // For invoices: create/update invoice record
    if (classification.type === 'invoice' && extracted.amount) {
      await step.run('sync-invoice', async () => {
        await supabaseAdmin.from('invoices').upsert({
          tenant_id,
          contact_name: extracted.client_name ?? 'Unknown',
          amount: parseFloat(String(extracted.amount).replace(/[^0-9.]/g, '')) || 0,
          due_date: extracted.due_date,
          reference: extracted.invoice_number ?? `DOC-${document_id.slice(0, 8)}`,
          status: 'unpaid',
          days_overdue: 0,
        })
      })
    }

    if (is_reference) {
      await step.run('store-reference-schema', async () => {
        const response = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 500,
          messages: [{
            role: 'user',
            content: `Extract only the FIELD STRUCTURE (names and types) of this document. Do NOT include any actual values, names, amounts, or personal data. Return JSON: {"fields":[{"name":"...","type":"string|number|date|boolean","description":"..."}]}
Document: ${rawText.slice(0, 3000)}`,
          }],
        })

        const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
        const match = text.match(/\{[\s\S]*\}/)
        const schema = match ? JSON.parse(match[0]).fields ?? [] : []

        await supabaseAdmin.from('document_templates').upsert({
          tenant_id,
          document_type: classification.type ?? 'other',
          template_name: `${classification.type}_template`,
          extracted_schema: { fields: schema },
          is_reference: true,
          status: 'complete',
          processed_at: new Date().toISOString(),
        })
      })
    }

    const summary = await step.run('generate-summary', async () => {
      return classification.summary ?? 'Document processed successfully.'
    })

    await step.run('mark-complete', async () => {
      await supabaseAdmin.from('documents').update({
        status: 'done',
        document_type: classification.type,
        ai_summary: summary,
        extracted_data: extracted,
        processed_at: new Date().toISOString(),
      }).eq('id', document_id)
    })

    await writeAuditLog({
      tenantId: tenant_id,
      actor: 'doc',
      action: 'document_processed',
      resourceType: 'document',
      resourceId: document_id,
      metadata: { type: classification.type, confidence: classification.confidence },
    })

    return { status: 'complete', document_id, type: classification.type }
  }
)
