import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { writeAuditLog } from '@/lib/security/audit'
import { z } from 'zod'

export const runtime = 'nodejs'

const mergeSchema = z.object({
  // keepId is the contact whose record survives; mergeIds are absorbed and deleted
  keepId:   z.string().uuid(),
  mergeIds: z.array(z.string().uuid()).min(1).max(10),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.user_metadata?.tenant_id as string

  let body: z.infer<typeof mergeSchema>
  try {
    body = mergeSchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { keepId, mergeIds } = body
  const allIds = [keepId, ...mergeIds]

  // Verify all contacts belong to this tenant
  const { data: contacts, error: fetchErr } = await supabaseAdmin
    .from('contacts')
    .select('id, balance_owed, total_invoiced, total_paid, lifetime_value, tags')
    .in('id', allIds)
    .eq('tenant_id', tenantId)

  if (fetchErr || !contacts || contacts.length !== allIds.length) {
    return NextResponse.json({ error: 'One or more contacts not found' }, { status: 404 })
  }

  const keeper = contacts.find(c => c.id === keepId)
  if (!keeper) return NextResponse.json({ error: 'Keep contact not found' }, { status: 404 })

  // Aggregate numeric fields across all merging contacts
  const totalBalance      = contacts.reduce((s, c) => s + Number(c.balance_owed   || 0), 0)
  const totalInvoiced     = contacts.reduce((s, c) => s + Number(c.total_invoiced || 0), 0)
  const totalPaid         = contacts.reduce((s, c) => s + Number(c.total_paid     || 0), 0)
  const totalLifetimeVal  = contacts.reduce((s, c) => s + Number(c.lifetime_value || 0), 0)

  // Merge tags (unique)
  const mergedTags = [...new Set(contacts.flatMap(c => (c.tags as string[]) ?? []))]

  // Reassign conversations, invoices, call_logs to the keeper
  await Promise.all([
    supabaseAdmin
      .from('conversations')
      .update({ contact_id: keepId })
      .in('contact_id', mergeIds)
      .eq('tenant_id', tenantId),
    supabaseAdmin
      .from('invoices')
      .update({ contact_id: keepId })
      .in('contact_id', mergeIds)
      .eq('tenant_id', tenantId),
    supabaseAdmin
      .from('call_logs')
      .update({ contact_id: keepId })
      .in('contact_id', mergeIds)
      .eq('tenant_id', tenantId),
  ])

  // Update keeper with merged totals + tags
  const { error: updateErr } = await supabaseAdmin
    .from('contacts')
    .update({
      balance_owed:   totalBalance,
      total_invoiced: totalInvoiced,
      total_paid:     totalPaid,
      lifetime_value: totalLifetimeVal,
      tags:           mergedTags,
      updated_at:     new Date().toISOString(),
    })
    .eq('id', keepId)
    .eq('tenant_id', tenantId)

  if (updateErr) {
    return NextResponse.json({ error: 'Failed to update primary contact' }, { status: 500 })
  }

  // Soft-delete merged contacts (set deleted_at — hard delete only if no FK issues)
  // Since contacts have no deleted_at column we do a hard delete of the absorbed records
  const { error: deleteErr } = await supabaseAdmin
    .from('contacts')
    .delete()
    .in('id', mergeIds)
    .eq('tenant_id', tenantId)

  if (deleteErr) {
    return NextResponse.json({ error: 'Failed to remove duplicate contacts' }, { status: 500 })
  }

  await writeAuditLog({
    tenantId,
    actor:        user.id,
    action:       'contact.merged',
    resourceType: 'contact',
    resourceId:   keepId,
    metadata:     { mergedIds: mergeIds, mergedCount: mergeIds.length },
  })

  return NextResponse.json({ success: true, contactId: keepId })
}
