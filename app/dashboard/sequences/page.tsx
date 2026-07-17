import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { TopBar } from '@/components/dashboard/TopBar'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Zap, Plus, Users, CheckCheck, Pause, Play } from 'lucide-react'
import { SequenceToggle } from '@/components/sequences/SequenceToggle'

type Step = { id: string; name: string; delay_hours: number; message: string }

type Sequence = {
  id:                string
  name:              string
  trigger_type:      string
  steps:             Step[]
  is_active:         boolean
  created_at:        string
  active_enrollments: number
}

const TRIGGER_LABELS: Record<string, string> = {
  new_contact:     'New Contact',
  overdue_invoice: 'Overdue Invoice',
  manual:          'Manual',
  keyword:         'Keyword',
  new_client:      'New Client',
  onboarding:      'Onboarding',
}

export default async function SequencesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const tenantId = user.app_metadata?.tenant_id as string

  const { data: seqs = [] } = await supabaseAdmin
    .from('whatsapp_sequences')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  const sequences = (seqs ?? []) as Omit<Sequence, 'active_enrollments'>[]

  // Fetch active enrollment counts
  const ids = sequences.map(s => s.id)
  const enrollmentCounts: Record<string, number> = {}

  if (ids.length > 0) {
    const { data: enrollments } = await supabaseAdmin
      .from('sequence_enrollments')
      .select('sequence_id')
      .in('sequence_id', ids)
      .eq('status', 'active')

    for (const e of enrollments ?? []) {
      enrollmentCounts[e.sequence_id] = (enrollmentCounts[e.sequence_id] ?? 0) + 1
    }
  }

  const list: Sequence[] = sequences.map(s => ({
    ...s,
    steps: (s.steps as unknown as Step[]) ?? [],
    active_enrollments: enrollmentCounts[s.id] ?? 0,
  }))

  const totalActive      = list.filter(s => s.is_active).length
  const totalEnrollments = list.reduce((sum, s) => sum + s.active_enrollments, 0)

  return (
    <div>
      <TopBar title="Sequences" subtitle="Automated multi-step WhatsApp message flows" />
      <div className="p-6 space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: Zap,       label: 'Total Sequences', value: list.length,        color: '#818CF8' },
            { icon: Play,      label: 'Active',          value: totalActive,        color: '#22C55E' },
            { icon: Users,     label: 'Enrolled',        value: totalEnrollments,   color: '#0EA5E9' },
            { icon: CheckCheck,label: 'Avg Steps',       value: list.length ? Math.round(list.reduce((s, c) => s + c.steps.length, 0) / list.length) : 0, color: '#F59E0B' },
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

        {/* List */}
        <div className="glass rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4"
            style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4" style={{ color: 'var(--indigo-light)' }} />
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Sequences ({list.length})
              </h3>
            </div>
            <Link href="/dashboard/sequences/new"
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg"
              style={{ background: 'var(--indigo)', color: '#fff' }}>
              <Plus className="w-3.5 h-3.5" />
              New Sequence
            </Link>
          </div>

          {list.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: 'var(--indigo-muted)' }}>
                <Zap className="w-6 h-6" style={{ color: 'var(--indigo-light)' }} />
              </div>
              <p className="font-medium mb-1" style={{ color: 'var(--text-primary)' }}>No sequences yet</p>
              <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
                Build automated message flows that trigger on contact events.
              </p>
              <Link href="/dashboard/sequences/new"
                className="inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-xl"
                style={{ background: 'var(--indigo)', color: '#fff' }}>
                <Plus className="w-4 h-4" />
                Build Your First Sequence
              </Link>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {list.map(seq => (
                <div key={seq.id} className="flex items-center gap-4 px-6 py-4">
                  {/* Status dot */}
                  <div className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: seq.is_active ? '#22C55E' : '#475569' }} />

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                        {seq.name}
                      </p>
                      <span className="text-xs px-1.5 py-0.5 rounded shrink-0"
                        style={{ background: 'var(--indigo-muted)', color: 'var(--indigo-light)' }}>
                        {TRIGGER_LABELS[seq.trigger_type] ?? seq.trigger_type}
                      </span>
                    </div>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {seq.steps.length} {seq.steps.length === 1 ? 'step' : 'steps'}
                      {seq.steps.length > 0 && (
                        <span className="ml-2">
                          — {seq.steps.map(s => `${s.delay_hours}h`).join(' → ')}
                        </span>
                      )}
                    </p>
                  </div>

                  {/* Enrolled count */}
                  {seq.active_enrollments > 0 && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Users className="w-3.5 h-3.5" style={{ color: '#0EA5E9' }} />
                      <span className="text-xs" style={{ color: '#0EA5E9' }}>
                        {seq.active_enrollments} active
                      </span>
                    </div>
                  )}

                  {/* Active toggle */}
                  <SequenceToggle sequenceId={seq.id} isActive={seq.is_active} />

                  {/* Pause indicator */}
                  {!seq.is_active && (
                    <Pause className="w-3.5 h-3.5 shrink-0" style={{ color: '#475569' }} />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
