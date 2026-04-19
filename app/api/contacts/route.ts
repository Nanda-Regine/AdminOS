import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'

const createSchema = z.object({
  identifier: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  type: z.enum(['client', 'supplier', 'staff', 'unknown']).default('client'),
  notes: z.string().max(2000).optional().nullable(),
  tags: z.array(z.string()).optional(),
})

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.user_metadata?.tenant_id as string
  const url = new URL(request.url)
  const search = url.searchParams.get('search')
  const type = url.searchParams.get('type')
  const page = Number(url.searchParams.get('page') || '1')
  const limit = Math.min(Number(url.searchParams.get('limit') || '50'), 100)
  const offset = (page - 1) * limit

  let query = supabaseAdmin
    .from('contacts')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (search) {
    query = query.or(`name.ilike.%${search}%,identifier.ilike.%${search}%,email.ilike.%${search}%`)
  }
  if (type) {
    query = query.eq('type', type)
  }

  const { data, count, error } = await query
  if (error) return NextResponse.json({ error: 'Query failed' }, { status: 500 })

  return NextResponse.json({ contacts: data, total: count, page, limit })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.user_metadata?.tenant_id as string

  let body: z.infer<typeof createSchema>
  try {
    body = createSchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // Check for duplicate identifier in this tenant
  const { data: existing } = await supabaseAdmin
    .from('contacts')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('identifier', body.identifier)
    .single()

  if (existing) {
    return NextResponse.json({ error: 'Contact with this identifier already exists' }, { status: 409 })
  }

  const { data, error } = await supabaseAdmin
    .from('contacts')
    .insert({
      tenant_id: tenantId,
      identifier: body.identifier,
      name: body.name,
      email: body.email ?? null,
      phone: body.phone ?? null,
      type: body.type,
      notes: body.notes ?? null,
      tags: body.tags ?? [],
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'Failed to create contact' }, { status: 500 })

  return NextResponse.json({ contact: data }, { status: 201 })
}
