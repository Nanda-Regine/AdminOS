import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAddon } from '@/lib/billing/gates'
import { checkRateLimit } from '@/lib/security/rateLimit'
import { randomBytes } from 'crypto'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  try {
    await requireAddon('client_portal')
  } catch {
    return NextResponse.json({ error: 'Client Portal add-on required' }, { status: 402 })
  }

  const tenantId = user.user_metadata?.tenant_id as string

  const { success } = await checkRateLimit('api', `portal:generate:${tenantId}`)
  if (!success) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })

  let contactId: string
  let contactIdentifier: string

  try {
    const body = await request.json() as { contactId?: string; contactIdentifier?: string }
    if (!body.contactId) throw new Error('missing')
    contactId         = body.contactId
    contactIdentifier = body.contactIdentifier ?? body.contactId
  } catch {
    return NextResponse.json({ error: 'contactId required' }, { status: 400 })
  }

  // Verify contact belongs to tenant
  const { data: contact } = await supabaseAdmin
    .from('contacts')
    .select('id, name, email, phone')
    .eq('id', contactId)
    .eq('tenant_id', tenantId)
    .single()

  if (!contact) {
    return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
  }

  // Revoke any existing active tokens for this contact
  await supabaseAdmin
    .from('portal_sessions')
    .update({ revoked_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('contact_identifier', contactIdentifier)
    .is('revoked_at', null)
    .then(() => {}, () => {})

  const token     = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const { error } = await supabaseAdmin
    .from('portal_sessions')
    .insert({
      tenant_id:           tenantId,
      contact_identifier:  contactIdentifier,
      token,
      expires_at:          expiresAt,
    })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://admin-os-six.vercel.app'
  return NextResponse.json({
    token,
    url:        `${baseUrl}/portal/${token}`,
    expires_at: expiresAt,
    contact:    { id: contact.id, name: contact.name, email: contact.email, phone: contact.phone },
  })
}
