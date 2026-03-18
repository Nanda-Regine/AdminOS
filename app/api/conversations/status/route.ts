import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { writeAuditLog, getClientIp } from '@/lib/security/audit'
import { z } from 'zod'

const bodySchema = z.object({
  conversationId: z.string().uuid(),
  status: z.enum(['open', 'auto_resolved', 'escalated', 'closed']),
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

  const { error } = await supabaseAdmin
    .from('conversations')
    .update({
      status: body.status,
      resolved_by: body.status !== 'open' ? user.id : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', body.conversationId)
    .eq('tenant_id', tenantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await writeAuditLog({
    tenantId,
    actor: user.id,
    action: `conversation.status.${body.status}`,
    resourceType: 'conversation',
    resourceId: body.conversationId,
    ipAddress: getClientIp(request),
  })

  return NextResponse.json({ success: true })
}
