import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'

const createSchema = z.object({
  name:            z.string().min(1).max(500),
  sku:             z.string().max(100).optional(),
  description:     z.string().max(2000).optional(),
  category:        z.string().max(100).optional(),
  unitPrice:       z.number().nonnegative().optional(),
  costPrice:       z.number().nonnegative().optional(),
  currentStock:    z.number().int().default(0),
  reorderLevel:    z.number().int().nonnegative().default(0),
  reorderQuantity: z.number().int().positive().optional(),
  unit:            z.string().default('unit'),
})

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.user_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  const url      = new URL(request.url)
  const lowStock = url.searchParams.get('lowStock') === 'true'
  const category = url.searchParams.get('category')
  const active   = url.searchParams.get('active')

  let query = supabaseAdmin
    .from('products')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('name')

  if (lowStock)              query = query.filter('current_stock', 'lte', 'reorder_level')
  if (category)              query = query.eq('category', category)
  if (active !== null)       query = query.eq('active', active === 'true')

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Flag items that need reordering
  const enriched = (data ?? []).map(p => ({
    ...p,
    needs_reorder: p.current_stock <= p.reorder_level && p.reorder_level > 0,
  }))

  return NextResponse.json(enriched)
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
    .from('products')
    .insert({
      tenant_id:       tenantId,
      name:            body.name,
      sku:             body.sku             ?? null,
      description:     body.description     ?? null,
      category:        body.category        ?? null,
      unit_price:      body.unitPrice       ?? null,
      cost_price:      body.costPrice       ?? null,
      current_stock:   body.currentStock,
      reorder_level:   body.reorderLevel,
      reorder_quantity: body.reorderQuantity ?? null,
      unit:            body.unit,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
