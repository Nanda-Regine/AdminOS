import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { TopBar } from '@/components/dashboard/TopBar'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { BotTrainingForm } from './BotTrainingForm'

const integrations = [
  { id: 'gmail', label: 'Gmail', icon: '✉️', description: 'Sync inbound emails' },
  { id: 'google_calendar', label: 'Google Calendar', icon: '📅', description: 'Leave and appointment sync' },
  { id: 'google_drive', label: 'Google Drive', icon: '📁', description: 'Document storage' },
  { id: 'xero', label: 'Xero', icon: '📊', description: 'Invoice sync' },
  { id: 'payfast', label: 'PayFast', icon: '💳', description: 'SA payment processing' },
]

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const tenantId = user.app_metadata?.tenant_id as string

  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('*')
    .eq('id', tenantId)
    .single()

  if (!tenant) redirect('/login')

  const activeIntegrations = tenant.settings?.integrations || []

  return (
    <div>
      <TopBar
        title="Settings"
        actions={
          <Link href="/dashboard/settings/onboarding" className="text-sm text-emerald-600 hover:underline">
            Setup wizard →
          </Link>
        }
      />
      <div className="p-6 space-y-6">

        {/* Business profile */}
        <Card>
          <h3 className="font-semibold text-[var(--text-primary)] mb-4">Business Profile</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-[var(--text-muted)]">Business name</p>
              <p className="font-medium text-[var(--text-primary)] mt-0.5">{tenant.name}</p>
            </div>
            <div>
              <p className="text-[var(--text-muted)]">Plan</p>
              <p className="mt-0.5"><Badge variant="blue">{tenant.plan}</Badge></p>
            </div>
            <div>
              <p className="text-[var(--text-muted)]">WhatsApp number</p>
              <p className="font-medium text-[var(--text-primary)] mt-0.5">{tenant.whatsapp_number || 'Not connected'}</p>
            </div>
            <div>
              <p className="text-[var(--text-muted)]">Business type</p>
              <p className="font-medium text-[var(--text-primary)] mt-0.5 capitalize">{tenant.business_type || 'Not set'}</p>
            </div>
            <div>
              <p className="text-[var(--text-muted)]">Country</p>
              <p className="font-medium text-[var(--text-primary)] mt-0.5">{tenant.country}</p>
            </div>
            <div>
              <p className="text-[var(--text-muted)]">Timezone</p>
              <p className="font-medium text-[var(--text-primary)] mt-0.5">{tenant.timezone}</p>
            </div>
          </div>
        </Card>

        {/* Bot training */}
        <Card>
          <h3 className="font-semibold text-[var(--text-primary)] mb-4">Bot Training</h3>
          <BotTrainingForm initial={{
            policies: tenant.settings?.policies || '',
            faqs: tenant.settings?.faqs || '',
            tone: tenant.settings?.tone || 'warm',
          }} />
        </Card>

        {/* Integrations */}
        <Card>
          <h3 className="font-semibold text-[var(--text-primary)] mb-4">Integrations</h3>
          <div className="space-y-3">
            {integrations.map((integration) => {
              const isConnected = activeIntegrations.includes(integration.id)
              return (
                <div key={integration.id} className="flex items-center justify-between p-3 border border-[var(--border)] rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{integration.icon}</span>
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">{integration.label}</p>
                      <p className="text-xs text-[var(--text-dim)]">{integration.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isConnected ? (
                      <Badge variant="green">Connected</Badge>
                    ) : (
                      <button className="text-sm text-emerald-600 border border-emerald-300 px-3 py-1 rounded-lg hover:bg-emerald-50">
                        Connect
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        {/* Account links */}
        <Card>
          <h3 className="font-semibold text-[var(--text-primary)] mb-4">Account & Compliance</h3>
          <div className="space-y-2">
            {[
              { href: '/dashboard/settings/billing',    icon: '💳', label: 'Billing & Plans',         desc: 'Manage your subscription, view usage, upgrade plan' },
              { href: '/dashboard/settings/referrals',  icon: '🎁', label: 'Referral Program',        desc: 'Earn a free month for every business you refer' },
              { href: '/dashboard/settings/compliance', icon: '🛡️', label: 'POPI Compliance Centre', desc: 'Data register, rights management, deletion requests' },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center justify-between p-3 border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{item.icon}</span>
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">{item.label}</p>
                    <p className="text-xs text-[var(--text-dim)]">{item.desc}</p>
                  </div>
                </div>
                <span className="text-[var(--text-dim)] text-sm">→</span>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
