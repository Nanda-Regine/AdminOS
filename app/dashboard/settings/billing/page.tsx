import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { TopBar } from '@/components/dashboard/TopBar'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { redirect } from 'next/navigation'

const PLANS = [
  {
    id:           'starter',
    name:         'Starter',
    price:        799,
    conversations: '500 / month',
    users:        '3 users',
    whatsapp:     '1 number',
    storage:      '1 GB',
    highlight:    false,
    badge:        null,
  },
  {
    id:           'business',
    name:         'Business',
    price:        2499,
    conversations: '5,000 / month',
    users:        '10 users',
    whatsapp:     '3 numbers',
    storage:      '10 GB',
    highlight:    true,
    badge:        'Most popular',
  },
  {
    id:           'enterprise',
    name:         'Enterprise',
    price:        7999,
    conversations: 'Unlimited',
    users:        'Unlimited',
    whatsapp:     'Unlimited',
    storage:      '100 GB',
    highlight:    false,
    badge:        null,
  },
  {
    id:           'white_label',
    name:         'White Label',
    price:        14999,
    conversations: 'Unlimited',
    users:        'Unlimited',
    whatsapp:     'Unlimited',
    storage:      'Unlimited',
    highlight:    false,
    badge:        'Reseller',
  },
]

export default async function BillingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const tenantId = user.user_metadata?.tenant_id as string

  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('plan, name, created_at')
    .eq('id', tenantId)
    .single()

  if (!tenant) redirect('/login')

  const currentPlan = tenant.plan || 'trial'

  // Compute trial days remaining (14-day trial from account creation)
  const createdAt      = new Date(tenant.created_at)
  const trialEndsAt    = new Date(createdAt.getTime() + 14 * 24 * 60 * 60 * 1000)
  const daysRemaining  = Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / 86_400_000))
  const isOnTrial      = currentPlan === 'starter' && daysRemaining > 0

  return (
    <div>
      <TopBar title="Billing" subtitle="Manage your AdminOS subscription" />
      <div className="p-6 space-y-6">

        {/* Current plan status */}
        <Card>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Current Plan</p>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold text-gray-900 capitalize">{currentPlan}</p>
                {isOnTrial && <Badge variant="yellow">Trial — {daysRemaining} days left</Badge>}
                {!isOnTrial && currentPlan !== 'trial' && <Badge variant="green">Active</Badge>}
              </div>
              <p className="text-sm text-gray-500 mt-1">
                {isOnTrial
                  ? `Your free trial ends ${trialEndsAt.toLocaleDateString('en-ZA')}. Subscribe to keep access.`
                  : `Member since ${createdAt.toLocaleDateString('en-ZA')}`}
              </p>
            </div>
            <span className="text-3xl">📋</span>
          </div>
        </Card>

        {/* Plan comparison */}
        <div>
          <h3 className="font-semibold text-gray-900 mb-4">Choose a Plan</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {PLANS.map((plan) => {
              const isCurrent = currentPlan === plan.id
              return (
                <div
                  key={plan.id}
                  className={`relative rounded-xl border p-5 flex flex-col ${
                    plan.highlight
                      ? 'border-emerald-400 bg-emerald-50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  {plan.badge && (
                    <span className={`absolute -top-2.5 left-4 text-xs font-bold px-2 py-0.5 rounded-full ${
                      plan.highlight ? 'bg-emerald-600 text-white' : 'bg-gray-700 text-white'
                    }`}>
                      {plan.badge}
                    </span>
                  )}

                  <p className="font-bold text-gray-900 text-lg">{plan.name}</p>
                  <div className="my-3">
                    <span className="text-3xl font-extrabold text-gray-900">R{plan.price.toLocaleString()}</span>
                    <span className="text-gray-400 text-sm"> / month</span>
                  </div>

                  <ul className="space-y-1.5 text-sm text-gray-600 mb-5 flex-1">
                    <li>💬 {plan.conversations}</li>
                    <li>👥 {plan.users}</li>
                    <li>📱 {plan.whatsapp} WhatsApp</li>
                    <li>📁 {plan.storage} storage</li>
                    <li>🤖 All AI agents</li>
                    <li>🛡️ POPI compliant</li>
                  </ul>

                  {isCurrent ? (
                    <div className="w-full py-2 text-center text-sm font-medium text-emerald-600 bg-emerald-100 rounded-lg">
                      Current plan
                    </div>
                  ) : (
                    <a
                      href={`/api/billing/checkout?plan=${plan.id}`}
                      className={`w-full py-2 text-center text-sm font-medium rounded-lg transition-colors block ${
                        plan.highlight
                          ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                          : 'bg-gray-900 text-white hover:bg-gray-700'
                      }`}
                    >
                      {currentPlan === 'trial' || currentPlan === 'starter' ? 'Subscribe' : 'Switch plan'}
                    </a>
                  )}
                </div>
              )
            })}
          </div>
          <p className="text-xs text-gray-400 mt-3 text-center">
            All plans billed monthly in ZAR. Cancel anytime. Powered by PayFast.
          </p>
        </div>

        {/* Usage meter */}
        <Card>
          <h3 className="font-semibold text-gray-900 mb-4">Usage This Month</h3>
          <p className="text-sm text-gray-500">
            Your current usage is tracked in real time. View detailed stats in the{' '}
            <a href="/dashboard/analytics" className="text-emerald-600 hover:underline">Analytics</a> page.
          </p>
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
            <p className="font-medium mb-1">💡 Usage tip</p>
            <p>
              FAQ-style responses served from cache don&apos;t count toward your AI call limit.
              Enable detailed FAQs in Settings → Bot Training to maximise cache hits.
            </p>
          </div>
        </Card>

      </div>
    </div>
  )
}
