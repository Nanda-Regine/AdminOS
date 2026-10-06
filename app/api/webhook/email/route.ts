import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { callClaudeWithCache } from '@/lib/ai/callClaude'
import { writeAuditLog } from '@/lib/security/audit'
import { notifyTenant } from '@/lib/notifications/notify'
import { sastDate } from '@/lib/time/sast'

interface EmailPayload {
  from: string
  to: string
  subject: string
  text: string
  html?: string
  tenantId?: string
}

export async function POST(request: Request) {
  // Inbound email must arrive via the trusted Mirembe hub / email forwarder,
  // authenticated with the shared secret (same gate as the Paystack receiver).
  // Without this the endpoint was fully unauthenticated: anyone could POST a
  // forged email for any tenant_id and trigger a paid AI call + inject messages
  // into that tenant's inbox. Fails closed if HUB_INTERNAL_SECRET is unset.
  const hubSecret = process.env.HUB_INTERNAL_SECRET
  if (!hubSecret || request.headers.get('x-hub-secret') !== hubSecret) {
    return new NextResponse('Forbidden', { status: 403 })
  }

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
  // Over the daily AI budget, callClaudeWithCache returns OWNER-facing text
  // ("upgrade your plan…") — never email that to a customer. Hold the reply
  // (the hub sends nothing when response is null) and alert the owner.
  const replyText = aiResult.budgetExceeded ? null : aiResult.text
  if (aiResult.budgetExceeded) {
    await notifyTenant(tenant.id, {
      type: 'ai_budget_reached',
      title: 'AI replies paused for today',
      body: `An email from ${payload.from} is waiting for a human reply — today's AI limit was reached.`,
      actionUrl: '/dashboard/inbox',
      dedupeKey: `ai-budget-${sastDate()}`,
    })
  }

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
      ...(replyText ? [{
        tenant_id: tenant.id,
        conversation_id: conv.id,
        role: 'assistant',
        content: replyText,
        channel: 'email',
        tokens_used: aiResult.tokens,
        from_cache: aiResult.fromCache,
      }] : []),
    ])
  }

  await writeAuditLog({
    tenantId: tenant.id,
    actor: 'ai_agent',
    action: 'email.inbound.processed',
    metadata: { from: payload.from, subject: payload.subject },
  })

  return NextResponse.json({ response: replyText })
}
