import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'

const createSchema = z.object({
  name:          z.string().min(1).max(300),
  category:      z.string().max(100).optional(),
  phone:         z.string().max(20).optional(),
  email:         z.string().email().optional(),
  website:       z.string().url().optional(),
  contactPerson: z.string().max(200).optional(),
  paymentTerms:  z.number().int().nonnegative().default(30),
  bbbbeeLlevel:  z.number().int().min(1).max(8).optional(),
  womenOwned:    z.boolean().default(false),
  youthOwned:    z.boolean().default(false),
  notes:         z.string().max(2000).optional(),
})

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.user_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  const url      = new URL(request.url)
  const category = url.searchParams.get('category')
  const bbbee    = url.searchParams.get('bbbee')        // filter by max BBBEE level
  const womenOwned = url.searchParams.get('womenOwned') === 'true'
  const youthOwned = url.searchParams.get('youthOwned') === 'true'

  let query = supabaseAdmin
    .from('suppliers')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('name')

  if (category)  query = query.eq('category', category)
  if (bbbee)     query = query.lte('bbbbee_level', parseInt(bbbee))
  if (womenOwned) query = query.eq('women_owned', true)
  if (youthOwned) query = query.eq('youth_owned', true)

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
    .from('suppliers')
    .insert({
      tenant_id:      tenantId,
      name:           body.name,
      category:       body.category      ?? null,
      phone:          body.phone         ?? null,
      email:          body.email         ?? null,
      website:        body.website       ?? null,
      contact_person: body.contactPerson ?? null,
      payment_terms:  body.paymentTerms,
      bbbbee_level:   body.bbbbeeLlevel  ?? null,
      women_owned:    body.womenOwned,
      youth_owned:    body.youthOwned,
      notes:          body.notes         ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
