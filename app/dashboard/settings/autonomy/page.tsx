import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { TopBar } from '@/components/dashboard/TopBar'
import { redirect } from 'next/navigation'
import { DECISION_CATALOGUE, DECISION_DEFAULTS, type Tier } from '@/lib/autonomy/tiers'
import { NOTIFY_CATEGORIES } from '@/lib/notifications/delivery'
import { AutonomyControls } from './AutonomyControls'
import { NotificationPreferences } from './NotificationPreferences'
import { Bot } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function AutonomySettings() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const tenantId = user.app_metadata?.tenant_id as string

  const { data } = await supabaseAdmin
    .from('tenant_autonomy_config')
    .select('domain, decision_type, tier')
    .eq('tenant_id', tenantId)
  const overrides = new Map((data ?? []).map(r => [`${r.domain}/${r.decision_type}`, r.tier as Tier]))

  const decisions = DECISION_CATALOGUE.map(d => {
    const key = `${d.domain}/${d.decision_type}`
    return { ...d, tier: overrides.get(key) ?? DECISION_DEFAULTS[key] ?? ('C' as Tier) }
  })

  const { data: tenantRow } = await supabaseAdmin.from('tenants').select('settings').eq('id', tenantId).maybeSingle()
  const settings = (tenantRow?.settings ?? {}) as Record<string, unknown>
  const initialNotify = (settings.notify ?? {}) as Record<string, { whatsapp?: boolean }>
  const initialQuiet = (settings.quiet_hours ?? null) as { start: number; end: number } | null

  return (
    <div>
      <TopBar title="Autonomy" subtitle="Decide what AdminOS may do on its own" />
      <div className="p-6 space-y-6 max-w-3xl">
        <div className="rounded-2xl px-6 py-5 relative overflow-hidden border on-dark"
          style={{ background: 'linear-gradient(135deg, #101a3e 0%, #16224a 100%)', borderColor: 'var(--border)' }}>
          <div className="relative flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(99,102,241,0.2)' }}>
              <Bot className="w-5 h-5" style={{ color: 'var(--indigo-light)' }} />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>You stay in control</p>
              <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
                AdminOS handles what you allow — and only what you allow. Set each action to run on its own,
                prepare a draft for you, or simply notify you. Change it any time.
              </p>
            </div>
          </div>
        </div>

        <AutonomyControls initial={decisions} />

        <div className="pt-2">
          <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Notifications</h2>
          <NotificationPreferences categories={NOTIFY_CATEGORIES} initialNotify={initialNotify} initialQuiet={initialQuiet} />
        </div>
      </div>
    </div>
  )
}
