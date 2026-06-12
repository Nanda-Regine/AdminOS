import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'

const updateSchema = z.object({
  title:         z.string().min(1).max(500).optional(),
  contractType:  z.string().max(100).optional(),
  content:       z.record(z.unknown()).optional(),
  status:        z.enum(['draft','sent','partially_signed','signed','expired','cancelled']).optional(),
  value:         z.number().nonnegative().optional(),
  startDate:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  autoRenew:     z.boolean().optional(),
})

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.user_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  const { id } = await params

  const { data, error } = await supabaseAdmin
    .from('contracts')
    .select('*, contact:contacts(name, email, phone), signatures:contract_signatures(*)')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.user_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  const { id } = await params

  let body: z.infer<typeof updateSchema>
  try { body = updateSchema.parse(await request.json()) } catch (e) {
    return NextResponse.json({ error: 'Invalid request', detail: e }, { status: 400 })
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

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
