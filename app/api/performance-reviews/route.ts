import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/permissions'

const createSchema = z.object({
  staffId:      z.string().uuid(),
  reviewPeriod: z.string().max(50).optional(),
  ratings:      z.record(z.number().min(1).max(5)).optional(),
  comments:     z.string().max(5000).optional(),
  goalsSet:     z.array(z.object({
    title:       z.string(),
    target_date: z.string().optional(),
  })).optional(),
})

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.user_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  const url     = new URL(request.url)
  const staffId = url.searchParams.get('staffId')

  let query = supabaseAdmin
    .from('performance_reviews')
    .select('*, staff(full_name, job_title)')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  if (staffId) query = query.eq('staff_id', staffId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.user_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  try { await requirePermission('manage_staff') } catch {
    return new NextResponse('Forbidden', { status: 403 })
  }

  let body: z.infer<typeof createSchema>
  try {
    body = createSchema.parse(await request.json())
  } catch (e) {
    return NextResponse.json({ error: 'Invalid request', detail: e }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('performance_reviews')
    .insert({
      tenant_id:     tenantId,
      staff_id:      body.staffId,
      reviewer_id:   user.id,
      review_period: body.reviewPeriod ?? null,
      ratings:       body.ratings      ?? null,
      comments:      body.comments     ?? null,
      goals_set:     body.goalsSet     ?? null,
      status:        'draft',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json(data, { status: 201 })
}
