import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { TopBar } from '@/components/dashboard/TopBar'
import { Card } from '@/components/ui/card'
import { redirect } from 'next/navigation'
import { InventoryTable, type ProductRow } from './InventoryTable'
import { CreateProductModal } from './CreateProductModal'
import { formatZAR } from '@/lib/format'

const money = (v: number) => formatZAR(v, { cents: true })

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

  const allItems = (rawItems || []) as ProductRow[]

  const lowStockItems = allItems.filter(
    item => Number(item.current_stock) <= Number(item.reorder_level)
  )

  const totalStockValue = allItems.reduce(
    (sum, item) => sum + Number(item.current_stock) * Number(item.cost_price || 0),
    0
  )

  const totalSellingValue = allItems.reduce(
    (sum, item) => sum + Number(item.current_stock) * Number(item.unit_price || 0),
    0
  )

  return (
    <div>
      <TopBar title="Inventory" subtitle={`${allItems.length} products`} actions={<CreateProductModal />} />
      <div className="p-6 space-y-6">

        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <p className="text-xs text-[var(--text-muted)]">Total SKUs</p>
            <p className="text-2xl font-bold text-[var(--text-primary)] mt-1">{allItems.length}</p>
          </Card>
          <Card>
            <p className="text-xs text-[var(--text-muted)]">Low Stock Alerts</p>
            <p className={`text-2xl font-bold mt-1 ${lowStockItems.length > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
              {lowStockItems.length}
            </p>
          </Card>
          <Card>
            <p className="text-xs text-[var(--text-muted)]">Stock Value (Cost)</p>
            <p className="text-2xl font-bold text-[var(--text-primary)] mt-1">{money(totalStockValue)}</p>
          </Card>
          <Card>
            <p className="text-xs text-[var(--text-muted)]">Stock Value (Retail)</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1">{money(totalSellingValue)}</p>
          </Card>
        </div>

        {/* Low stock alerts */}
        {lowStockItems.length > 0 && (
          <Card>
            <h3 className="font-semibold mb-3" style={{ color: '#F87171' }}>
              Low Stock Alerts — {lowStockItems.length} item{lowStockItems.length !== 1 ? 's' : ''} at or below reorder level
            </h3>
            <div className="space-y-2">
              {lowStockItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-lg"
                  style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.25)' }}
                >
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">{item.name}</p>
                    <p className="text-xs text-[var(--text-muted)]">SKU: {item.sku || '—'} · {item.category}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold" style={{ color: '#F87171' }}>
                      {item.current_stock} {item.unit}
                    </p>
                    <p className="text-xs text-[var(--text-dim)]">reorder at {item.reorder_level}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Inventory table */}
        <InventoryTable rows={allItems} />
      </div>
    </div>
  )
}
