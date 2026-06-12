import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'
import { fireBusinessEvent } from '@/lib/academy/knowledgeGraph'

const createSchema = z.object({
  name:               z.string().min(1).max(300),
  contributionAmount: z.number().positive(),
  frequency:          z.enum(['weekly','fortnightly','monthly']).default('monthly'),
  payoutOrder:        z.enum(['rotation','lottery','fixed']).default('rotation'),
  startDate:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  rules:              z.string().max(5000).optional(),
})

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.user_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('stokvel_groups')
    .select('*, members:stokvel_members(count)')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.user_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  let body: z.infer<typeof createSchema>
  try { body = createSchema.parse(await request.json()) } catch (e) {
    return NextResponse.json({ error: 'Invalid request', detail: e }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('stokvel_groups')
    .insert({
      tenant_id:           tenantId,
      name:                body.name,
      contribution_amount: body.contributionAmount,
      frequency:           body.frequency,
      payout_order:        body.payoutOrder,
      start_date:          body.startDate ?? null,
      rules:               body.rules     ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  fireBusinessEvent('stokvel.created', tenantId, user.id)
  return NextResponse.json(data, { status: 201 })
}
