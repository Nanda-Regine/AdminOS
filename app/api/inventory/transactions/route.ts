import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'
import { adjustStock } from '@/lib/inventory/stock'
import { withRoute, unwrap, RouteError } from '@/lib/api/withRoute'

const txSchema = z.object({
  productId:       z.string().uuid(),
  transactionType: z.enum(['receive','sell','adjust','return','damage','transfer']),
  quantity:        z.number().int().refine(n => n !== 0, 'Quantity cannot be zero').refine(n => Math.abs(n) <= 1_000_000, 'Quantity is too large'),
  unitCost:        z.number().nonnegative().max(100_000_000).optional(),
  reference:       z.string().max(200).optional(),
  notes:           z.string().max(1000).optional(),
})

const listQuery = z.object({
  productId: z.string().uuid().optional(),
  from:      z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(),
  to:        z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(),
})

export const GET = withRoute({ action: 'inventory.read', query: listQuery }, async ({ ctx, query }) => {
  let q = supabaseAdmin
    .from('inventory_transactions')
    .select('id, product_id, transaction_type, quantity, unit_cost, reference, notes, created_by, created_at, product:products(name, sku, unit)')
    .eq('tenant_id', ctx.tenantId)
    .order('created_at', { ascending: false })
    .limit(200)

  if (query.productId) q = q.eq('product_id', query.productId)
  if (query.from)      q = q.gte('created_at', query.from)
  if (query.to)        q = q.lte('created_at', query.to)

  return unwrap(await q) ?? []
})

const OUT = ['sell', 'damage', 'transfer']
const IN = ['receive', 'return']

export const POST = withRoute({
  action: 'inventory.write',
  body: txSchema,
  status: 201,
  audit: 'inventory.moved',
  resourceType: 'product',
}, async ({ ctx, body }) => {
  // 'adjust' (stocktake correction) keeps its sign — a count can go either way.
  const delta = OUT.includes(body.transactionType) ? -Math.abs(body.quantity)
    : IN.includes(body.transactionType) ? Math.abs(body.quantity)
    : body.quantity

  // Move stock first, atomically and tenant-scoped (lib/inventory/stock). The
  // old code read stock, checked it in JS, wrote the ledger, then wrote
  // current_stock = (stale read) + delta with no tenant filter — two movements
  // at once lost one, and a failed stock write left the ledger out of step.
  const newStock = await adjustStock(ctx.tenantId, body.productId, delta)
  if (newStock === null) {
    const exists = unwrap(await supabaseAdmin.from('products').select('id').eq('id', body.productId)
      .eq('tenant_id', ctx.tenantId).is('deleted_at', null).maybeSingle())
    throw exists
      ? new RouteError(422, 'Not enough stock for that movement.', 'insufficient_stock')
      : new RouteError(404, 'Product not found', 'not_found')
  }

  const { data: tx, error } = await supabaseAdmin
    .from('inventory_transactions')
    .insert({
      tenant_id:        ctx.tenantId,
      product_id:       body.productId,
      transaction_type: body.transactionType,
      quantity:         delta,
      unit_cost:        body.unitCost   ?? null,
      reference:        body.reference  ?? null,
      notes:            body.notes      ?? null,
      created_by:       ctx.userId,
    })
    .select()
    .single()
  if (error) {
    // Undo the movement so stock and ledger stay in step.
    await adjustStock(ctx.tenantId, body.productId, -delta).catch(() => null)
    throw error
  }

  return { id: body.productId, transaction: tx, new_stock: newStock }
})
