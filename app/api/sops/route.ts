import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'

const createSchema = z.object({
  title:                   z.string().min(1).max(500),
  category:                z.string().max(100).optional(),
  content:                 z.record(z.string(), z.unknown()).default({}),
  status:                  z.enum(['draft','active','archived']).default('draft'),
  requiresAcknowledgement: z.boolean().default(false),
  applicableRoles:         z.array(z.string()).default(['all']),
})

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.user_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  const url      = new URL(request.url)
  const status   = url.searchParams.get('status')
  const category = url.searchParams.get('category')

  let query = supabaseAdmin
    .from('sop_documents')
    .select('*, acks:sop_acknowledgements(user_id, acknowledged_at)')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  if (status)   query = query.eq('status', status)
  if (category) query = query.eq('category', category)

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

  let body: z.infer<typeof createSchema>
  try { body = createSchema.parse(await request.json()) } catch (e) {
    return NextResponse.json({ error: 'Invalid request', detail: e }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('sop_documents')
    .insert({
      tenant_id:                tenantId,
      title:                    body.title,
      category:                 body.category ?? null,
      content:                  body.content,
      status:                   body.status,
      requires_acknowledgement: body.requiresAcknowledgement,
      applicable_roles:         body.applicableRoles,
      created_by:               user.id,
      published_at:             body.status === 'active' ? new Date().toISOString() : null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
