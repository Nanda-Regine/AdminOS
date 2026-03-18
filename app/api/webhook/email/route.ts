import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { callClaudeWithCache } from '@/lib/ai/callClaude'
import { writeAuditLog } from '@/lib/security/audit'

interface EmailPayload {
  from: string
  to: string
  subject: string
  text: string
  html?: string
  tenantId?: string
}

export async function POST(request: Request) {
  let payload: EmailPayload

  try {
    payload = await request.json()
  } catch {
    return new NextResponse('Bad Request', { status: 400 })
  }

  // Find tenant by email routing (custom email domain or forwarding setup)
  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('*')
    .eq('id', payload.tenantId || '')
    .eq('active', true)
    .single()

  if (!tenant) {
    return new NextResponse('OK', { status: 200 })
  }

  // Classify and respond
  const aiResult = await callClaudeWithCache(
    tenant,
    `Email from ${payload.from}\nSubject: ${payload.subject}\n\n${payload.text}`,
    []
  )

  // Store conversation
  const { data: conv } = await supabaseAdmin
    .from('conversations')
    .insert({
      tenant_id: tenant.id,
      channel: 'email',
      contact_identifier: payload.from,
      contact_type: 'unknown',
      status: 'open',
    })
    .select('id')
    .single()

  if (conv) {
    await supabaseAdmin.from('messages').insert([
      {
        tenant_id: tenant.id,
        conversation_id: conv.id,
        role: 'user',
        content: `Subject: ${payload.subject}\n\n${payload.text}`,
        channel: 'email',
      },
      {
        tenant_id: tenant.id,
        conversation_id: conv.id,
        role: 'assistant',
        content: aiResult.text,
        channel: 'email',
        tokens_used: aiResult.tokens,
        from_cache: aiResult.fromCache,
      },
    ])
  }

  await writeAuditLog({
    tenantId: tenant.id,
    actor: 'ai_agent',
    action: 'email.inbound.processed',
    metadata: { from: payload.from, subject: payload.subject },
  })

  return NextResponse.json({ response: aiResult.text })
}
