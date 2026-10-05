import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'
import { withRoute, unwrap } from '@/lib/api/withRoute'

// Both handlers used to be open to any logged-in member of the tenant.

const createSchema = z.object({
  name:            z.string().trim().min(1).max(500),
  sku:             z.string().trim().max(100).optional(),
  description:     z.string().max(2000).optional(),
  category:        z.string().max(100).optional(),
  unitPrice:       z.number().nonnegative().max(100_000_000).optional(),
  costPrice:       z.number().nonnegative().max(100_000_000).optional(),
  // Opening stock can't be negative (it could before).
  currentStock:    z.number().int().nonnegative().max(100_000_000).default(0),
  reorderLevel:    z.number().int().nonnegative().max(100_000_000).default(0),
  reorderQuantity: z.number().int().positive().max(100_000_000).optional(),
  unit:            z.string().trim().min(1).max(30).default('unit'),
})

const listQuery = z.object({
  lowStock: z.enum(['true', 'false']).optional(),
  category: z.string().max(100).optional(),
  active:   z.enum(['true', 'false']).optional(),
})

export const GET = withRoute({ action: 'inventory.read', query: listQuery }, async ({ ctx, query }) => {
  let q = supabaseAdmin
    .from('products')
    .select('id, name, sku, description, category, unit_price, cost_price, current_stock, reorder_level, reorder_quantity, unit, active, image_url, created_at')
    .eq('tenant_id', ctx.tenantId)
    .is('deleted_at', null)
    .order('name')
    .limit(1000)

  if (query.category) q = q.eq('category', query.category)
  if (query.active)   q = q.eq('active', query.active === 'true')

  const enriched = (unwrap(await q) ?? []).map(p => ({
    ...p,
    needs_reorder: p.current_stock <= p.reorder_level && p.reorder_level > 0,
  }))

  // Column-to-column comparison can't be expressed in a PostgREST filter; the
  // old `.filter('current_stock', 'lte', 'reorder_level')` compared stock to
  // the STRING 'reorder_level' and errored on every call.
  return query.lowStock === 'true' ? enriched.filter(p => p.needs_reorder) : enriched
})

export const POST = withRoute({
  action: 'inventory.write',
  body: createSchema,
  status: 201,
  audit: 'product.created',
  resourceType: 'product',
}, async ({ ctx, body }) =>
  unwrap(await supabaseAdmin
    .from('products')
    .insert({
      tenant_id:        ctx.tenantId,
      name:             body.name,
      sku:              body.sku || null,
      description:      body.description     ?? null,
      category:         body.category        ?? null,
      unit_price:       body.unitPrice       ?? null,
      cost_price:       body.costPrice       ?? null,
      current_stock:    body.currentStock,
      reorder_level:    body.reorderLevel,
      reorder_quantity: body.reorderQuantity ?? null,
      unit:             body.unit,
    })
    .select()
    .single()),
)
