import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'

const updateSchema = z.object({
  title:                   z.string().min(1).max(500).optional(),
  category:                z.string().max(100).optional(),
  content:                 z.record(z.unknown()).optional(),
  status:                  z.enum(['draft','active','archived']).optional(),
  requiresAcknowledgement: z.boolean().optional(),
  applicableRoles:         z.array(z.string()).optional(),
})

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.user_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  const { id } = await params

  let body: z.infer<typeof updateSchema>
  try { body = updateSchema.parse(await request.json()) } catch (e) {
    return NextResponse.json({ error: 'Invalid request', detail: e }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  if (body.title !== undefined)                   updates.title = body.title
  if (body.category !== undefined)                updates.category = body.category
  if (body.content !== undefined)                 updates.content = body.content
  if (body.requiresAcknowledgement !== undefined) updates.requires_acknowledgement = body.requiresAcknowledgement
  if (body.applicableRoles !== undefined)         updates.applicable_roles = body.applicableRoles
  if (body.status !== undefined) {
    updates.status = body.status
    if (body.status === 'active') updates.published_at = new Date().toISOString()
    // Bump version on publish
    updates.version = supabaseAdmin.rpc as unknown as number
  }

  // Version bump: fetch current version first
  const { data: current } = await supabaseAdmin
    .from('sop_documents')
    .select('version')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (body.status === 'active' && current) {
    updates.version = (current.version ?? 1) + 1
  } else {
    delete updates.version
  }

  const { data, error } = await supabaseAdmin
    .from('sop_documents')
    .update(updates)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

// POST /api/sops/[id]/acknowledge — staff acknowledge they've read it
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const { id } = await params

  const { data, error } = await supabaseAdmin
    .from('sop_acknowledgements')
    .upsert({ sop_id: id, user_id: user.id, acknowledged_at: new Date().toISOString() })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
