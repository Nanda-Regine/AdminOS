import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sendWhatsApp } from '@/lib/whatsapp/send'
import { writeAuditLog, getClientIp } from '@/lib/security/audit'
import { z } from 'zod'

const bodySchema = z.object({
  conversationId: z.string().uuid(),
  message: z.string().min(1).max(4000),
  channel: z.enum(['whatsapp', 'email', 'dashboard']),
  contactIdentifier: z.string().optional(),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.user_metadata?.tenant_id as string

  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // Verify the conversation belongs to this tenant
  const { data: conv } = await supabaseAdmin
    .from('conversations')
    .select('id, channel, contact_identifier, tenant_id')
    .eq('id', body.conversationId)
    .eq('tenant_id', tenantId)
    .single()

  if (!conv) return new NextResponse('Not found', { status: 404 })

  // Send via appropriate channel
  const contact = body.contactIdentifier || conv.contact_identifier
  if (body.channel === 'whatsapp' && contact) {
    await sendWhatsApp({ to: contact, message: body.message })
  }
  // Email channel: would use Resend — implement when email integration active

  // Store the message in DB
  await supabaseAdmin.from('messages').insert({
    tenant_id: tenantId,
    conversation_id: body.conversationId,
    role: 'assistant',
    content: body.message,
    channel: body.channel,
    from_cache: false,
  })

  // Update conversation updated_at
  await supabaseAdmin
    .from('conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', body.conversationId)

  await writeAuditLog({
    tenantId,
    actor: user.id,
    action: 'conversation.manual_reply',
    resourceType: 'conversation',
    resourceId: body.conversationId,
    ipAddress: getClientIp(request),
    metadata: { channel: body.channel, length: body.message.length },
  })

  return NextResponse.json({ success: true })
}
