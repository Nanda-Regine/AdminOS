import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { writeAuditLog, getClientIp } from '@/lib/security/audit'
import { z } from 'zod'

const bodySchema = z.object({
  identifier: z.string().min(1).max(200),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.user_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('Tenant not found', { status: 403 })

  // Only admin users should be able to delete contact data
  const role = user.user_metadata?.role as string
  if (role !== 'admin' && role !== 'owner' && role !== 'super_admin') {
    return new NextResponse('Forbidden — admin access required', { status: 403 })
  }

  let body: z.infer<typeof bodySchema>
  try {
    const formData = await request.formData()
    body = bodySchema.parse({ identifier: formData.get('identifier') })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const identifier = body.identifier.trim()

  // Find all conversations for this contact (scoped to tenant)
  const { data: conversations } = await supabaseAdmin
    .from('conversations')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('contact_identifier', identifier)

  const conversationIds = (conversations || []).map((c) => c.id)
  let deletedRecords = 0

  // Delete all messages in those conversations
  if (conversationIds.length > 0) {
    const { count } = await supabaseAdmin
      .from('messages')
      .delete({ count: 'exact' })
      .in('conversation_id', conversationIds)
      .eq('tenant_id', tenantId)
    deletedRecords += count || 0

    // Delete the conversations themselves
    const { count: convCount } = await supabaseAdmin
      .from('conversations')
      .delete({ count: 'exact' })
      .in('id', conversationIds)
      .eq('tenant_id', tenantId)
    deletedRecords += convCount || 0
  }

  // Delete wellness data from staff records if phone matches
  const { data: matchedStaff } = await supabaseAdmin
    .from('staff')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('phone', identifier)

  if (matchedStaff?.length) {
    await supabaseAdmin
      .from('staff')
      .update({ wellness_scores: [], phone: null, email: null })
      .in('id', matchedStaff.map((s) => s.id))
    deletedRecords += matchedStaff.length
  }

  // NOTE: Invoice records are NOT deleted — required by SARS for 5 years (legal obligation)

  await writeAuditLog({
    tenantId,
    actor:    user.id,
    action:   'compliance.contact_data_deleted',
    metadata: {
      identifier,
      deletedRecords,
      reason:    'Data subject erasure request under POPI Act §24',
      requestedBy: user.email,
    },
    ipAddress: getClientIp(request),
  })

  // Redirect back to compliance page with success indicator
  return NextResponse.redirect(
    new URL('/dashboard/settings/compliance?deleted=true', request.url)
  )
}
