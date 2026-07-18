import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { TopBar } from '@/components/dashboard/TopBar'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { redirect } from 'next/navigation'

function formatCurrency(val: number) {
  return `R${val.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default async function InventoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const tenantId = user.app_metadata?.tenant_id as string

  const { data: rawItems } = await supabaseAdmin
    .from('products')
    .select('id, tenant_id, name, sku, category, unit, current_stock, reorder_level, cost_price, unit_price, created_at')
    .eq('tenant_id', tenantId)
    .order('category')
    .order('name')

  // Map products table columns to the expected shape
  const allItems = (rawItems || []).map(item => ({
    ...item,
    quantity_on_hand: item.current_stock,
    selling_price: item.unit_price,
  }))

  const lowStockItems = allItems.filter(
    item => Number(item.quantity_on_hand) <= Number(item.reorder_level)
  )

  const totalStockValue = allItems.reduce(
    (sum, item) => sum + Number(item.quantity_on_hand) * Number(item.cost_price || 0),
    0
  )

  const totalSellingValue = allItems.reduce(
    (sum, item) => sum + Number(item.quantity_on_hand) * Number(item.selling_price || 0),
    0
  )

  return (
    <div>
      <TopBar title="Inventory" subtitle={`${allItems.length} products`} />
      <div className="p-6 space-y-6">

        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <p className="text-xs text-[var(--text-muted)]">Total SKUs</p>
            <p className="text-2xl font-bold text-[var(--text-primary)] mt-1">{allItems.length}</p>
          </Card>
          <Card>
            <p className="text-xs text-[var(--text-muted)]">Low Stock Alerts</p>
            <p className={`text-2xl font-bold mt-1 ${lowStockItems.length > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
              {lowStockItems.length}
            </p>
          </Card>
          <Card>
            <p className="text-xs text-[var(--text-muted)]">Stock Value (Cost)</p>
            <p className="text-2xl font-bold text-[var(--text-primary)] mt-1">{formatCurrency(totalStockValue)}</p>
          </Card>
          <Card>
            <p className="text-xs text-[var(--text-muted)]">Stock Value (Retail)</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{formatCurrency(totalSellingValue)}</p>
          </Card>
        </div>

        {/* Low stock alerts */}
        {lowStockItems.length > 0 && (
          <Card>
            <h3 className="font-semibold text-red-700 mb-3">
              Low Stock Alerts — {lowStockItems.length} item{lowStockItems.length !== 1 ? 's' : ''} at or below reorder level
            </h3>
            <div className="space-y-2">
              {lowStockItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 bg-red-50 border border-red-100 rounded-lg"
                >
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">{item.name}</p>
                    <p className="text-xs text-[var(--text-muted)]">SKU: {item.sku || '—'} · {item.category}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-red-600">
                      {item.quantity_on_hand} {item.unit}
                    </p>
                    <p className="text-xs text-[var(--text-dim)]">reorder at {item.reorder_level}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Inventory table */}
        <Card padding="none">
          <div className="p-5 border-b border-[var(--border)] flex items-center justify-between">
            <h3 className="font-semibold text-[var(--text-primary)]">All Products</h3>
            <span className="text-xs text-[var(--text-dim)]">Total cost value: {formatCurrency(totalStockValue)}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Name</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">SKU</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Category</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Qty</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Reorder</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Cost</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Selling</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {allItems.map((item) => {
                  const isLow = Number(item.quantity_on_hand) <= Number(item.reorder_level)
                  return (
                    <tr key={item.id} className={`hover:bg-[var(--surface-hover)] transition-colors ${isLow ? 'bg-red-50/40' : ''}`}>
                      <td className="px-5 py-3">
                        <p className="font-medium text-[var(--text-primary)]">{item.name}</p>
                      </td>
                      <td className="px-5 py-3 text-[var(--text-muted)] font-mono text-xs">{item.sku || '—'}</td>
                      <td className="px-5 py-3">
                        <Badge variant="gray">{item.category || 'Uncategorised'}</Badge>
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-[var(--text-primary)]">
                        {item.quantity_on_hand} {item.unit}
                      </td>
                      <td className="px-5 py-3 text-right text-[var(--text-dim)] text-xs">{item.reorder_level}</td>
                      <td className="px-5 py-3 text-right text-[var(--text-muted)]">
                        {formatCurrency(Number(item.cost_price || 0))}
                      </td>
                      <td className="px-5 py-3 text-right text-emerald-600">
                        {formatCurrency(Number(item.selling_price || 0))}
                      </td>
                      <td className="px-5 py-3">
                        {isLow ? (
                          <Badge variant="red">Low stock</Badge>
                        ) : (
                          <Badge variant="green">OK</Badge>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {allItems.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-center text-[var(--text-dim)]">
                      No inventory items found. Add products to start tracking stock.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  )
}
