export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireSuperAdmin } from '@/lib/auth/context'
import { getUsage } from '@/lib/billing/usage'

interface Props {
  params: Promise<{ tenantId: string }>
}

export default async function OperatorTenantPage({ params }: Props) {
  // Gated on the admins table via the one super-admin gate (see /operator).
  if (!await requireSuperAdmin()) notFound()

  const { tenantId } = await params

  const [tenantRes, subRes, staffRes, convRes, invoiceRes] = await Promise.all([
    supabaseAdmin.from('tenants').select('*').eq('id', tenantId).single(),
    supabaseAdmin.from('subscriptions').select('*').eq('tenant_id', tenantId).maybeSingle(),
    supabaseAdmin.from('staff').select('id', { count: 'exact' }).eq('tenant_id', tenantId),
    supabaseAdmin.from('conversations').select('id', { count: 'exact' }).eq('tenant_id', tenantId).eq('status', 'open'),
    supabaseAdmin.from('invoices').select('amount').eq('tenant_id', tenantId).in('status', ['unpaid', 'partial', 'overdue']),
  ])

  if (!tenantRes.data) notFound()

  const tenant = tenantRes.data as Record<string, unknown>
  const sub    = subRes.data as Record<string, unknown> | null
  const plan   = (sub?.plan ?? tenant.plan ?? 'trial') as string

  const usage        = await getUsage(tenantId).catch(() => 0)
  const totalOverdue = (invoiceRes.data ?? []).reduce((s, i) => s + Number((i as { amount: number }).amount || 0), 0)

  const statCards = [
    { label: 'Plan',            value: plan },
    { label: 'Status',         value: (sub?.status ?? (tenant.active ? 'active' : 'inactive')) as string },
    { label: 'Staff',           value: String(staffRes.count ?? 0) },
    { label: 'Open Convos',     value: String(convRes.count ?? 0) },
    { label: 'Overdue Debt',    value: `R${totalOverdue.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}` },
    { label: 'Monthly Usage',   value: String(usage) },
  ]

  const addons = [
    { key: 'addon_ring',          label: 'Ring' },
    { key: 'addon_reach',         label: 'Reach' },
    { key: 'addon_client_portal', label: 'Client Portal' },
    { key: 'addon_language_pack', label: 'Language Pack' },
  ]

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link href="/operator" className="text-xs text-white/40 hover:text-white/70">← All Tenants</Link>
          <h1 className="text-2xl font-bold mt-2">{tenant.name as string}</h1>
          <p className="text-white/40 text-sm">{tenantId}</p>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-8">
          {statCards.map(card => (
            <div key={card.label} className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs text-white/40 uppercase tracking-wide">{card.label}</p>
              <p className="text-lg font-bold mt-1">{card.value}</p>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 mb-6">
          <h2 className="text-sm font-medium text-white/60 uppercase tracking-wide mb-4">Add-ons</h2>
          <div className="flex flex-wrap gap-3">
            {addons.map(addon => {
              const active = sub?.[addon.key] === true
              return (
                <span
                  key={addon.key}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                    active
                      ? 'bg-indigo-500/30 text-indigo-300 border border-indigo-500/50'
                      : 'bg-white/5 text-white/30 border border-white/10'
                  }`}
                >
                  {active ? '✓ ' : ''}{addon.label}
                </span>
              )
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-sm font-medium text-white/60 uppercase tracking-wide mb-4">Tenant Details</h2>
          <dl className="space-y-2">
            {(['email', 'phone', 'industry', 'city', 'whatsapp_number_id', 'created_at'] as const).map(field => {
              const val = tenant[field]
              if (val == null) return null
              return (
                <div key={field} className="flex gap-4">
                  <dt className="text-xs text-white/40 w-36 flex-shrink-0 capitalize">{field.replace(/_/g, ' ')}</dt>
                  <dd className="text-sm text-white/80">{String(val)}</dd>
                </div>
              )
            })}
          </dl>
        </div>
      </div>
    </div>
  )
}
