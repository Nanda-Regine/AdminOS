import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'

const createSchema = z.object({
  full_name:    z.string().min(1).max(200),
  phone:        z.string().max(30).optional().nullable(),
  email:        z.string().email().optional().nullable(),
  company:      z.string().max(200).optional().nullable(),
  contact_type: z.enum(['client', 'supplier', 'staff', 'unknown']).default('client'),
  notes:        z.string().max(2000).optional().nullable(),
  tags:         z.array(z.string()).optional(),
  source:       z.string().max(100).optional().nullable(),
})

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.user_metadata?.tenant_id as string
  const url    = new URL(request.url)
  const search = url.searchParams.get('search')
  const type   = url.searchParams.get('type')
  const page   = Number(url.searchParams.get('page') || '1')
  const limit  = Math.min(Number(url.searchParams.get('limit') || '50'), 100)
  const offset = (page - 1) * limit

  let query = supabaseAdmin
    .from('contacts')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (search) {
    query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%,company.ilike.%${search}%`)
  }
  if (type) {
    query = query.eq('contact_type', type)
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

  // Check for duplicate phone in this tenant (if phone provided)
  if (body.phone) {
    const { data: existing } = await supabaseAdmin
      .from('contacts')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('phone', body.phone)
      .single()

    if (existing) {
      return NextResponse.json({ error: 'Contact with this phone number already exists' }, { status: 409 })
    }
  }

  const { data, error } = await supabaseAdmin
    .from('contacts')
    .insert({
      tenant_id:    tenantId,
      full_name:    body.full_name,
      phone:        body.phone    ?? null,
      email:        body.email    ?? null,
      company:      body.company  ?? null,
      contact_type: body.contact_type,
      notes:        body.notes    ?? null,
      tags:         body.tags     ?? [],
      source:       body.source   ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'Failed to create contact' }, { status: 500 })

  return NextResponse.json({ contact: data }, { status: 201 })
}
