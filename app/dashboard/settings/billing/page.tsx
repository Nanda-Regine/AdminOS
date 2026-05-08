import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { TopBar } from '@/components/dashboard/TopBar'
import { PlanBadge } from '@/components/ui/PlanBadge'
import { redirect } from 'next/navigation'
import { CheckCircle2, Zap, Phone, Radio, BookOpen, Languages, Globe, AlertTriangle } from 'lucide-react'

const PLANS = [
  {
    id:            'starter',
    name:          'Starter',
    price:         2500,
    staffRange:    '1–10 staff',
    conversations: '500/mo',
    users:         '3 users',
    whatsapp:      '1 number',
    badge:         null as string | null,
    highlight:     false,
  },
  {
    id:            'growth',
    name:          'Growth',
    price:         4500,
    staffRange:    '11–50 staff',
    conversations: '5,000/mo',
    users:         '10 users',
    whatsapp:      '3 numbers',
    badge:         'Most Popular' as string | null,
    highlight:     true,
  },
  {
    id:            'enterprise',
    name:          'Enterprise',
    price:         8500,
    staffRange:    '50+ staff',
    conversations: 'Unlimited',
    users:         'Unlimited',
    whatsapp:      'Unlimited',
    badge:         null as string | null,
    highlight:     false,
  },
  {
    id:            'white_label',
    name:          'White Label',
    price:         14999,
    staffRange:    'Resellers',
    conversations: 'Unlimited',
    users:         'Unlimited',
    whatsapp:      'Unlimited',
    badge:         'Reseller' as string | null,
    highlight:     false,
  },
]

const ADDONS = [
  {
    id:    'ring',
    name:  'Ring',
    price: 999,
    icon:  Phone,
    desc:  'AI voice agent via Twilio. Answers calls, takes messages, transfers to staff.',
    color: '#818CF8',
  },
  {
    id:    'reach',
    name:  'Reach',
    price: 499,
    icon:  Radio,
    desc:  'Broadcast campaigns to your contact list via WhatsApp. Audience filters, delivery tracking.',
    color: '#22C55E',
  },
  {
    id:    'sage',
    name:  'Sage Sync',
    price: 299,
    icon:  BookOpen,
    desc:  'Bidirectional sync with Sage Accounting. Contacts, invoices, and payments stay in perfect sync.',
    color: '#F59E0B',
  },
  {
    id:    'languages',
    name:  'Languages',
    price: 199,
    icon:  Languages,
    desc:  'Automatic language detection and response in all 11 official South African languages.',
    color: '#EC4899',
  },
  {
    id:    'client_portal',
    name:  'Client Portal',
    price: 599,
    icon:  Globe,
    desc:  'Magic-link self-service portal. Clients view invoices, pay online, submit documents.',
    color: '#0EA5E9',
  },
]

const PLAN_FEATURES = [
  'All 6 AI agents',
  'WhatsApp Cloud API',
  'Invoicing & debt recovery',
  'Staff wellness monitoring',
  'POPIA compliance tools',
  'Analytics dashboard',
]

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; cancelled?: string }>
}) {
  const { success, cancelled } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const tenantId = user.user_metadata?.tenant_id as string

  const [tenantRes, subRes, paymentRes] = await Promise.all([
    supabaseAdmin
      .from('tenants')
      .select('plan, name, created_at')
      .eq('id', tenantId)
      .single(),
    supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .maybeSingle(),
    supabaseAdmin
      .from('payment_events')
      .select('id, event_type, amount, plan, created_at, processed')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  const tenant   = tenantRes.data
  if (!tenant) redirect('/login')

  const sub         = subRes.data
  const payments    = paymentRes.data ?? []
  const currentPlan = (sub?.plan ?? tenant.plan ?? 'trial') as string

  const createdAt     = new Date(tenant.created_at)
  const trialEndsAt   = new Date(createdAt.getTime() + 14 * 24 * 60 * 60 * 1000)
  const daysRemaining = Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / 86_400_000))
  const isOnTrial     = currentPlan === 'trial'

  return (
    <div>
      <TopBar title="Billing" subtitle="Manage your AdminOS subscription and add-ons" />
      <div className="p-6 space-y-8">

        {/* Toast banners */}
        {success && (
          <div className="flex items-center gap-3 p-4 rounded-2xl"
            style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)' }}>
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" style={{ color: '#22C55E' }} />
            <p className="text-sm font-medium" style={{ color: '#22C55E' }}>
              Payment successful! Your plan has been activated.
            </p>
          </div>
        )}
        {cancelled && (
          <div className="flex items-center gap-3 p-4 rounded-2xl"
            style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}>
            <AlertTriangle className="w-5 h-5 flex-shrink-0" style={{ color: '#F59E0B' }} />
            <p className="text-sm font-medium" style={{ color: '#F59E0B' }}>
              Payment cancelled. Your plan has not changed.
            </p>
          </div>
        )}

        {/* Current plan card */}
        <div className="glass rounded-2xl p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2"
                style={{ color: 'var(--text-muted)' }}>Current Plan</p>
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-2xl font-bold capitalize" style={{ color: 'var(--text-primary)' }}>
                  {currentPlan === 'trial' ? 'Free Trial' : currentPlan.replace('_', ' ')}
                </h2>
                <PlanBadge plan={currentPlan} />
              </div>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {isOnTrial
                  ? `Trial expires ${trialEndsAt.toLocaleDateString('en-ZA')} — ${daysRemaining} days remaining`
                  : sub
                    ? `Active since ${new Date(sub.created_at ?? tenant.created_at).toLocaleDateString('en-ZA')}`
                    : `Member since ${createdAt.toLocaleDateString('en-ZA')}`}
              </p>
            </div>
            {isOnTrial && (
              <div className="px-4 py-2 rounded-xl text-sm font-semibold"
                style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B' }}>
                {daysRemaining}d left
              </div>
            )}
          </div>
        </div>

        {/* Plan cards */}
        <section>
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
            Choose a Plan
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {PLANS.map((plan) => {
              const isCurrent = currentPlan === plan.id
              return (
                <div key={plan.id} className="relative rounded-2xl p-5 flex flex-col"
                  style={{
                    background: plan.highlight
                      ? 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(139,92,246,0.1) 100%)'
                      : 'var(--surface-1)',
                    border: plan.highlight
                      ? '1px solid rgba(99,102,241,0.4)'
                      : isCurrent
                        ? '1px solid rgba(34,197,94,0.4)'
                        : '1px solid var(--border)',
                  }}>
                  {plan.badge && (
                    <span className="absolute -top-3 left-4 text-xs font-bold px-3 py-0.5 rounded-full"
                      style={{
                        background: plan.highlight ? 'var(--indigo)' : 'rgba(201,168,76,0.9)',
                        color: '#fff',
                      }}>
                      {plan.badge}
                    </span>
                  )}

                  <p className="font-bold text-lg mb-1" style={{ color: 'var(--text-primary)' }}>{plan.name}</p>
                  <div className="mb-4">
                    <span className="text-3xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
                      R{plan.price.toLocaleString()}
                    </span>
                    <span className="text-sm" style={{ color: 'var(--text-muted)' }}>/mo</span>
                  </div>

                  <ul className="space-y-2 text-sm mb-5 flex-1" style={{ color: 'var(--text-secondary)' }}>
                    <li>👥 {plan.staffRange}</li>
                    <li>💬 {plan.conversations} AI convos</li>
                    <li>📱 {plan.whatsapp} WhatsApp</li>
                    <li>👤 {plan.users}</li>
                    {PLAN_FEATURES.map(f => (
                      <li key={f} className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#22C55E' }} />
                        {f}
                      </li>
                    ))}
                  </ul>

                  {isCurrent ? (
                    <div className="py-2 text-center text-sm font-medium rounded-xl"
                      style={{ background: 'rgba(34,197,94,0.15)', color: '#22C55E' }}>
                      Current plan
                    </div>
                  ) : (
                    <a href={`/api/billing/checkout?plan=${plan.id}`}
                      className="py-2 text-center text-sm font-semibold rounded-xl block transition-all"
                      style={{
                        background: plan.highlight ? 'var(--indigo)' : 'var(--surface-2)',
                        color: plan.highlight ? '#fff' : 'var(--text-primary)',
                        border: plan.highlight ? 'none' : '1px solid var(--border)',
                      }}>
                      {currentPlan === 'trial' ? 'Start plan' : 'Switch plan'}
                    </a>
                  )}
                </div>
              )
            })}
          </div>
          <p className="text-xs mt-3 text-center" style={{ color: 'var(--text-dim)' }}>
            All plans billed monthly in ZAR · Cancel anytime · Secured by PayFast
          </p>
        </section>

        {/* Add-on cards */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4" style={{ color: 'var(--indigo-light)' }} />
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Add-ons</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {ADDONS.map((addon) => {
              const addonKey = `addon_${addon.id}` as keyof typeof sub
              const isActive = sub?.[addonKey] === true
              const expiresKey = `addon_${addon.id}_expires_at` as keyof typeof sub
              const expiresAt  = sub?.[expiresKey] as string | null | undefined
              const Icon = addon.icon

              return (
                <div key={addon.id} className="glass rounded-2xl p-5"
                  style={{
                    border: isActive
                      ? `1px solid ${addon.color}40`
                      : '1px solid var(--border)',
                  }}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ background: `${addon.color}20` }}>
                        <Icon className="w-5 h-5" style={{ color: addon.color }} />
                      </div>
                      <div>
                        <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{addon.name}</p>
                        <p className="text-xs" style={{ color: addon.color }}>
                          R{addon.price}/mo
                        </p>
                      </div>
                    </div>
                    {isActive && (
                      <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(34,197,94,0.15)', color: '#22C55E' }}>
                        <CheckCircle2 className="w-3 h-3" />
                        Active
                      </span>
                    )}
                  </div>

                  <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>{addon.desc}</p>

                  {isActive ? (
                    <div>
                      {expiresAt && (
                        <p className="text-xs mb-3" style={{ color: 'var(--text-dim)' }}>
                          Renews {new Date(expiresAt).toLocaleDateString('en-ZA')}
                        </p>
                      )}
                      <div className="py-2 text-center text-xs font-medium rounded-xl"
                        style={{ background: 'rgba(34,197,94,0.1)', color: '#22C55E' }}>
                        Add-on active
                      </div>
                    </div>
                  ) : (
                    <a href={`/api/billing/checkout?addon=${addon.id}`}
                      className="flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium transition-all"
                      style={{ background: `${addon.color}15`, color: addon.color, border: `1px solid ${addon.color}30` }}>
                      <Zap className="w-3.5 h-3.5" />
                      Add for R{addon.price}/mo
                    </a>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {/* Payment history */}
        {payments.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
              Payment History
            </h3>
            <div className="glass rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
                    {['Date', 'Event', 'Plan', 'Amount', 'Status'].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide"
                        style={{ color: 'var(--text-muted)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td className="px-5 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                        {new Date(p.created_at).toLocaleDateString('en-ZA')}
                      </td>
                      <td className="px-5 py-3" style={{ color: 'var(--text-secondary)' }}>
                        {p.event_type.replace(/_/g, ' ')}
                      </td>
                      <td className="px-5 py-3">
                        {p.plan ? <PlanBadge plan={p.plan} /> : <span style={{ color: 'var(--text-dim)' }}>—</span>}
                      </td>
                      <td className="px-5 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>
                        {p.amount ? `R${Number(p.amount).toLocaleString()}` : '—'}
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full"
                          style={{
                            background: p.processed ? 'rgba(34,197,94,0.15)' : 'rgba(148,163,184,0.12)',
                            color:      p.processed ? '#22C55E' : '#94A3B8',
                          }}>
                          {p.processed ? 'Processed' : 'Pending'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

      </div>
    </div>
  )
}
