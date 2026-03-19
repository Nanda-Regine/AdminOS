import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { parseFile, detectFileType, isImageType, isMediaType, getAllowedExtensions } from '@/lib/files/parser'
import { classifyDocument, extractGoalsFromDoc, callClaudeAgent } from '@/lib/ai/callClaude'
import { writeAuditLog, getClientIp } from '@/lib/security/audit'
import { checkRateLimit } from '@/lib/security/rateLimit'

export const runtime = 'nodejs'
export const maxDuration = 60 // file parsing can be slow for large docs

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.user_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('Tenant not found', { status: 403 })

  // Rate limit uploads
  const { success } = await checkRateLimit('api', tenantId)
  if (!success) return new NextResponse('Too Many Requests', { status: 429 })

  // Parse multipart form
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  // Size check
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'File too large. Maximum size is 50MB.' }, { status: 413 })
  }

  // File type detection
  const fileType = detectFileType(file.name, file.type)
  if (!fileType) {
    return NextResponse.json({
      error: `Unsupported file type. Supported: ${getAllowedExtensions().join(', ')}`,
    }, { status: 415 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  // ── 1. Upload to Supabase Storage (private bucket, encrypted at rest) ────────
  const storagePath = `${tenantId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`

  const { error: uploadError } = await supabaseAdmin.storage
    .from('documents')
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) {
    console.error('[Upload] Storage error:', uploadError)
    return NextResponse.json({ error: 'Failed to store file' }, { status: 500 })
  }

  // ── 2. Create pending document record immediately (user sees it straight away) ─
  const { data: docRecord, error: insertErr } = await supabaseAdmin
    .from('documents')
    .insert({
      tenant_id: tenantId,
      original_filename: file.name,
      file_type: fileType,
      storage_url: storagePath,
      processing_status: 'processing',
      uploaded_by: user.id,
    })
    .select('id')
    .single()

  if (insertErr || !docRecord) {
    return NextResponse.json({ error: 'Failed to create document record' }, { status: 500 })
  }

  // ── 3. Parse the file (async — don't block the response for large files) ──────
  // For files under 5MB, process synchronously for instant feedback.
  // For larger files, return immediately and process in background.
  const processSynchronously = file.size < 5 * 1024 * 1024

  if (processSynchronously) {
    await processDocument(docRecord.id, tenantId, buffer, fileType, file.type, file.name, user.id)
    const { data: updatedDoc } = await supabaseAdmin
      .from('documents')
      .select('*')
      .eq('id', docRecord.id)
      .single()
    return NextResponse.json({ success: true, document: updatedDoc })
  }

  // Large file — process in background, return the pending record
  processDocument(docRecord.id, tenantId, buffer, fileType, file.type, file.name, user.id)
    .catch((err) => console.error('[Upload] Background processing failed:', err))

  await writeAuditLog({
    tenantId,
    actor: user.id,
    action: 'document.upload.queued',
    resourceType: 'document',
    resourceId: docRecord.id,
    ipAddress: getClientIp(request),
    metadata: { filename: file.name, fileType, size: file.size },
  })

  return NextResponse.json({ success: true, document: { id: docRecord.id, processing_status: 'processing' } })
}

async function processDocument(
  docId: string,
  tenantId: string,
  buffer: Buffer,
  fileType: ReturnType<typeof detectFileType>,
  mimeType: string,
  filename: string,
  userId: string
) {
  try {
    // ── Parse ──────────────────────────────────────────────────────────────────
    const parsed = await parseFile(buffer, fileType!, mimeType)

    if (parsed.needsTranscription) {
      // Audio/video — mark for manual transcription or future Whisper integration
      await supabaseAdmin.from('documents').update({
        file_type: fileType,
        extracted_text: null,
        ai_summary: 'Audio/video transcription coming soon. File stored securely.',
        processing_status: 'done',
        doc_category: 'report',
      }).eq('id', docId)
      return
    }

    if (isImageType(fileType!)) {
      // Use Claude vision to describe and classify the image
      const imageB64 = buffer.toString('base64')
      const vision = await callClaudeWithVision(imageB64, mimeType, filename)
      await supabaseAdmin.from('documents').update({
        file_type: fileType,
        extracted_text: vision.description,
        ai_summary: vision.summary,
        doc_category: vision.category,
        processing_status: 'done',
      }).eq('id', docId)
      return
    }

    const extractedText = parsed.text
    if (!extractedText.trim()) {
      await supabaseAdmin.from('documents').update({
        processing_status: 'failed',
        ai_summary: 'Could not extract text from this file. It may be image-based (scanned PDF) or corrupted.',
      }).eq('id', docId)
      return
    }

    // ── Classify ──────────────────────────────────────────────────────────────
    const classification = await classifyDocument(extractedText)
    let aiSummary = ''
    let extractedGoals = null

    // ── Route by category ─────────────────────────────────────────────────────
    switch (classification.category) {
      case 'strategy': {
        const goals = await extractGoalsFromDoc(extractedText)
        extractedGoals = goals
        if (goals.length > 0) {
          await supabaseAdmin.from('goals').insert(
            goals.map((g) => ({
              tenant_id: tenantId,
              title: g.title,
              description: g.description,
              quarter: g.quarter || null,
              target_metric: g.target_metric || null,
              target_value: g.target_value || null,
              current_value: 0,
              status: 'active',
            }))
          )
        }
        aiSummary = await callClaudeAgent(
          'Summarise this strategy document in 3 clear sentences for a business manager.',
          extractedText.slice(0, 4000),
          200
        )
        break
      }

      case 'invoice': {
        const invoiceRaw = await callClaudeAgent(
          'Extract invoice data as strict JSON with ONLY these fields: {"contact_name":"string","contact_email":"string or null","contact_phone":"string or null","amount":number,"due_date":"YYYY-MM-DD or null"}. No other fields.',
          extractedText.slice(0, 2000),
          200
        )
        try {
          const jsonMatch = invoiceRaw.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            const inv = JSON.parse(jsonMatch[0])
            const dueDate   = inv.due_date ? String(inv.due_date) : null
            const daysOverdue = dueDate
              ? Math.max(0, Math.floor((Date.now() - new Date(dueDate).getTime()) / 86_400_000))
              : 0
            // Whitelist only safe fields
            const safeInvoice = {
              tenant_id:      tenantId,
              contact_name:   String(inv.contact_name || 'Unknown'),
              contact_email:  inv.contact_email  ? String(inv.contact_email)  : null,
              contact_phone:  inv.contact_phone  ? String(inv.contact_phone)  : null,
              amount:         Math.abs(Number(inv.amount) || 0),
              amount_paid:    0,
              due_date:       dueDate,
              days_overdue:   daysOverdue,
              status:         'unpaid' as const,
              escalation_level: 0,
            }
            if (safeInvoice.contact_name !== 'Unknown' && safeInvoice.amount > 0) {
              await supabaseAdmin.from('invoices').insert(safeInvoice)
            }
          }
        } catch {
          console.error('[Upload] Invoice parse failed for doc:', docId)
        }
        aiSummary = await callClaudeAgent(
          'Summarise this invoice in one sentence (who owes what, how much, when due).',
          extractedText.slice(0, 1000),
          100
        )
        break
      }

      case 'hr': {
        aiSummary = await callClaudeAgent(
          'Summarise this HR document in 2 sentences for a manager.',
          extractedText.slice(0, 3000),
          150
        )
        break
      }

      case 'report': {
        aiSummary = await callClaudeAgent(
          'Summarise this report in 3 bullet points. Be concise and action-oriented for a business manager.',
          extractedText.slice(0, 4000),
          300
        )
        break
      }

      case 'contract': {
        // Extract structured contract data — parties, dates, obligations
        const contractRaw = await callClaudeAgent(
          'Extract contract data as strict JSON with ONLY these fields: {"parties":["string"],"start_date":"YYYY-MM-DD or null","end_date":"YYYY-MM-DD or null","renewal_date":"YYYY-MM-DD or null","payment_amount":number or null,"key_obligations":["string"]}. No other fields.',
          extractedText.slice(0, 4000),
          400
        )
        try {
          const jsonMatch = contractRaw.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            const contractData = JSON.parse(jsonMatch[0])
            extractedGoals = contractData // store structured data in the JSONB field

            // If there's a renewal date, note it prominently in the summary
            if (contractData.renewal_date) {
              const renewalDate = new Date(contractData.renewal_date)
              const daysUntilRenewal = Math.floor((renewalDate.getTime() - Date.now()) / 86_400_000)
              const urgencyNote = daysUntilRenewal < 30 ? ` ⚠️ RENEWAL IN ${daysUntilRenewal} DAYS` : ` (renewal in ${daysUntilRenewal} days)`
              aiSummary = `Contract between ${(contractData.parties || []).join(' and ')}. Renewal: ${contractData.renewal_date}${urgencyNote}. Key obligations: ${(contractData.key_obligations || []).slice(0, 2).join('; ')}.`
            }
          }
        } catch {
          console.error('[Upload] Contract parse failed for doc:', docId)
        }
        if (!aiSummary) {
          aiSummary = await callClaudeAgent(
            'Summarise the key terms of this contract in 3 bullet points: parties involved, main obligations, key dates or amounts.',
            extractedText.slice(0, 4000),
            300
          )
        }
        break
      }
    }

    // ── Save final result ──────────────────────────────────────────────────────
    await supabaseAdmin.from('documents').update({
      file_type: fileType,
      extracted_text: extractedText.slice(0, 80_000),
      doc_category: classification.category,
      ai_summary: aiSummary,
      extracted_goals: extractedGoals,
      processing_status: 'done',
    }).eq('id', docId)

    await writeAuditLog({
      tenantId,
      actor: userId,
      action: 'document.processed',
      resourceType: 'document',
      resourceId: docId,
      metadata: {
        filename,
        category: classification.category,
        confidence: classification.confidence,
        goalsExtracted: Array.isArray(extractedGoals) ? extractedGoals.length : 0,
      },
    })
  } catch (err) {
    console.error('[Upload] Processing error:', err)
    await supabaseAdmin.from('documents').update({
      processing_status: 'failed',
      ai_summary: 'Processing failed. Please try uploading again.',
    }).eq('id', docId)
  }
}

// Claude vision for image files
async function callClaudeWithVision(
  imageB64: string,
  mimeType: string,
  filename: string
): Promise<{ description: string; summary: string; category: string }> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const validImageMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  const safeMime = validImageMimes.includes(mimeType) ? mimeType : 'image/jpeg'

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: safeMime as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
            data: imageB64,
          },
        },
        {
          type: 'text',
          text: `This image was uploaded to a business document system (filename: ${filename}). Describe what it contains and classify it. Reply as JSON: {"description":"...","summary":"...","category":"strategy|invoice|hr|report|contract"}`,
        },
      ],
    }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    return jsonMatch ? JSON.parse(jsonMatch[0]) : { description: text, summary: text, category: 'report' }
  } catch {
    return { description: text, summary: text, category: 'report' }
  }
}

// Signed URL endpoint for secure file access
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const url = new URL(request.url)
  const storagePath = url.searchParams.get('path')
  if (!storagePath) return NextResponse.json({ error: 'Missing path' }, { status: 400 })

  // Verify the file belongs to this tenant
  const tenantId = user.user_metadata?.tenant_id as string
  if (!storagePath.startsWith(`${tenantId}/`)) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const { data, error } = await supabaseAdmin.storage
    .from('documents')
    .createSignedUrl(storagePath, 3600) // 1-hour expiry

  if (error) return NextResponse.json({ error: 'Could not generate URL' }, { status: 500 })

  return NextResponse.json({ url: data.signedUrl })
}
