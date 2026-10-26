import { supabaseAdmin } from '@/lib/supabase/admin'
import { allRows } from '@/lib/supabase/fetchAll'
import { isLowStock } from '@/lib/inventory/lowStock'
import { buildReorderLines, orderDraftText, type ReorderLine } from '@/lib/ops/reorder'

/**
 * The supplier-order draft for a business's low-stock products (lib/ops/reorder.ts
 * has the rules). Reads only; empty when nothing is low or the data can't be read.
 */
export async function draftReorder(tenantId: string, businessName: string): Promise<{ lines: ReorderLine[]; text: string }> {
  try {
    const { data: products, error } = await allRows((lo, hi) => supabaseAdmin
      .from('products')
      .select('id, name, unit, current_stock, reorder_level, reorder_quantity, cost_price, active')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('id')
      .range(lo, hi))
    if (error) throw new Error(error.message)

    const low = (products ?? []).filter((p) => isLowStock(p))
    if (!low.length) return { lines: [], text: '' }

    // Units actually sold in the last 30 days (sells are stored as negative movements).
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString()
    const { data: sales } = await allRows((lo, hi) => supabaseAdmin
      .from('inventory_transactions')
      .select('id, product_id, quantity')
      .eq('tenant_id', tenantId)
      .eq('transaction_type', 'sell')
      .gte('created_at', since)
      .order('id')
      .range(lo, hi))
    const sold = new Map<string, number>()
    for (const s of sales ?? []) {
      const id = s.product_id as string
      sold.set(id, (sold.get(id) ?? 0) + Math.abs(Number(s.quantity ?? 0)))
    }

    const lines = buildReorderLines(low.map((p) => ({
      name: p.name as string,
      unit: (p.unit as string | null) ?? null,
      onHand: Number(p.current_stock ?? 0),
      reorderLevel: Number(p.reorder_level ?? 0),
      reorderQuantity: p.reorder_quantity ? Number(p.reorder_quantity) : null,
      sold30: sold.get(p.id as string) ?? 0,
      costPrice: p.cost_price ? Number(p.cost_price) : null,
    })))
    return { lines, text: orderDraftText(businessName, lines) }
  } catch (e) {
    console.error('[reorder] draft failed', tenantId, e instanceof Error ? e.message : e)
    return { lines: [], text: '' }
  }
}
