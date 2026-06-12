import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'

const tierSchema = z.object({
  name:      z.string().min(1).max(100),
  minPoints: z.number().int().nonnegative(),
  discount:  z.number().min(0).max(100),
})

const upsertSchema = z.object({
  name:           z.string().min(1).max(200),
  pointsPerZar:   z.number().positive(),
  redemptionRate: z.number().positive(),
  tiers:          z.array(tierSchema).optional().default([]),
})

export async function GET(_request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.user_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  // Fetch programme config
  const { data: programme, error } = await supabaseAdmin
    .from('loyalty_programmes')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Fetch account summary: total members + total points outstanding
  const { data: summary, error: summaryError } = await supabaseAdmin
    .from('loyalty_accounts')
    .select('id, points_balance')
    .eq('tenant_id', tenantId)

  if (summaryError) return NextResponse.json({ error: summaryError.message }, { status: 400 })

  const totalMembers        = summary?.length ?? 0
  const totalPointsOutstanding = summary?.reduce((sum, a) => sum + (a.points_balance ?? 0), 0) ?? 0

  return NextResponse.json({
    programme: programme ?? null,
    summary: {
      totalMembers,
      totalPointsOutstanding,
    },
  })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.user_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  let body: z.infer<typeof upsertSchema>
  try { body = upsertSchema.parse(await request.json()) } catch (e) {
    return NextResponse.json({ error: 'Invalid request', detail: e }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('loyalty_programmes')
    .upsert(
      {
        tenant_id:       tenantId,
        name:            body.name,
        points_per_zar:  body.pointsPerZar,
        redemption_rate: body.redemptionRate,
        tiers:           body.tiers,
        active:          true,
      },
      { onConflict: 'tenant_id' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 200 })
}
