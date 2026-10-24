/**
 * The one rule for "this product needs reordering".
 *
 * A product only counts when the owner set a reorder level above zero (every new
 * product defaults to 0, and services never hold stock) and it is still active.
 * /api/inventory already applied this; Ops, Inventory, the dashboard and the
 * 06:30 alert compared `stock <= level` alone, so every un-configured product
 * showed as low stock and turned the business health red.
 *
 * Pure (no server imports) so tests load it directly.
 */
export interface StockLevel {
  current_stock: number | string | null
  reorder_level: number | string | null
  active?: boolean | null
}

export function isLowStock(p: StockLevel): boolean {
  const level = Number(p.reorder_level ?? 0)
  return p.active !== false && level > 0 && Number(p.current_stock ?? 0) <= level
}
