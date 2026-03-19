import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { TopBar } from '@/components/dashboard/TopBar'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { redirect } from 'next/navigation'

const APP_URL = 'https://adminos.co.za'

export default async function ReferralsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const tenantId = user.user_metadata?.tenant_id as string

  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('slug, name, plan')
    .eq('id', tenantId)
    .single()

  if (!tenant) redirect('/login')

  // Referral link uses tenant slug as the code
  const referralLink = `${APP_URL}/signup?ref=${tenant.slug}`

  // Count tenants referred by this slug (tenants where referral_code = slug)
  // Using audit_log to track referrals if referral_code column doesn't exist yet
  const { data: referralLogs } = await supabaseAdmin
    .from('audit_log')
    .select('metadata, created_at')
    .eq('action', 'tenant.created_via_referral')
    .filter('metadata->>referrer_slug', 'eq', tenant.slug)
    .order('created_at', { ascending: false })

  const referrals = referralLogs || []
  const converted = referrals.filter((r) => r.metadata && (r.metadata as Record<string, unknown>).subscribed === true)
  const rewardMonths = converted.length // 1 free month per converted referral

  return (
    <div>
      <TopBar title="Referrals" subtitle="Earn a free month for every business you refer" />
      <div className="p-6 space-y-6">

        {/* Reward summary */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <p className="text-sm text-gray-500">Businesses referred</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{referrals.length}</p>
          </Card>
          <Card>
            <p className="text-sm text-gray-500">Subscribed (converted)</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{converted.length}</p>
          </Card>
          <Card>
            <p className="text-sm text-gray-500">Free months earned</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{rewardMonths}</p>
          </Card>
        </div>

        {/* Referral link */}
        <Card>
          <h3 className="font-semibold text-gray-900 mb-2">Your Referral Link</h3>
          <p className="text-sm text-gray-500 mb-4">
            Share this link with other South African businesses. When they sign up and subscribe,
            you both get 1 free month automatically.
          </p>
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg p-3">
            <p className="text-sm font-mono text-gray-700 flex-1 break-all">{referralLink}</p>
            <div className="shrink-0 flex gap-2">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`Hi! I've been using AdminOS to automate my business admin and it's brilliant. Try it free: ${referralLink}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition-colors"
              >
                Share on WhatsApp
              </a>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Your referral code is: <strong>{tenant.slug}</strong>
          </p>
        </Card>

        {/* How it works */}
        <Card>
          <h3 className="font-semibold text-gray-900 mb-4">How It Works</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { step: '1', title: 'Share your link', desc: 'Send your referral link to any business that could benefit from AdminOS.', icon: '🔗' },
              { step: '2', title: 'They sign up',    desc: 'They use your link to sign up. They get a free 14-day trial automatically.', icon: '✍️' },
              { step: '3', title: 'Both get rewarded', desc: 'When they subscribe to any paid plan, you both get 1 month free added to your account.', icon: '🎁' },
            ].map((item) => (
              <div key={item.step} className="text-center p-4 bg-gray-50 rounded-xl">
                <span className="text-3xl">{item.icon}</span>
                <p className="text-xs font-bold text-emerald-600 uppercase tracking-wide mt-2 mb-1">Step {item.step}</p>
                <p className="text-sm font-semibold text-gray-900 mb-1">{item.title}</p>
                <p className="text-xs text-gray-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Referral history */}
        {referrals.length > 0 && (
          <Card padding="none">
            <div className="p-5 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Referral History</h3>
            </div>
            <div className="divide-y divide-gray-50">
              {referrals.map((log, i) => {
                const meta = (log.metadata || {}) as Record<string, unknown>
                const subscribed = meta.subscribed === true
                return (
                  <div key={i} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{String(meta.business_name || 'Business')}</p>
                      <p className="text-xs text-gray-400">
                        Signed up {new Date(log.created_at).toLocaleDateString('en-ZA')}
                      </p>
                    </div>
                    <Badge variant={subscribed ? 'green' : 'yellow'}>
                      {subscribed ? 'Subscribed ✓' : 'Trial'}
                    </Badge>
                  </div>
                )
              })}
            </div>
          </Card>
        )}

      </div>
    </div>
  )
}
