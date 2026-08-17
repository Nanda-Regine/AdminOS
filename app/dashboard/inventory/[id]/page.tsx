import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { TopBar } from '@/components/dashboard/TopBar'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Package, History } from 'lucide-react'
import { formatZAR } from '@/lib/format'
import { RecordTransactionModal } from './RecordTransactionModal'

type Product = {
  id:            string
  name:          string
  sku:           string | null
  category:      string | null
  unit:          string | null
  current_stock: number
  reorder_level: number
  cost_price:    number | null
  unit_price:    number | null
  created_at:    string
}

type Transaction = {
  id:                string
  transaction_type:  string
  quantity:          number
  unit_cost:         number | null
  reference:         string | null
  notes:             string | null
  created_at:        string
}

const TX_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  receive:  { bg: 'rgba(34,197,94,0.15)',  text: '#22C55E', label: 'Received' },
  return:   { bg: 'rgba(34,197,94,0.15)',  text: '#22C55E', label: 'Returned' },
  adjust:   { bg: 'rgba(99,102,241,0.15)', text: '#818CF8', label: 'Adjusted' },
  sell:     { bg: 'rgba(239,68,68,0.15)',  text: '#F87171', label: 'Sold' },
  damage:   { bg: 'rgba(239,68,68,0.15)',  text: '#F87171', label: 'Damaged' },
  transfer: { bg: 'rgba(245,158,11,0.15)', text: '#F59E0B', label: 'Transferred' },
}

const money = (v: number | null) => formatZAR(v, { cents: true })

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const tenantId = user.app_metadata?.tenant_id as string

  const [productRes, txRes] = await Promise.all([
    supabaseAdmin
      .from('products')
      .select('id, name, sku, category, unit, current_stock, reorder_level, cost_price, unit_price, created_at')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single(),
    supabaseAdmin
      .from('inventory_transactions')
      .select('id, transaction_type, quantity, unit_cost, reference, notes, created_at')
      .eq('tenant_id', tenantId)
      .eq('product_id', id)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  if (!productRes.data) notFound()

  const product      = productRes.data as Product
  const transactions = (txRes.data ?? []) as Transaction[]
  const isLow         = Number(product.current_stock) <= Number(product.reorder_level)
  const stockValue    = Number(product.current_stock) * Number(product.cost_price || 0)
  const retailValue   = Number(product.current_stock) * Number(product.unit_price || 0)
  const marginPct     = product.unit_price && product.cost_price
    ? Math.round(((Number(product.unit_price) - Number(product.cost_price)) / Number(product.unit_price)) * 100)
    : null

  return (
    <div>
      <TopBar title={product.name} subtitle="Product detail & stock movement" />
      <div className="p-4 md:p-6 space-y-6">

        <Link href="/dashboard/inventory"
          className="inline-flex items-center gap-2 text-sm transition-colors"
          style={{ color: 'var(--text-muted)' }}>
          <ArrowLeft className="w-4 h-4" />
          Back to Inventory
        </Link>

        {/* Summary */}
        <div className="glass rounded-2xl p-6">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--surface-2)' }}>
                <Package className="w-6 h-6" style={{ color: 'var(--indigo-light)' }} />
              </div>
              <div>
                <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{product.name}</h2>
                <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  SKU: {product.sku || '—'} · {product.category || 'Uncategorised'}
                </p>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-2"
                  style={{
                    background: isLow ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
                    color: isLow ? '#F87171' : '#22C55E',
                  }}>
                  {isLow ? 'Low stock' : 'In stock'}
                </span>
              </div>
            </div>
            <RecordTransactionModal productId={product.id} unit={product.unit} currentStock={product.current_stock} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 pt-6" style={{ borderTop: '1px solid var(--border)' }}>
            <div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Current Stock</p>
              <p className="text-xl font-bold mt-0.5" style={{ color: isLow ? '#F87171' : 'var(--text-primary)' }}>
                {product.current_stock} {product.unit}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-dim)' }}>reorder at {product.reorder_level}</p>
            </div>
            <div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Cost / Selling</p>
              <p className="text-sm font-semibold mt-0.5" style={{ color: 'var(--text-primary)' }}>
                {money(product.cost_price)} → {money(product.unit_price)}
              </p>
              {marginPct !== null && (
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-dim)' }}>{marginPct}% margin</p>
              )}
            </div>
            <div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Stock Value (Cost)</p>
              <p className="text-sm font-semibold mt-0.5" style={{ color: 'var(--text-primary)' }}>{money(stockValue)}</p>
            </div>
            <div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Stock Value (Retail)</p>
              <p className="text-sm font-semibold mt-0.5" style={{ color: '#34D399' }}>{money(retailValue)}</p>
            </div>
          </div>
        </div>

        {/* Transaction history */}
        <div className="glass rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
            <History className="w-4 h-4" style={{ color: 'var(--indigo-light)' }} />
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Stock Movement ({transactions.length})
            </h3>
          </div>
          {transactions.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                No movement recorded yet — receipts, sales and adjustments will show up here.
              </p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {transactions.map(tx => {
                const c = TX_COLORS[tx.transaction_type] ?? TX_COLORS.adjust
                const positive = tx.quantity >= 0
                return (
                  <div key={tx.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                        style={{ background: c.bg, color: c.text }}>
                        {c.label}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>
                          {tx.reference || tx.notes || '—'}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-dim)' }}>
                          {new Date(tx.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
                          {tx.unit_cost ? ` · ${money(tx.unit_cost)}/unit` : ''}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold flex-shrink-0" style={{ color: positive ? '#22C55E' : '#F87171' }}>
                      {positive ? '+' : ''}{tx.quantity} {product.unit}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
