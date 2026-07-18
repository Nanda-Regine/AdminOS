import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { TopBar } from '@/components/dashboard/TopBar'
import { BillingGateOverlay } from '@/components/ui/BillingGateOverlay'
import { hasAddon } from '@/lib/billing/gates'
import { redirect } from 'next/navigation'
import { Radio, Send, CheckCheck, Eye } from 'lucide-react'
import { ReachCampaignTable, type Campaign } from './ReachCampaignTable'

function pct(num: number, denom: number) {
  if (!denom) return '—'
  return `${Math.round((num / denom) * 100)}%`
}

export default async function ReachPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const tenantId = user.app_metadata?.tenant_id as string
  const reachActive = await hasAddon('reach')

  const { data: campaigns = [] } = await supabaseAdmin
    .from('broadcast_campaigns')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(200)

  const list = (campaigns ?? []) as Campaign[]

  const totalCampaigns = list.length
  const totalSent      = list.reduce((s, c) => s + c.sent_count, 0)
  const totalDelivered = list.reduce((s, c) => s + c.delivered_count, 0)
  const totalRead      = list.reduce((s, c) => s + c.read_count, 0)

  return (
    <div>
      <TopBar title="Reach" subtitle="Broadcast campaigns — send WhatsApp messages to your entire audience" />
      <div className="p-6 space-y-6">

        <BillingGateOverlay requiredAddon="reach" locked={!reachActive}>
          <div className="space-y-6">

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { icon: Radio,      label: 'Campaigns',       value: totalCampaigns,              color: '#818CF8' },
                { icon: Send,       label: 'Messages Sent',   value: totalSent.toLocaleString(),  color: '#22C55E' },
                { icon: CheckCheck, label: 'Delivered',       value: pct(totalDelivered, totalSent), color: '#0EA5E9' },
                { icon: Eye,        label: 'Read Rate',       value: pct(totalRead, totalSent),   color: '#F59E0B' },
              ].map(({ icon: Icon, label, value, color }) => (
                <div key={label} className="glass rounded-2xl p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                      style={{ background: `${color}20` }}>
                      <Icon className="w-4 h-4" style={{ color }} />
                    </div>
                    <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{label}</span>
                  </div>
                  <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
                </div>
              ))}
            </div>

            {/* Campaign list */}
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4" style={{ color: 'var(--indigo-light)' }} />
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Campaigns ({list.length})
              </h3>
            </div>
            <ReachCampaignTable rows={list} />

          </div>
        </BillingGateOverlay>

      </div>
    </div>
  )
}

