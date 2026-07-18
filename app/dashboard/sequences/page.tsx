import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { TopBar } from '@/components/dashboard/TopBar'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Zap, Plus, Users, CheckCheck, Play } from 'lucide-react'
import { SequencesTable, type Sequence, type Step } from './SequencesTable'

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
        <div className="flex items-center justify-between">
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
        <SequencesTable rows={list} />

      </div>
    </div>
  )
}
