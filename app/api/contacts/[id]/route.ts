import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { writeAuditLog } from '@/lib/security/audit'
import { z } from 'zod'
import { guard } from '@/lib/api/guard'
import { runSequenceTrigger } from '@/lib/reach/sequences'
import { recordOptOut } from '@/lib/reach/audience'

interface Params { params: Promise<{ id: string }> }

const patchSchema = z.object({
  full_name:    z.string().min(1).max(200).optional(),
  phone:        z.string().max(30).nullable().optional(),
  email:        z.string().email().nullable().optional(),
  company:      z.string().max(200).nullable().optional(),
  contact_type: z.enum(['client', 'supplier', 'staff', 'unknown']).optional(),
  notes:        z.string().max(2000).nullable().optional(),
  tags:         z.array(z.string()).optional(),
  source:       z.string().max(100).nullable().optional(),
  // POPIA s69 — consent to marketing, and an objection to it (STOP).
  popia_consent:    z.boolean().optional(),
  marketing_opt_out: z.boolean().optional(),
})

export async function GET(_req: Request, { params }: Params) {
  const gate = await guard('contacts.read'); if (gate.denied) return gate.denied
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.app_metadata?.tenant_id as string

  const [contactRes, conversationsRes, invoicesRes] = await Promise.all([
    supabaseAdmin
      .from('contacts')
      .select('*').is('deleted_at', null)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single(),
    supabaseAdmin
      .from('conversations')
      .select('id, intent, sentiment, status, channel, summary, created_at, updated_at')
      .eq('tenant_id', tenantId)
      .eq('contact_id', id)
      .order('updated_at', { ascending: false })
      .limit(20),
    supabaseAdmin
      .from('invoices')
      .select('id, invoice_number, amount, amount_paid, status, due_date, created_at, contact_id, contact_phone').is('deleted_at', null)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  if (contactRes.error || !contactRes.data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const contact = contactRes.data

  // Also fetch convs matched by contact_identifier (phone) for legacy records
  const { data: legacyConvs } = await supabaseAdmin
    .from('conversations')
    .select('id, intent, sentiment, status, channel, summary, created_at, updated_at')
    .eq('tenant_id', tenantId)
    .eq('contact_identifier', contact.phone ?? '')
    .order('updated_at', { ascending: false })
    .limit(20)

  // Merge and deduplicate by id
  const allConvs = [...(conversationsRes.data ?? []), ...(legacyConvs ?? [])]
  const seenIds  = new Set<string>()
  const conversations = allConvs.filter(c => {
    if (seenIds.has(c.id)) return false
    seenIds.add(c.id)
    return true
  })

  // Match invoices by contact_id (primary) or contact_phone fallback for legacy records
  const invoices = (invoicesRes.data ?? []).filter(
    (inv: Record<string, unknown>) =>
      (inv.contact_id as string) === id ||
      ((inv.contact_phone as string) && (inv.contact_phone as string) === contact.phone)
  )

  return NextResponse.json({ contact, conversations, invoices })
}

export async function PATCH(request: Request, { params }: Params) {
  const gate = await guard('contacts.write'); if (gate.denied) return gate.denied
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.app_metadata?.tenant_id as string

  let body: z.infer<typeof patchSchema>
  try {
    body = patchSchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { data: before } = await supabaseAdmin
    .from('contacts').select('contact_type').eq('id', id).eq('tenant_id', tenantId).is('deleted_at', null).maybeSingle()
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { popia_consent, marketing_opt_out, ...fields } = body
  const now = new Date().toISOString()
  const update: Record<string, unknown> = { ...fields, updated_at: now }
  if (popia_consent !== undefined) {
    update.popia_consent = popia_consent
    update.popia_consent_at = popia_consent ? now : null
  }
  if (marketing_opt_out !== undefined) update.marketing_opt_out_at = marketing_opt_out ? now : null

  const { data, error } = await supabaseAdmin
    .from('contacts')
    .update(update)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found or update failed' }, { status: 404 })

  await writeAuditLog({
    tenantId,
    actor:        user.id,
    action:       'contact.updated',
    resourceType: 'contact',
    resourceId:   id,
    metadata:     { fields: Object.keys(body) },
  })

  if (marketing_opt_out) await recordOptOut(tenantId, data.phone ?? '').catch(() => 0)
  if (fields.contact_type === 'client' && before.contact_type !== 'client') {
    await runSequenceTrigger(tenantId, 'new_client', data.phone)
  }

  return NextResponse.json({ contact: data })
}

export async function DELETE(_req: Request, { params }: Params) {
  const gate = await guard('contacts.write'); if (gate.denied) return gate.denied
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.app_metadata?.tenant_id as string

  // Soft delete (Rule #3). It was a hard delete that also orphaned the
  // contact's invoices, bookings and conversations.
  const { data: gone, error } = await supabaseAdmin
    .from('contacts')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .select('id')

  if (error) return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  if (!gone?.length) return NextResponse.json({ error: 'Contact not found' }, { status: 404 })

  await writeAuditLog({
    tenantId,
    actor:        user.id,
    action:       'contact.deleted',
    resourceType: 'contact',
    resourceId:   id,
    metadata:     {},
  })

  return new NextResponse(null, { status: 204 })
}
