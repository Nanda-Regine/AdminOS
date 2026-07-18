import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'
import { fireBusinessEvent } from '@/lib/academy/knowledgeGraph'

const createSchema = z.object({
  contactId:    z.string().uuid().optional(),
  title:        z.string().min(1).max(500),
  contractType: z.string().max(100).optional(),
  content:      z.record(z.string(), z.unknown()).default({}),
  value:        z.number().nonnegative().optional(),
  startDate:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  autoRenew:    z.boolean().default(false),
  signers:      z.array(z.object({
    name:  z.string().min(1),
    email: z.string().email().optional(),
    role:  z.string().optional(),
  })).default([]),
})

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.app_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  const url    = new URL(request.url)
  const status = url.searchParams.get('status')
  const expiringSoon = url.searchParams.get('expiringSoon') === 'true'

  let query = supabaseAdmin
    .from('contracts')
    .select('*, contact:contacts(name:full_name, email), signatures:contract_signatures(*)')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)
  if (expiringSoon) {
    const in30Days = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
    const today    = new Date().toISOString().split('T')[0]
    query = query.gte('end_date', today).lte('end_date', in30Days)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.app_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  let body: z.infer<typeof createSchema>
  try { body = createSchema.parse(await request.json()) } catch (e) {
    return NextResponse.json({ error: 'Invalid request', detail: e }, { status: 400 })
  }

  // Coaching card check: flag contract without expiry date
  const contractWarnings: string[] = []
  if (!body.endDate && !body.autoRenew) {
    contractWarnings.push('contract_no_expiry')
  }

  const { data: contract, error } = await supabaseAdmin
    .from('contracts')
    .insert({
      tenant_id:     tenantId,
      contact_id:    body.contactId    ?? null,
      title:         body.title,
      contract_type: body.contractType ?? null,
      content:       body.content,
      value:         body.value        ?? null,
      start_date:    body.startDate    ?? null,
      end_date:      body.endDate      ?? null,
      auto_renew:    body.autoRenew,
      status:        body.signers.length > 0 ? 'sent' : 'draft',
      created_by:    user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Create a signature invite per signer. `token` auto-generates (DB default);
  // return the created rows so the caller can build each signing link
  // (/contracts/<id>/sign?token=<token>).
  let signatures: { id: string; signer_name: string; signer_email: string | null; token: string }[] = []
  if (body.signers.length > 0) {
    const expiresAt = new Date(Date.now() + 30 * 86400000).toISOString()
    const { data: sigRows } = await supabaseAdmin
      .from('contract_signatures')
      .insert(body.signers.map(s => ({
        contract_id:  contract.id,
        signer_name:  s.name,
        signer_email: s.email  ?? null,
        signer_role:  s.role   ?? null,
        expires_at:   expiresAt,
      })))
      .select('id, signer_name, signer_email, token')
    signatures = sigRows ?? []
  }

  // Update formalization progress: first contract
  await supabaseAdmin
    .from('formalization_progress')
    .update({ first_contract_signed: true })
    .eq('tenant_id', tenantId)
    .eq('first_contract_signed', false)

  fireBusinessEvent('contract.created', tenantId, user.id)

  return NextResponse.json({ contract, signatures, warnings: contractWarnings }, { status: 201 })
}
