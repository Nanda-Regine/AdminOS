import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'

const updateSchema = z.object({
  status:     z.enum(['active','completed','declined']),
  focusAreas: z.array(z.string()).optional(),
})

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

  // Verify connection participant
  const { data: conn } = await supabaseAdmin
    .from('mentor_connections')
    .select('*')
    .eq('id', id)
    .or(`mentor_tenant_id.eq.${tenantId},mentee_tenant_id.eq.${tenantId}`)
    .single()

  if (!conn) return new NextResponse('Connection not found', { status: 404 })

  // Only mentor can accept; either party can decline or complete
  if (body.status === 'active' && conn.mentor_tenant_id !== tenantId) {
    return NextResponse.json({ error: 'Only the mentor can accept a connection request' }, { status: 403 })
  }

  const updates: Record<string, unknown> = { status: body.status }
  if (body.focusAreas) updates.focus_areas = body.focusAreas
  if (body.status === 'active')    updates.started_at   = new Date().toISOString()
  if (body.status === 'completed') updates.completed_at = new Date().toISOString()

  const { data, error } = await supabaseAdmin
    .from('mentor_connections')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
