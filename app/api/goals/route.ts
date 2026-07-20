import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'
import { fireBusinessEvent } from '@/lib/academy/knowledgeGraph'
import { checkAchievements } from '@/lib/academy/checkAchievements'

const createSchema = z.object({
  title:         z.string().min(1).max(500),
  description:   z.string().max(2000).optional(),
  category:      z.string().max(100).optional(),
  targetValue:   z.number().optional(),
  targetUnit:    z.string().max(50).optional(),
  targetDate:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.app_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  const url    = new URL(request.url)
  const status = url.searchParams.get('status')

  let query = supabaseAdmin
    .from('goals')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)

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

  const { data, error } = await supabaseAdmin
    .from('goals')
    // Aligned to the actual goals schema (title/description/quarter/target_metric/
    // target_value/progress_pct/status) — the columns the other two goals inserters
    // (workflow/file-received, documents/upload) use. This route previously wrote
    // category/target_unit/target_date/created_by, none of which exist → every
    // create 400'd ("Could not find the 'category' column").
    .insert({
      tenant_id:     tenantId,
      title:         body.title,
      description:   body.description  ?? null,
      target_metric: body.targetUnit   ?? null,
      target_value:  body.targetValue  ?? null,
      status:        'active',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Fire business event
  fireBusinessEvent('goal.created', tenantId, user.id)

  return NextResponse.json(data, { status: 201 })
}
