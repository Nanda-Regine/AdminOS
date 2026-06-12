import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'

const updateSchema = z.object({
  status:      z.enum(['todo','in_progress','review','done','cancelled']).optional(),
  title:       z.string().min(1).max(500).optional(),
  description: z.string().max(2000).optional(),
  assignedTo:  z.string().uuid().nullable().optional(),
  priority:    z.enum(['urgent','high','medium','low']).optional(),
  dueDate:     z.string().datetime().nullable().optional(),
})

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.user_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  let body: z.infer<typeof updateSchema>
  try { body = updateSchema.parse(await request.json()) } catch (e) {
    return NextResponse.json({ error: 'Invalid request', detail: e }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  if (body.status      !== undefined) updates.status      = body.status
  if (body.title       !== undefined) updates.title       = body.title
  if (body.description !== undefined) updates.description = body.description
  if (body.assignedTo  !== undefined) updates.assigned_to = body.assignedTo
  if (body.priority    !== undefined) updates.priority    = body.priority
  if (body.dueDate     !== undefined) updates.due_date    = body.dueDate

  if (body.status === 'done') {
    updates.completed_at = new Date().toISOString()
  }

  const { data, error } = await supabaseAdmin
    .from('tasks')
    .update(updates)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  if (!data) return new NextResponse('Not found', { status: 404 })
  return NextResponse.json(data)
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.user_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  const { error } = await supabaseAdmin
    .from('tasks')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return new NextResponse(null, { status: 204 })
}
