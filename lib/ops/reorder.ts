/**
 * Draft supplier order for products at or below their reorder level.
 * Pure (no imports) so tests load it directly.
 *
 * Quantity, in order of trust:
 *   1. the owner's own reorder_quantity for that product, when set;
 *   2. otherwise cover the last 30 days of actual sales (so a fast mover is not
 *      reordered at a slow mover's size), but never less than what lifts stock
 *      to twice the reorder level — so it is above the line, not on it.
 * A draft only: the owner reads, adjusts and sends it. AdminOS does not place orders.
 */

export interface ReorderItem {
  name: string
  unit: string | null
  onHand: number
  reorderLevel: number
  /** The owner's usual order size for this product, if they set one. */
  reorderQuantity: number | null
  /** Units sold in the last 30 days (0 when unknown). */
  sold30: number
  costPrice: number | null
}

export interface ReorderLine {
  name: string
  unit: string | null
  qty: number
  /** Estimated cost = qty × cost price, when a cost price is known. */
  estCost: number | null
  basis: 'owner_quantity' | 'recent_sales' | 'restock_level'
}

export function suggestQuantity(i: Pick<ReorderItem, 'onHand' | 'reorderLevel' | 'reorderQuantity' | 'sold30'>): { qty: number; basis: ReorderLine['basis'] } {
  if (i.reorderQuantity && i.reorderQuantity > 0) return { qty: Math.ceil(i.reorderQuantity), basis: 'owner_quantity' }
  const toRestock = Math.max(1, Math.ceil(i.reorderLevel * 2 - i.onHand))
  const forSales = Math.ceil(Math.max(0, i.sold30))
  return forSales > toRestock
    ? { qty: forSales, basis: 'recent_sales' }
    : { qty: toRestock, basis: 'restock_level' }
}

export function buildReorderLines(items: readonly ReorderItem[]): ReorderLine[] {
  return items
    .map((i) => {
      const { qty, basis } = suggestQuantity(i)
      return {
        name: i.name,
        unit: i.unit,
        qty,
        estCost: i.costPrice && i.costPrice > 0 ? Math.round(qty * i.costPrice * 100) / 100 : null,
        basis,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

const rand = (n: number) => `R${Math.round(n).toLocaleString('en-ZA')}`

/** Plain text the owner can paste into WhatsApp or email to the supplier. Shows at most `max` lines. */
export function orderDraftText(businessName: string, lines: readonly ReorderLine[], max = 10): string {
  if (!lines.length) return ''
  const shown = lines.slice(0, max)
  const body = shown
    .map((l) => `• ${l.name} × ${l.qty}${l.unit && l.unit !== 'each' ? ` ${l.unit}` : ''}`)
    .join('\n')
  const more = lines.length > max ? `\n…and ${lines.length - max} more items` : ''
  const costed = lines.filter((l) => l.estCost !== null)
  const est = costed.length ? `\nEstimated cost: about ${rand(costed.reduce((s, l) => s + (l.estCost ?? 0), 0))}${costed.length < lines.length ? ' (items with a cost price only)' : ''}.` : ''
  return `Hi, please quote or supply the following for ${businessName}:\n${body}${more}${est}\nThank you.`
}
