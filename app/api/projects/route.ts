import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'

const createSchema = z.object({
  contactId:   z.string().uuid().optional(),
  name:        z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
  status:      z.enum(['draft','active','on_hold','completed','cancelled']).default('active'),
  startDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dueDate:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  budget:      z.number().nonnegative().optional(),
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
    .from('projects')
    .select(`
      *,
      contact:contacts(name),
      tasks:tasks(count),
      open_tasks:tasks!inner(count)
    `)
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
    .from('projects')
    .insert({
      tenant_id:   tenantId,
      contact_id:  body.contactId  ?? null,
      name:        body.name,
      description: body.description ?? null,
      status:      body.status,
      start_date:  body.startDate  ?? null,
      due_date:    body.dueDate    ?? null,
      budget:      body.budget     ?? null,
      created_by:  user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
