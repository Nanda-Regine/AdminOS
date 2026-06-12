import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'

const updateSchema = z.object({
  id:     z.string().uuid(),
  status: z.enum(['upcoming','due','overdue','completed','not_applicable']),
})

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.user_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  const url    = new URL(request.url)
  const status = url.searchParams.get('status')
  const from   = url.searchParams.get('from')
  const to     = url.searchParams.get('to')

  let query = supabaseAdmin
    .from('compliance_items')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('due_date', { ascending: true, nullsFirst: false })

  if (status) query = query.eq('status', status)
  if (from)   query = query.gte('due_date', from)
  if (to)     query = query.lte('due_date', to)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Also compute overdue status for items past due date
  const today = new Date().toISOString().split('T')[0]
  const enriched = (data ?? []).map(item => ({
    ...item,
    status: item.status === 'upcoming' && item.due_date < today ? 'overdue' : item.status,
  }))

  return NextResponse.json(enriched)
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.user_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  let body: z.infer<typeof updateSchema>
  try { body = updateSchema.parse(await request.json()) } catch (e) {
    return NextResponse.json({ error: 'Invalid', detail: e }, { status: 400 })
  }

  const updates: Record<string, unknown> = { status: body.status }
  if (body.status === 'completed') {
    updates.completed_at = new Date().toISOString()
  }

  const { data, error } = await supabaseAdmin
    .from('compliance_items')
    .update(updates)
    .eq('id', body.id)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
