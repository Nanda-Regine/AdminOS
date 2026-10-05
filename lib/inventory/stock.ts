import { supabaseAdmin } from '@/lib/supabase/admin'

/**
 * Move stock atomically. Returns the new stock level, or null when the product
 * isn't this tenant's, is deleted, or the move would take stock below zero.
 *
 * Backed by public.adjust_product_stock (migration 20261005_money_sweep.sql):
 * the arithmetic and the never-below-zero check happen in one UPDATE, so two
 * simultaneous sales can't both read 5 and both write 4. Callers used to
 * read-modify-write in JS, with no tenant filter on the write.
 */
export async function adjustStock(tenantId: string, productId: string, delta: number): Promise<number | null> {
  const { data, error } = await supabaseAdmin.rpc('adjust_product_stock', {
    p_tenant: tenantId,
    p_product: productId,
    p_delta: delta,
  })
  if (error) throw error
  return typeof data === 'number' ? data : null
}
