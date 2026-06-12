import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { inngest } from '@/inngest/client'
import { requireAdminOSPlan } from '@/lib/billing/planGates'
import { z } from 'zod'

const generateSchema = z.object({
  periodLabel: z.string().min(1).max(100),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.user_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  const planError = await requireAdminOSPlan('scale', tenantId)
  if (planError) return NextResponse.json({ error: planError }, { status: 403 })

  const url   = new URL(request.url)
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '12'), 24)

  const { data, error } = await supabaseAdmin
    .from('board_packs')
    .select('id, period_label, period_start, period_end, status, created_at, pdf_url')
    .eq('tenant_id', tenantId)
    .order('period_start', { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.user_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  const planError = await requireAdminOSPlan('scale', tenantId)
  if (planError) return NextResponse.json({ error: planError }, { status: 403 })

  let body: z.infer<typeof generateSchema>
  try { body = generateSchema.parse(await request.json()) } catch (e) {
    return NextResponse.json({ error: 'Invalid request', detail: e }, { status: 400 })
  }

  // Create the pack record in 'generating' state
  const { data: pack, error } = await supabaseAdmin
    .from('board_packs')
    .insert({
      tenant_id:    tenantId,
      generated_by: user.id,
      period_label: body.periodLabel,
      period_start: body.periodStart,
      period_end:   body.periodEnd,
      pack_data:    {},
      status:       'generating',
    })
    .select('id')
    .single()

  if (error || !pack) return NextResponse.json({ error: error?.message ?? 'Failed to create' }, { status: 400 })

  // Queue the Inngest generation job
  await inngest.send({
    name: 'adminos/board_pack.generate',
    data: {
      tenant_id:     tenantId,
      board_pack_id: pack.id,
      period_start:  body.periodStart,
      period_end:    body.periodEnd,
      period_label:  body.periodLabel,
    },
  })

  return NextResponse.json({ id: pack.id, status: 'generating' }, { status: 202 })
}
