import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'

const requestSchema = z.object({
  mentorTenantId: z.string().uuid(),
  focusAreas:     z.array(z.string()).default([]),
})

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.user_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  const url    = new URL(request.url)
  const role   = url.searchParams.get('role') // 'mentor' | 'mentee' | null = both
  const status = url.searchParams.get('status')

  let query = supabaseAdmin
    .from('mentor_connections')
    .select('*, mentor_tenant:tenants!mentor_tenant_id(name, business_type), mentee_tenant:tenants!mentee_tenant_id(name, business_type)')
    .order('created_at', { ascending: false })

  if (role === 'mentor') {
    query = query.eq('mentor_tenant_id', tenantId)
  } else if (role === 'mentee') {
    query = query.eq('mentee_tenant_id', tenantId)
  } else {
    query = query.or(`mentor_tenant_id.eq.${tenantId},mentee_tenant_id.eq.${tenantId}`)
  }

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

// Request a mentor connection
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.user_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  let body: z.infer<typeof requestSchema>
  try { body = requestSchema.parse(await request.json()) } catch (e) {
    return NextResponse.json({ error: 'Invalid request', detail: e }, { status: 400 })
  }

  if (body.mentorTenantId === tenantId) {
    return NextResponse.json({ error: 'Cannot mentor yourself' }, { status: 422 })
  }

  // Check mentor tenant exists
  const { data: mentor } = await supabaseAdmin
    .from('tenants')
    .select('id, name')
    .eq('id', body.mentorTenantId)
    .single()

  if (!mentor) return new NextResponse('Mentor not found', { status: 404 })

  // Check no existing active connection
  const { data: existing } = await supabaseAdmin
    .from('mentor_connections')
    .select('id, status')
    .eq('mentor_tenant_id', body.mentorTenantId)
    .eq('mentee_tenant_id', tenantId)
    .not('status', 'in', '(completed,declined)')
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'Connection already exists', existing }, { status: 409 })
  }

  const { data, error } = await supabaseAdmin
    .from('mentor_connections')
    .insert({
      mentor_tenant_id: body.mentorTenantId,
      mentee_tenant_id: tenantId,
      focus_areas:      body.focusAreas,
      status:           'pending',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
