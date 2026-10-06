import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { writeAuditLog } from '@/lib/security/audit'
import { z } from 'zod'
import { guard } from '@/lib/api/guard'

export const runtime = 'nodejs'

const mergeSchema = z.object({
  // keepId is the contact whose record survives; mergeIds are absorbed and deleted
  keepId:   z.string().uuid(),
  mergeIds: z.array(z.string().uuid()).min(1).max(10),
})

export async function POST(request: Request) {
  const gate = await guard('contacts.write'); if (gate.denied) return gate.denied
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.app_metadata?.tenant_id as string

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
    .select('id, balance_owed, total_invoiced, total_paid, lifetime_value, tags').is('deleted_at', null)
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

  // Reassign everything that points at a merged contact to the keeper — every
  // FK into contacts. Only 3 of these 12 were moved before, and the hard delete
  // below then cascaded away loyalty points and nulled the link on bookings,
  // tasks, contracts, projects, NPS surveys and creative assets.
  const REFERENCING = [
    'conversations', 'invoices', 'call_logs', 'bookings', 'tasks', 'contracts', 'projects',
    'nps_surveys', 'loyalty_points', 'broadcast_recipients', 'creative_assets', 'portal_sessions',
  ] as const
  const moved = await Promise.all(REFERENCING.map((table) =>
    supabaseAdmin
      .from(table)
      .update({ contact_id: keepId })
      .in('contact_id', mergeIds)
      .eq('tenant_id', tenantId),
  ))
  const failed = REFERENCING.filter((_, i) => moved[i].error)
  if (failed.length) {
    console.error('[contacts/merge] reassign failed', failed, moved.map((m) => m.error?.message).filter(Boolean))
    return NextResponse.json({ error: 'Could not move all records to the kept contact. Nothing was removed; please try again.' }, { status: 500 })
  }

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

  // Soft delete the absorbed contacts (Rule #3; contacts has had deleted_at
  // since the Phase 1 soft-delete migration).
  const { error: deleteErr } = await supabaseAdmin
    .from('contacts')
    .update({ deleted_at: new Date().toISOString() })
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
