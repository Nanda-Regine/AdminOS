import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'
import { guard, dbError } from '@/lib/api/guard'
import { writeAuditLog, getClientIp } from '@/lib/security/audit'

const updateSchema = z.object({
  title:         z.string().min(1).max(500).optional(),
  contractType:  z.string().max(100).optional(),
  content:       z.record(z.string(), z.unknown()).optional(),
  status:        z.enum(['draft','sent','partially_signed','signed','expired','cancelled']).optional(),
  value:         z.number().nonnegative().optional(),
  startDate:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  autoRenew:     z.boolean().optional(),
})

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await guard('contracts.read'); if (gate.denied) return gate.denied
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.app_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  const { id } = await params

  const { data, error } = await supabaseAdmin
    .from('contracts')
    .select('*, contact:contacts(name:full_name, email, phone), signatures:contract_signatures(*)').is('deleted_at', null)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (error) return dbError(error)
  return NextResponse.json(data)
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await guard('contracts.write'); if (gate.denied) return gate.denied
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.app_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  const { id } = await params

  let body: z.infer<typeof updateSchema>
  try { body = updateSchema.parse(await request.json()) } catch (e) {
    return NextResponse.json({ error: 'Invalid request', detail: e }, { status: 400 })
  }

  // A contract's terms are evidence once anyone has signed: after a signature
  // only its status may move on (expired / cancelled). Before Session 20 the
  // content, value and dates of a SIGNED contract could be rewritten here.
  const { data: current } = await supabaseAdmin
    .from('contracts').select('status').eq('id', id).eq('tenant_id', tenantId).is('deleted_at', null).maybeSingle()
  if (!current) return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
  const { count: signedCount } = await supabaseAdmin
    .from('contract_signatures').select('id', { count: 'exact', head: true }).eq('contract_id', id).not('signed_at', 'is', null)
  const termsLocked = current.status === 'signed' || current.status === 'partially_signed' || (signedCount ?? 0) > 0
  const editsTerms = ['title', 'contractType', 'content', 'value', 'startDate', 'endDate', 'autoRenew'].some((k) => body[k as keyof typeof body] !== undefined)
  if (termsLocked && editsTerms) {
    return NextResponse.json({ error: 'This contract has been signed, so its terms can no longer be changed. Create a new contract or an addendum instead.' }, { status: 409 })
  }
  if (termsLocked && body.status !== undefined && !['expired', 'cancelled', current.status].includes(body.status)) {
    return NextResponse.json({ error: 'A signed contract can only be marked expired or cancelled.' }, { status: 409 })
  }

  const updates: Record<string, unknown> = {}
  if (body.title        !== undefined) updates.title         = body.title
  if (body.contractType !== undefined) updates.contract_type = body.contractType
  if (body.content      !== undefined) updates.content       = body.content
  if (body.value        !== undefined) updates.value         = body.value
  if (body.startDate    !== undefined) updates.start_date    = body.startDate
  if (body.endDate      !== undefined) updates.end_date      = body.endDate
  if (body.autoRenew    !== undefined) updates.auto_renew    = body.autoRenew
  if (body.status       !== undefined) {
    updates.status = body.status
    if (body.status === 'signed') updates.signed_at = new Date().toISOString()
  }

  const { data, error } = await supabaseAdmin
    .from('contracts')
    .update(updates)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error) return dbError(error)
  await writeAuditLog({
    tenantId, actor: user.id, action: 'contract.updated', resourceType: 'contract', resourceId: id,
    ipAddress: getClientIp(request),
    metadata: { fields: Object.keys(updates), from_status: current.status, to_status: body.status },
    // Marking a contract signed by hand (paper signature) is legal evidence.
    critical: body.status === 'signed',
  })
  return NextResponse.json(data)
}
