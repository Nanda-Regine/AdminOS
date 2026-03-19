import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { TopBar } from '@/components/dashboard/TopBar'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { redirect } from 'next/navigation'
import Link from 'next/link'

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

  const tenantId = user.user_metadata?.tenant_id as string

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
          <h3 className="font-semibold text-gray-900 mb-4">Business Profile</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Business name</p>
              <p className="font-medium text-gray-900 mt-0.5">{tenant.name}</p>
            </div>
            <div>
              <p className="text-gray-500">Plan</p>
              <p className="mt-0.5"><Badge variant="blue">{tenant.plan}</Badge></p>
            </div>
            <div>
              <p className="text-gray-500">WhatsApp number</p>
              <p className="font-medium text-gray-900 mt-0.5">{tenant.whatsapp_number || 'Not connected'}</p>
            </div>
            <div>
              <p className="text-gray-500">Business type</p>
              <p className="font-medium text-gray-900 mt-0.5 capitalize">{tenant.business_type || 'Not set'}</p>
            </div>
            <div>
              <p className="text-gray-500">Country</p>
              <p className="font-medium text-gray-900 mt-0.5">{tenant.country}</p>
            </div>
            <div>
              <p className="text-gray-500">Timezone</p>
              <p className="font-medium text-gray-900 mt-0.5">{tenant.timezone}</p>
            </div>
          </div>
        </Card>

        {/* Bot training */}
        <Card>
          <h3 className="font-semibold text-gray-900 mb-4">Bot Training</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Business Policies</label>
              <textarea
                className="w-full text-sm border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                rows={3}
                defaultValue={tenant.settings?.policies || ''}
                placeholder="Enter your business policies, procedures, and rules..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">FAQs</label>
              <textarea
                className="w-full text-sm border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                rows={4}
                defaultValue={tenant.settings?.faqs || ''}
                placeholder="Q: What are your hours?\nA: Monday-Friday 8am-5pm&#10;&#10;Q: Do you offer delivery?&#10;A: Yes, within 30km..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tone</label>
              <select className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500" defaultValue={tenant.settings?.tone || 'warm'}>
                <option value="formal">Formal & Professional</option>
                <option value="warm">Warm & Friendly</option>
                <option value="casual">Casual</option>
              </select>
            </div>
          </div>
          <div className="mt-4">
            <button className="bg-emerald-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors">
              Save & Retrain Bot
            </button>
          </div>
        </Card>

        {/* Integrations */}
        <Card>
          <h3 className="font-semibold text-gray-900 mb-4">Integrations</h3>
          <div className="space-y-3">
            {integrations.map((integration) => {
              const isConnected = activeIntegrations.includes(integration.id)
              return (
                <div key={integration.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{integration.icon}</span>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{integration.label}</p>
                      <p className="text-xs text-gray-400">{integration.description}</p>
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
          <h3 className="font-semibold text-gray-900 mb-4">Account & Compliance</h3>
          <div className="space-y-2">
            {[
              { href: '/dashboard/settings/billing',    icon: '💳', label: 'Billing & Plans',         desc: 'Manage your subscription, view usage, upgrade plan' },
              { href: '/dashboard/settings/referrals',  icon: '🎁', label: 'Referral Program',        desc: 'Earn a free month for every business you refer' },
              { href: '/dashboard/settings/compliance', icon: '🛡️', label: 'POPI Compliance Centre', desc: 'Data register, rights management, deletion requests' },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{item.icon}</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{item.label}</p>
                    <p className="text-xs text-gray-400">{item.desc}</p>
                  </div>
                </div>
                <span className="text-gray-400 text-sm">→</span>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
