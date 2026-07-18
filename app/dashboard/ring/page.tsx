import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { TopBar } from '@/components/dashboard/TopBar'
import { BillingGateOverlay } from '@/components/ui/BillingGateOverlay'
import { CopyButton } from '@/components/ui/CopyButton'
import { hasAddon } from '@/lib/billing/gates'
import { redirect } from 'next/navigation'
import { Phone, PhoneIncoming, Clock, Bot, Users } from 'lucide-react'
import { RingCallTable, type CallLog } from './RingCallTable'

function formatDuration(sec: number | null): string {
  if (!sec) return '—'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
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
    .limit(500)

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
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate"><span style={{ color: 'var(--text-muted)' }}>Inbound webhook: </span>{inboundWebhook}</p>
                    <CopyButton value={inboundWebhook} className="shrink-0" />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate"><span style={{ color: 'var(--text-muted)' }}>Status callback: </span>{statusWebhook}</p>
                    <CopyButton value={statusWebhook} className="shrink-0" />
                  </div>
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
            <div className="flex items-center gap-2">
              <PhoneIncoming className="w-4 h-4" style={{ color: 'var(--indigo-light)' }} />
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Call Log ({logs.length})
              </h3>
            </div>
            <RingCallTable rows={logs} />

          </div>
        </BillingGateOverlay>

      </div>
    </div>
  )
}
