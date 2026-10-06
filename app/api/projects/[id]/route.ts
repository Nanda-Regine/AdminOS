import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'
import { guard, dbError } from '@/lib/api/guard'

const updateSchema = z.object({
  name:        z.string().min(1).max(500).optional(),
  description: z.string().max(2000).optional(),
  status:      z.enum(['draft','active','on_hold','completed','cancelled']).optional(),
  startDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dueDate:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  budget:      z.number().nonnegative().optional(),
  progressPct: z.number().min(0).max(100).optional(),
})

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await guard('analytics.read'); if (gate.denied) return gate.denied
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.app_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  const { id } = await params

  const { data, error } = await supabaseAdmin
    .from('projects')
    .select('*, contact:contacts(name:full_name, email), tasks(*)').is('deleted_at', null)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (error) return dbError(error)
  return NextResponse.json(data)
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await guard('insight.write'); if (gate.denied) return gate.denied
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

  const updates: Record<string, unknown> = {}
  if (body.name        !== undefined) updates.name         = body.name
  if (body.description !== undefined) updates.description  = body.description
  if (body.status      !== undefined) updates.status       = body.status
  if (body.startDate   !== undefined) updates.start_date   = body.startDate
  if (body.dueDate     !== undefined) updates.due_date     = body.dueDate
  if (body.budget      !== undefined) updates.budget       = body.budget
  if (body.progressPct !== undefined) updates.progress_pct = body.progressPct

  const { data, error } = await supabaseAdmin
    .from('projects')
    .update(updates)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error) return dbError(error)
  return NextResponse.json(data)
}
