import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'

const memberSchema = z.object({
  name:           z.string().min(1).max(200),
  phone:          z.string().min(7).max(20),
  payoutPosition: z.number().int().positive().optional(),
})

const contributionSchema = z.object({
  memberId:    z.string().uuid(),
  periodMonth: z.number().int().min(1).max(12),
  periodYear:  z.number().int().min(2020).max(2099),
  amount:      z.number().positive(),
  status:      z.enum(['pending','paid','late','excused']).default('paid'),
})

// GET /api/stokvel/[id] — group detail with members and contributions
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.user_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  const { id } = await params

  const { data, error } = await supabaseAdmin
    .from('stokvel_groups')
    .select('*, members:stokvel_members(*, contributions:stokvel_contributions(*))')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

// POST /api/stokvel/[id] with action=add_member or action=record_contribution
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.user_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  const { id } = await params
  const url    = new URL(request.url)
  const action = url.searchParams.get('action')

  // Verify group belongs to tenant
  const { data: group } = await supabaseAdmin
    .from('stokvel_groups')
    .select('id')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (!group) return new NextResponse('Group not found', { status: 404 })

  const rawBody = await request.json()

  if (action === 'add_member') {
    let body: z.infer<typeof memberSchema>
    try { body = memberSchema.parse(rawBody) } catch (e) {
      return NextResponse.json({ error: 'Invalid', detail: e }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('stokvel_members')
      .insert({
        group_id:       id,
        tenant_id:      tenantId,
        name:           body.name,
        phone:          body.phone,
        payout_position: body.payoutPosition ?? null,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data, { status: 201 })
  }

  if (action === 'record_contribution') {
    let body: z.infer<typeof contributionSchema>
    try { body = contributionSchema.parse(rawBody) } catch (e) {
      return NextResponse.json({ error: 'Invalid', detail: e }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('stokvel_contributions')
      .upsert({
        group_id:     id,
        member_id:    body.memberId,
        period_month: body.periodMonth,
        period_year:  body.periodYear,
        amount:       body.amount,
        status:       body.status,
        paid_at:      body.status === 'paid' ? new Date().toISOString() : null,
      }, { onConflict: 'group_id,member_id,period_month,period_year' })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data, { status: 201 })
  }

  return NextResponse.json({ error: 'Unknown action. Use ?action=add_member or ?action=record_contribution' }, { status: 400 })
}
