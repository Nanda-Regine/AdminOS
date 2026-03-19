import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import {
  classifyDocument,
  extractGoalsFromDoc,
  callClaudeAgent,
} from '@/lib/ai/callClaude'
import { writeAuditLog } from '@/lib/security/audit'

interface FileReceivedPayload {
  tenantId: string
  fileType: string
  extractedText: string
  originalPath: string
  filename: string
  n8nSecret?: string
}

export async function POST(request: Request) {
  // Verify n8n secret
  const authHeader = request.headers.get('x-n8n-secret')
  if (authHeader !== process.env.N8N_WEBHOOK_SECRET) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  let payload: FileReceivedPayload
  try {
    payload = await request.json()
  } catch {
    return new NextResponse('Bad Request', { status: 400 })
  }

  const { tenantId, fileType, extractedText, originalPath, filename } = payload

  // Classify document
  const classification = await classifyDocument(extractedText)

  let docCategory = classification.category
  let extractedGoals = null
  let aiSummary = ''

  switch (classification.category) {
    case 'strategy': {
      const goals = await extractGoalsFromDoc(extractedText)
      extractedGoals = goals

      // Upsert goals
      for (const goal of goals) {
        await supabaseAdmin.from('goals').insert({
          tenant_id: tenantId,
          title: goal.title,
          description: goal.description,
          quarter: goal.quarter,
          target_metric: goal.target_metric,
          target_value: goal.target_value,
          current_value: 0,
          status: 'active',
        })
      }

      aiSummary = await callClaudeAgent(
        'Summarise this strategy document in 3 sentences.',
        extractedText.slice(0, 3000),
        200
      )

      // Notify manager
      await supabaseAdmin.from('audit_log').insert({
        tenant_id: tenantId,
        actor: 'system',
        action: 'document.strategy_processed',
        metadata: { filename, goalsExtracted: goals.length },
      })
      break
    }

    case 'invoice': {
      const invoiceJson = await callClaudeAgent(
        'Extract invoice data as JSON: {"contact_name":"...","contact_email":"...","contact_phone":"...","amount":0,"due_date":"YYYY-MM-DD"}',
        extractedText.slice(0, 2000),
        200
      )
      try {
        const inv = JSON.parse(invoiceJson)
        await supabaseAdmin.from('invoices').insert({
          tenant_id: tenantId,
          ...inv,
          status: 'unpaid',
        })
      } catch {
        console.error('[File Pipeline] Failed to parse invoice JSON')
      }
      break
    }

    case 'hr': {
      aiSummary = await callClaudeAgent(
        'Summarise this HR document in 2 sentences.',
        extractedText.slice(0, 2000),
        150
      )
      break
    }

    case 'report': {
      aiSummary = await callClaudeAgent(
        'Summarise this report in 3 bullet points for a manager. Be concise and actionable.',
        extractedText.slice(0, 3000),
        300
      )
      break
    }
  }

  // Store document record
  await supabaseAdmin.from('documents').insert({
    tenant_id: tenantId,
    original_filename: filename,
    file_type: fileType,
    storage_url: originalPath,
    extracted_text: extractedText.slice(0, 10000),
    doc_category: docCategory,
    ai_summary: aiSummary,
    extracted_goals: extractedGoals,
    processing_status: 'done',
  })

  await writeAuditLog({
    tenantId,
    actor: 'system',
    action: 'document.processed',
    resourceType: 'document',
    metadata: { filename, category: docCategory, confidence: classification.confidence },
  })

  return NextResponse.json({ success: true, category: docCategory })
}
