import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'

const createSchema = z.object({
  body: z.string().min(1).max(5000),
})

async function verifyTaskOwnership(taskId: string, tenantId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('tasks')
    .select('id')
    .eq('id', taskId)
    .eq('tenant_id', tenantId)
    .single()
  return !!data
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.app_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  const taskExists = await verifyTaskOwnership(id, tenantId)
  if (!taskExists) return new NextResponse('Not found', { status: 404 })

  const { data, error } = await supabaseAdmin
    .from('task_comments')
    .select('*')
    .eq('task_id', id)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.app_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  const taskExists = await verifyTaskOwnership(id, tenantId)
  if (!taskExists) return new NextResponse('Not found', { status: 404 })

  let body: z.infer<typeof createSchema>
  try { body = createSchema.parse(await request.json()) } catch (e) {
    return NextResponse.json({ error: 'Invalid request', detail: e }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('task_comments')
    .insert({
      task_id:   id,
      tenant_id: tenantId,
      user_id:   user.id,
      body:      body.body,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
