import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { TopBar } from '@/components/dashboard/TopBar'
import { PlanBadge } from '@/components/ui/PlanBadge'
import { redirect } from 'next/navigation'
import { CheckCircle2, Zap, Phone, Radio, BookOpen, Languages, Globe, AlertTriangle } from 'lucide-react'
import { CancelSubscriptionButton } from '@/components/billing/CancelSubscriptionButton'
import { CancelAddonButton } from '@/components/billing/CancelAddonButton'
import { ADDON_SLUGS, type AddonSlug } from '@/lib/billing/addons'

// Presentational only — icon + accent per add-on slug. Prices, names, descriptions
// and the bundle map all come from the DB catalogue (single source of truth).
const ADDON_UI: Record<AddonSlug, { icon: typeof Phone; color: string }> = {
  ring:          { icon: Phone,     color: '#818CF8' },
  reach:         { icon: Radio,     color: '#22C55E' },
  sage:          { icon: BookOpen,  color: '#F59E0B' },
  languages:     { icon: Languages, color: '#EC4899' },
  client_portal: { icon: Globe,     color: '#0EA5E9' },
}

const PLAN_FEATURES = [
  'All 6 AI agents',
  'WhatsApp Cloud API',
  'Invoicing & debt recovery',
  'Staff wellness monitoring',
  'POPIA compliance tools',
  'Analytics dashboard',
]

type PlanRow = {
  slug: string
  display_name: string
  price_monthly: number
  price_annual: number | null
  max_staff: number | null
  max_conversations_monthly: number | null
  included_addons: string[] | null
}
type AddonRow = {
  slug: string
  display_name: string
  description: string | null
  price_monthly: number
  price_annual: number | null
}

const PLAN_BADGES: Record<string, string> = { operate: 'Most Popular', partner: 'Reseller' }

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; cancelled?: string }>
}) {
  const { success, cancelled } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const tenantId = user.app_metadata?.tenant_id as string

  const [tenantRes, subRes, paymentRes, plansRes, addonsRes] = await Promise.all([
    supabaseAdmin.from('tenants').select('plan, name, created_at').eq('id', tenantId).single(),
    supabaseAdmin.from('subscriptions').select('*').eq('tenant_id', tenantId).eq('status', 'active').maybeSingle(),
    supabaseAdmin.from('payment_events').select('id, event_type, amount, plan, created_at, processed')
      .eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(10),
    supabaseAdmin.from('plan_catalogue')
      .select('slug, display_name, price_monthly, price_annual, max_staff, max_conversations_monthly, included_addons')
      .eq('active', true).order('price_monthly'),
    supabaseAdmin.from('addon_catalogue')
      .select('slug, display_name, description, price_monthly, price_annual')
      .eq('active', true).order('price_monthly'),
  ])

  const tenant = tenantRes.data
  if (!tenant) redirect('/login')

  const sub         = subRes.data
  const payments    = paymentRes.data ?? []
  const plans       = (plansRes.data ?? []) as PlanRow[]
  const addons      = (addonsRes.data ?? []) as AddonRow[]
  const currentPlan = (sub?.plan ?? tenant.plan ?? 'trial') as string

  // Add-ons the current plan bundles for free.
  const currentPlanRow  = plans.find(p => p.slug === currentPlan)
  const bundledAddons   = new Set<string>(currentPlanRow?.included_addons ?? [])

  const createdAt     = new Date(tenant.created_at)
  const trialEndsAt   = new Date(createdAt.getTime() + 14 * 24 * 60 * 60 * 1000)
  const daysRemaining = Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / 86_400_000))
  const isOnTrial     = currentPlan === 'trial'

  const zar = (n: number) => `R${Number(n).toLocaleString('en-ZA')}`

  return (
    <div>
      <TopBar title="Billing" subtitle="Manage your AdminOS subscription and add-ons" />
      <div className="p-6 space-y-8">

        {success && (
          <div className="flex items-center gap-3 p-4 rounded-2xl"
            style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)' }}>
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" style={{ color: '#22C55E' }} />
            <p className="text-sm font-medium" style={{ color: '#22C55E' }}>Payment successful! Your plan has been activated.</p>
          </div>
        )}
        {cancelled && (
          <div className="flex items-center gap-3 p-4 rounded-2xl"
            style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}>
            <AlertTriangle className="w-5 h-5 flex-shrink-0" style={{ color: '#F59E0B' }} />
            <p className="text-sm font-medium" style={{ color: '#F59E0B' }}>Payment cancelled. Your plan has not changed.</p>
          </div>
        )}

        {/* Current plan card */}
        <div className="glass rounded-2xl p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>Current Plan</p>
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
              <div className="px-4 py-2 rounded-xl text-sm font-semibold" style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B' }}>
                {daysRemaining}d left
              </div>
            )}
          </div>
          {!isOnTrial && sub && (
            <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
              <CancelSubscriptionButton />
            </div>
          )}
        </div>

        {/* Plan cards */}
        <section>
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Choose a Plan</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
            {plans.map((plan) => {
              const isCurrent = currentPlan === plan.slug
              const highlight = plan.slug === 'operate'
              const badge     = PLAN_BADGES[plan.slug] ?? null
              const included  = (plan.included_addons ?? []).filter((s): s is AddonSlug => (ADDON_SLUGS as readonly string[]).includes(s))
              return (
                <div key={plan.slug} className="relative rounded-2xl p-5 flex flex-col"
                  style={{
                    background: highlight ? 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(139,92,246,0.1) 100%)' : 'var(--surface-1)',
                    border: highlight ? '1px solid rgba(99,102,241,0.4)' : isCurrent ? '1px solid rgba(34,197,94,0.4)' : '1px solid var(--border)',
                  }}>
                  {badge && (
                    <span className="absolute -top-3 left-4 text-xs font-bold px-3 py-0.5 rounded-full"
                      style={{ background: highlight ? 'var(--indigo)' : 'rgba(201,168,76,0.9)', color: '#fff' }}>{badge}</span>
                  )}
                  <p className="font-bold text-lg mb-1" style={{ color: 'var(--text-primary)' }}>{plan.display_name}</p>
                  <div className="mb-4">
                    <span className="text-3xl font-extrabold" style={{ color: 'var(--text-primary)' }}>{zar(plan.price_monthly)}</span>
                    <span className="text-sm" style={{ color: 'var(--text-muted)' }}>/mo</span>
                  </div>
                  <ul className="space-y-2 text-sm mb-4 flex-1" style={{ color: 'var(--text-secondary)' }}>
                    <li>👥 {plan.max_staff ? `${plan.max_staff} staff` : 'Unlimited staff'}</li>
                    <li>💬 {plan.max_conversations_monthly ? `${plan.max_conversations_monthly.toLocaleString()}/mo` : 'Unlimited'} AI convos</li>
                    {PLAN_FEATURES.slice(0, 4).map(f => (
                      <li key={f} className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#22C55E' }} />{f}
                      </li>
                    ))}
                    {included.length > 0 && (
                      <li className="flex items-start gap-1.5 pt-1" style={{ color: 'var(--indigo-light)' }}>
                        <Zap className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                        <span>Includes {included.map(s => ADDON_UI[s] ? (addons.find(a => a.slug === s)?.display_name ?? s) : s).join(', ')}</span>
                      </li>
                    )}
                  </ul>
                  {isCurrent ? (
                    <div className="py-2 text-center text-sm font-medium rounded-xl" style={{ background: 'rgba(34,197,94,0.15)', color: '#22C55E' }}>Current plan</div>
                  ) : (
                    <a href={`/api/billing/checkout?plan=${plan.slug}`}
                      className="py-2 text-center text-sm font-semibold rounded-xl block transition-all"
                      style={{ background: highlight ? 'var(--indigo)' : 'var(--surface-2)', color: highlight ? '#fff' : 'var(--text-primary)', border: highlight ? 'none' : '1px solid var(--border)' }}>
                      {currentPlan === 'trial' ? 'Start plan' : 'Switch plan'}
                    </a>
                  )}
                </div>
              )
            })}
          </div>
          <p className="text-xs mt-3 text-center" style={{ color: 'var(--text-dim)' }}>
            All plans billed monthly in ZAR · Annual billing saves 2 months · Cancel anytime · Secured by Paystack
          </p>
        </section>

        {/* Add-on cards */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4" style={{ color: 'var(--indigo-light)' }} />
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Add-ons</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {addons.map((addon) => {
              const slug       = addon.slug as AddonSlug
              const ui         = ADDON_UI[slug] ?? { icon: Zap, color: '#818CF8' }
              const Icon       = ui.icon
              const isBundled  = bundledAddons.has(slug)
              const paidActive = sub?.[`addon_${slug}` as keyof typeof sub] === true
              const expiresAt  = sub?.[`addon_${slug}_expires_at` as keyof typeof sub] as string | null | undefined
              const isActive   = isBundled || paidActive

              return (
                <div key={slug} className="glass rounded-2xl p-5"
                  style={{ border: isActive ? `1px solid ${ui.color}40` : '1px solid var(--border)' }}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${ui.color}20` }}>
                        <Icon className="w-5 h-5" style={{ color: ui.color }} />
                      </div>
                      <div>
                        <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{addon.display_name}</p>
                        <p className="text-xs" style={{ color: ui.color }}>{zar(addon.price_monthly)}/mo</p>
                      </div>
                    </div>
                    {isBundled ? (
                      <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: 'rgba(99,102,241,0.15)', color: 'var(--indigo-light)' }}>
                        <CheckCircle2 className="w-3 h-3" />Included
                      </span>
                    ) : paidActive && (
                      <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: 'rgba(34,197,94,0.15)', color: '#22C55E' }}>
                        <CheckCircle2 className="w-3 h-3" />Active
                      </span>
                    )}
                  </div>

                  <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>{addon.description}</p>

                  {isBundled ? (
                    <div className="py-2 text-center text-xs font-medium rounded-xl" style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--indigo-light)' }}>
                      Included in your {currentPlan} plan
                    </div>
                  ) : paidActive ? (
                    <div>
                      {expiresAt && <p className="text-xs mb-3" style={{ color: 'var(--text-dim)' }}>Renews {new Date(expiresAt).toLocaleDateString('en-ZA')}</p>}
                      <div className="py-2 text-center text-xs font-medium rounded-xl" style={{ background: 'rgba(34,197,94,0.1)', color: '#22C55E' }}>Add-on active</div>
                      <CancelAddonButton slug={slug} />
                    </div>
                  ) : (
                    <a href={`/api/billing/checkout?addon=${slug}`}
                      className="flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium transition-all"
                      style={{ background: `${ui.color}15`, color: ui.color, border: `1px solid ${ui.color}30` }}>
                      <Zap className="w-3.5 h-3.5" />Add for {zar(addon.price_monthly)}/mo
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
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Payment History</h3>
            <div className="glass rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
                    {['Date', 'Event', 'Plan', 'Amount', 'Status'].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td className="px-5 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>{new Date(p.created_at).toLocaleDateString('en-ZA')}</td>
                      <td className="px-5 py-3" style={{ color: 'var(--text-secondary)' }}>{p.event_type.replace(/_/g, ' ')}</td>
                      <td className="px-5 py-3">{p.plan ? <PlanBadge plan={p.plan} /> : <span style={{ color: 'var(--text-dim)' }}>—</span>}</td>
                      <td className="px-5 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>{p.amount ? zar(Number(p.amount)) : '—'}</td>
                      <td className="px-5 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: p.processed ? 'rgba(34,197,94,0.15)' : 'rgba(148,163,184,0.12)', color: p.processed ? '#22C55E' : '#94A3B8' }}>
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
