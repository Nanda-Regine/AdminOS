import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'

const txSchema = z.object({
  productId:       z.string().uuid(),
  transactionType: z.enum(['receive','sell','adjust','return','damage','transfer']),
  quantity:        z.number().int(),
  unitCost:        z.number().nonnegative().optional(),
  reference:       z.string().max(200).optional(),
  notes:           z.string().max(1000).optional(),
})

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId  = user.user_metadata?.tenant_id as string
  if (!tenantId)  return new NextResponse('No tenant', { status: 400 })

  const url       = new URL(request.url)
  const productId = url.searchParams.get('productId')
  const from      = url.searchParams.get('from')
  const to        = url.searchParams.get('to')

  let query = supabaseAdmin
    .from('inventory_transactions')
    .select('*, product:products(name, sku, unit)')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(200)

  if (productId) query = query.eq('product_id', productId)
  if (from)      query = query.gte('created_at', from)
  if (to)        query = query.lte('created_at', to)

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

  let body: z.infer<typeof txSchema>
  try { body = txSchema.parse(await request.json()) } catch (e) {
    return NextResponse.json({ error: 'Invalid request', detail: e }, { status: 400 })
  }

  // Verify product belongs to tenant
  const { data: product } = await supabaseAdmin
    .from('products')
    .select('id, current_stock')
    .eq('id', body.productId)
    .eq('tenant_id', tenantId)
    .single()

  if (!product) return new NextResponse('Product not found', { status: 404 })

  // Compute stock delta
  const sells   = ['sell','damage','transfer']
  const receives = ['receive','return','adjust']
  let delta = body.quantity

  if (sells.includes(body.transactionType)) {
    delta = -Math.abs(body.quantity)
    if (product.current_stock + delta < 0) {
      return NextResponse.json({ error: 'Insufficient stock' }, { status: 422 })
    }
  } else if (receives.includes(body.transactionType)) {
    delta = Math.abs(body.quantity)
  }

  // Insert transaction + update stock atomically via RPC
  const newStock = product.current_stock + delta

  const [{ data: tx, error: txError }] = await Promise.all([
    supabaseAdmin
      .from('inventory_transactions')
      .insert({
        tenant_id:        tenantId,
        product_id:       body.productId,
        transaction_type: body.transactionType,
        quantity:         delta,
        unit_cost:        body.unitCost   ?? null,
        reference:        body.reference  ?? null,
        notes:            body.notes      ?? null,
        created_by:       user.id,
      })
      .select()
      .single(),
  ])

  if (txError) return NextResponse.json({ error: txError.message }, { status: 400 })

  await supabaseAdmin
    .from('products')
    .update({ current_stock: newStock })
    .eq('id', body.productId)

  return NextResponse.json({ transaction: tx, new_stock: newStock }, { status: 201 })
}
