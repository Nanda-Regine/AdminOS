import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAddon } from '@/lib/billing/gates'
import { checkRateLimit } from '@/lib/security/rateLimit'
import { randomBytes } from 'crypto'
import { guard, dbError } from '@/lib/api/guard'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  // The link opens this customer's invoices to whoever holds it: invoice staff only.
  const gate = await guard('invoices.read'); if (gate.denied) return gate.denied
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  try {
    await requireAddon('client_portal')
  } catch {
    return NextResponse.json({ error: 'Client Portal add-on required' }, { status: 402 })
  }

  const tenantId = user.app_metadata?.tenant_id as string

  const { success } = await checkRateLimit('api', `portal:generate:${tenantId}`)
  if (!success) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })

  let contactId: string

  try {
    const body = await request.json() as { contactId?: string }
    if (!body.contactId) throw new Error('missing')
    contactId = body.contactId
  } catch {
    return NextResponse.json({ error: 'contactId required' }, { status: 400 })
  }

  // Verify contact belongs to tenant
  const { data: contact } = await supabaseAdmin
    .from('contacts')
    .select('id, name:full_name, email, phone').is('deleted_at', null)
    .eq('id', contactId)
    .eq('tenant_id', tenantId)
    .single()

  if (!contact) {
    return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
  }

  // Revoke any existing links for this contact by removing them (the table has
  // no revoked_at column — a fresh link supersedes the old one).
  await supabaseAdmin
    .from('portal_sessions')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('contact_id', contactId)
    .then(() => {}, () => {})

  const token     = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const { error } = await supabaseAdmin
    .from('portal_sessions')
    .insert({
      tenant_id:   tenantId,
      contact_id:  contactId,   // NOT NULL — the route wrote a non-existent `contact_identifier` column before
      token,
      expires_at:  expiresAt,
    })

  if (error) return dbError(error)

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://admin-os-six.vercel.app'
  return NextResponse.json({
    token,
    url:        `${baseUrl}/portal/${token}`,
    expires_at: expiresAt,
    contact:    { id: contact.id, name: contact.name, email: contact.email, phone: contact.phone },
  })
}
