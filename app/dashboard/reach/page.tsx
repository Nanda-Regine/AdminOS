import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { TopBar } from '@/components/dashboard/TopBar'
import { BillingGateOverlay } from '@/components/ui/BillingGateOverlay'
import { SendCampaignButton } from '@/components/reach/SendCampaignButton'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  Radio, Send, Users, CheckCheck, Eye, Plus, Clock,
  AlertCircle, Loader2, FileText,
} from 'lucide-react'

type Campaign = {
  id:               string
  name:             string
  status:           string
  channel:          string
  message_body:     string | null
  audience_filter:  Record<string, unknown>
  scheduled_at:     string | null
  sent_at:          string | null
  total_recipients: number
  sent_count:       number
  delivered_count:  number
  read_count:       number
  failed_count:     number
  created_at:       string
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  draft:    { label: 'Draft',    color: '#94A3B8', icon: FileText },
  sending:  { label: 'Sending',  color: '#6366F1', icon: Loader2  },
  sent:     { label: 'Sent',     color: '#22C55E', icon: CheckCheck },
  failed:   { label: 'Failed',   color: '#EF4444', icon: AlertCircle },
  scheduled:{ label: 'Scheduled',color: '#F59E0B', icon: Clock    },
}

function pct(num: number, denom: number) {
  if (!denom) return '—'
  return `${Math.round((num / denom) * 100)}%`
}

export default async function ReachPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const tenantId = user.app_metadata?.tenant_id as string

  const { data: campaigns = [] } = await supabaseAdmin
    .from('broadcast_campaigns')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(50)

  const list = (campaigns ?? []) as Campaign[]

  const totalCampaigns = list.length
  const totalSent      = list.reduce((s, c) => s + c.sent_count, 0)
  const totalDelivered = list.reduce((s, c) => s + c.delivered_count, 0)
  const totalRead      = list.reduce((s, c) => s + c.read_count, 0)

  return (
    <div>
      <TopBar title="Reach" subtitle="Broadcast campaigns — send WhatsApp messages to your entire audience" />
      <div className="p-6 space-y-6">

        <BillingGateOverlay requiredAddon="reach">
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

            {/* Campaign list header */}
            <div className="glass rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4"
                style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="flex items-center gap-2">
                  <Radio className="w-4 h-4" style={{ color: 'var(--indigo-light)' }} />
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    Campaigns ({list.length})
                  </h3>
                </div>
                <Link href="/dashboard/reach/new"
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                  style={{ background: 'var(--indigo)', color: '#fff' }}>
                  <Plus className="w-3.5 h-3.5" />
                  New Campaign
                </Link>
              </div>

              {list.length === 0 ? (
                <div className="px-6 py-16 text-center">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                    style={{ background: 'var(--indigo-muted)' }}>
                    <Radio className="w-6 h-6" style={{ color: 'var(--indigo-light)' }} />
                  </div>
                  <p className="font-medium mb-1" style={{ color: 'var(--text-primary)' }}>No campaigns yet</p>
                  <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
                    Create your first broadcast campaign to reach your entire audience.
                  </p>
                  <Link href="/dashboard/reach/new"
                    className="inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-xl"
                    style={{ background: 'var(--indigo)', color: '#fff' }}>
                    <Plus className="w-4 h-4" />
                    Create Campaign
                  </Link>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
                        {['Campaign', 'Status', 'Audience', 'Sent', 'Delivered', 'Read', 'Failed', 'Date', ''].map(h => (
                          <th key={h} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide"
                            style={{ color: 'var(--text-muted)' }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {list.map(campaign => {
                        const sc = STATUS_CONFIG[campaign.status] ?? STATUS_CONFIG.draft
                        const Icon = sc.icon
                        const filter = campaign.audience_filter as { contact_type?: string[] }
                        const audienceLabel = filter.contact_type?.length
                          ? filter.contact_type.join(', ')
                          : 'All contacts'
                        return (
                          <tr key={campaign.id} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td className="px-5 py-3.5">
                              <p className="font-medium text-xs" style={{ color: 'var(--text-primary)' }}>
                                {campaign.name}
                              </p>
                              {campaign.message_body && (
                                <p className="text-xs line-clamp-1 mt-0.5" style={{ color: 'var(--text-dim)' }}>
                                  {campaign.message_body}
                                </p>
                              )}
                            </td>
                            <td className="px-5 py-3.5">
                              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                                style={{ background: `${sc.color}20`, color: sc.color }}>
                                <Icon className="w-3 h-3" />
                                {sc.label}
                              </span>
                            </td>
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                                <Users className="w-3 h-3" />
                                <span className="capitalize">{audienceLabel}</span>
                              </div>
                            </td>
                            <td className="px-5 py-3.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                              {campaign.sent_count > 0 ? campaign.sent_count.toLocaleString() : '—'}
                            </td>
                            <td className="px-5 py-3.5 text-xs" style={{ color: '#0EA5E9' }}>
                              {pct(campaign.delivered_count, campaign.sent_count)}
                            </td>
                            <td className="px-5 py-3.5 text-xs" style={{ color: '#F59E0B' }}>
                              {pct(campaign.read_count, campaign.sent_count)}
                            </td>
                            <td className="px-5 py-3.5 text-xs" style={{ color: campaign.failed_count > 0 ? '#EF4444' : 'var(--text-dim)' }}>
                              {campaign.failed_count > 0 ? campaign.failed_count : '—'}
                            </td>
                            <td className="px-5 py-3.5 text-xs" style={{ color: 'var(--text-dim)' }}>
                              {new Date(campaign.created_at).toLocaleString('en-ZA', { dateStyle: 'short', timeStyle: 'short' })}
                            </td>
                            <td className="px-5 py-3.5">
                              {campaign.status === 'draft' && (
                                <SendCampaignButton campaignId={campaign.id} />
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        </BillingGateOverlay>

      </div>
    </div>
  )
}

