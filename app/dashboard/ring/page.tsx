import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { TopBar } from '@/components/dashboard/TopBar'
import { BillingGateOverlay } from '@/components/ui/BillingGateOverlay'
import { hasAddon } from '@/lib/billing/gates'
import { redirect } from 'next/navigation'
import { Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, Clock, Mic, Bot, Users } from 'lucide-react'

type CallLog = {
  id:             string
  contact_id:     string | null
  twilio_call_sid: string | null
  direction:      string
  from_number:    string
  to_number:      string
  status:         string
  duration_sec:   number | null
  recording_url:  string | null
  transcript:     string | null
  sentiment:      string | null
  summary:        string | null
  ai_handled:     boolean
  transferred_to: string | null
  started_at:     string
  ended_at:       string | null
}

function formatDuration(sec: number | null): string {
  if (!sec) return '—'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Phone }> = {
  completed:   { label: 'Completed',   color: '#22C55E', icon: Phone },
  'in-progress': { label: 'Live',      color: '#6366F1', icon: Phone },
  transferred: { label: 'Transferred', color: '#F59E0B', icon: PhoneOutgoing },
  'no-answer': { label: 'No Answer',   color: '#94A3B8', icon: PhoneMissed },
  failed:      { label: 'Failed',      color: '#EF4444', icon: PhoneMissed },
  initiated:   { label: 'Initiated',   color: '#0EA5E9', icon: PhoneIncoming },
}

export default async function RingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const tenantId  = user.app_metadata?.tenant_id as string
  const ringActive = await hasAddon('ring')

  const { data: tenantData } = await supabaseAdmin
    .from('tenants')
    .select('twilio_phone_number, twilio_twiml_app_sid')
    .eq('id', tenantId)
    .single()

  const { data: callLogs = [] } = await supabaseAdmin
    .from('call_logs')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('started_at', { ascending: false })
    .limit(100)

  const logs = (callLogs ?? []) as CallLog[]

  const totalCalls    = logs.length
  const aiHandled     = logs.filter(c => c.ai_handled).length
  const avgDuration   = logs.length
    ? Math.round(logs.reduce((s, c) => s + (c.duration_sec || 0), 0) / logs.length)
    : 0
  const transferred   = logs.filter(c => c.status === 'transferred').length

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://adminos.co.za'
  const inboundWebhook  = `${appUrl}/api/voice/inbound`
  const statusWebhook   = `${appUrl}/api/voice/status`

  return (
    <div>
      <TopBar title="Ring" subtitle="AI voice agent — answers calls, takes messages, transfers to staff" />
      <div className="p-6 space-y-6">

        <BillingGateOverlay requiredAddon="ring" locked={!ringActive}>
          <div className="space-y-6">

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { icon: Phone,    label: 'Total Calls',    value: totalCalls,                   color: '#818CF8' },
                { icon: Bot,      label: 'AI Handled',     value: `${aiHandled} (${totalCalls ? Math.round(aiHandled/totalCalls*100) : 0}%)`, color: '#22C55E' },
                { icon: Clock,    label: 'Avg Duration',   value: formatDuration(avgDuration),   color: '#F59E0B' },
                { icon: Users,    label: 'Transferred',    value: transferred,                   color: '#0EA5E9' },
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

            {/* Setup card */}
            {!tenantData?.twilio_phone_number && (
              <div className="glass rounded-2xl p-5"
                style={{ border: '1px solid rgba(245,158,11,0.3)' }}>
                <h3 className="text-sm font-semibold mb-3" style={{ color: '#F59E0B' }}>
                  Twilio Setup Required
                </h3>
                <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                  Configure your Twilio phone number to start receiving AI-handled calls.
                </p>
                <div className="space-y-2 text-sm font-mono p-3 rounded-xl"
                  style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
                  <p><span style={{ color: 'var(--text-muted)' }}>Inbound webhook: </span>{inboundWebhook}</p>
                  <p><span style={{ color: 'var(--text-muted)' }}>Status callback: </span>{statusWebhook}</p>
                </div>
                <p className="text-xs mt-3" style={{ color: 'var(--text-dim)' }}>
                  Set these URLs in your Twilio console under Phone Numbers → Voice Configuration.
                  Then add your Twilio number in Settings → Integrations.
                </p>
              </div>
            )}

            {tenantData?.twilio_phone_number && (
              <div className="glass rounded-2xl p-5"
                style={{ border: '1px solid rgba(34,197,94,0.3)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: 'rgba(34,197,94,0.15)' }}>
                    <Phone className="w-4 h-4" style={{ color: '#22C55E' }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {tenantData.twilio_phone_number}
                    </p>
                    <p className="text-xs" style={{ color: '#22C55E' }}>Ring agent active</p>
                  </div>
                </div>
              </div>
            )}

            {/* Call log table */}
            <div className="glass rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4"
                style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="flex items-center gap-2">
                  <PhoneIncoming className="w-4 h-4" style={{ color: 'var(--indigo-light)' }} />
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    Call Log ({logs.length})
                  </h3>
                </div>
              </div>

              {logs.length === 0 ? (
                <div className="px-6 py-16 text-center">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                    style={{ background: 'var(--indigo-muted)' }}>
                    <Phone className="w-6 h-6" style={{ color: 'var(--indigo-light)' }} />
                  </div>
                  <p className="font-medium mb-1" style={{ color: 'var(--text-primary)' }}>No calls yet</p>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    Calls will appear here once your Twilio number is configured.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
                        {['Time', 'From', 'Direction', 'Status', 'Duration', 'Handled by', 'Transcript'].map(h => (
                          <th key={h} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide"
                            style={{ color: 'var(--text-muted)' }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map(call => {
                        const sc  = STATUS_CONFIG[call.status] ?? STATUS_CONFIG.completed
                        const Icon = call.direction === 'inbound' ? PhoneIncoming : PhoneOutgoing
                        return (
                          <tr key={call.id} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td className="px-5 py-3.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                              {new Date(call.started_at).toLocaleString('en-ZA', { dateStyle: 'short', timeStyle: 'short' })}
                            </td>
                            <td className="px-5 py-3.5">
                              <p className="font-medium text-xs" style={{ color: 'var(--text-primary)' }}>
                                {call.from_number}
                              </p>
                            </td>
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-1.5">
                                <Icon className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                                <span className="text-xs capitalize" style={{ color: 'var(--text-secondary)' }}>
                                  {call.direction}
                                </span>
                              </div>
                            </td>
                            <td className="px-5 py-3.5">
                              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                                style={{ background: `${sc.color}20`, color: sc.color }}>
                                {sc.label}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                              {formatDuration(call.duration_sec)}
                            </td>
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-1.5">
                                {call.ai_handled
                                  ? <><Bot className="w-3.5 h-3.5" style={{ color: 'var(--indigo-light)' }} /><span className="text-xs" style={{ color: 'var(--indigo-light)' }}>AI</span></>
                                  : <><Users className="w-3.5 h-3.5" style={{ color: '#22C55E' }} /><span className="text-xs" style={{ color: '#22C55E' }}>Staff</span></>
                                }
                              </div>
                            </td>
                            <td className="px-5 py-3.5 max-w-xs">
                              {call.summary ? (
                                <p className="text-xs line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                                  {call.summary}
                                </p>
                              ) : call.transcript ? (
                                <p className="text-xs line-clamp-2" style={{ color: 'var(--text-dim)' }}>
                                  {call.transcript.split('\n')[0]}
                                </p>
                              ) : (
                                <span style={{ color: 'var(--text-dim)' }}>—</span>
                              )}
                              {call.recording_url && (
                                <a href={call.recording_url} target="_blank" rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 mt-1 text-xs"
                                  style={{ color: 'var(--indigo-light)' }}>
                                  <Mic className="w-3 h-3" /> Recording
                                </a>
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
