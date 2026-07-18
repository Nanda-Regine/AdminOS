import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'

const createSchema = z.object({
  title:       z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
  projectId:   z.string().uuid().optional(),
  contactId:   z.string().uuid().optional(),
  invoiceId:   z.string().uuid().optional(),
  assignedTo:  z.string().uuid().optional(),
  priority:    z.enum(['urgent','high','medium','low']).default('medium'),
  dueDate:     z.string().datetime().optional(),
  source:      z.enum(['manual','agent_chase','agent_care','agent_compliance','document_expiry','contract_expiry','payroll','onboarding']).default('manual'),
})

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.app_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  const url        = new URL(request.url)
  const status     = url.searchParams.get('status')
  const assignedTo = url.searchParams.get('assignedTo')
  const projectId  = url.searchParams.get('projectId')

  // Note: auth.users can't be embedded through PostgREST (parse error), so the
  // assignee is returned as the assigned_to uuid; resolve the email client-side
  // or via a public profile join if needed.
  let query = supabaseAdmin
    .from('tasks')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('priority', { ascending: true })
    .order('due_date',  { ascending: true, nullsFirst: false })

  if (status)     query = query.eq('status', status)
  if (assignedTo) query = query.eq('assigned_to', assignedTo)
  if (projectId)  query = query.eq('project_id', projectId)

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
    .from('tasks')
    .insert({
      tenant_id:   tenantId,
      title:       body.title,
      description: body.description ?? null,
      project_id:  body.projectId   ?? null,
      contact_id:  body.contactId   ?? null,
      invoice_id:  body.invoiceId   ?? null,
      assigned_to: body.assignedTo  ?? null,
      priority:    body.priority,
      due_date:    body.dueDate     ?? null,
      source:      body.source,
      status:      'todo',
      created_by:  user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
