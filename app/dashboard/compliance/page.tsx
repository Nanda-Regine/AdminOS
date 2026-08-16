import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { TopBar } from '@/components/dashboard/TopBar'
import { Card } from '@/components/ui/card'
import { ComplianceTable, type ComplianceRow } from './ComplianceTable'

export const metadata = {
  title: 'Compliance Calendar — AdminOS',
  description: 'Your South African statutory deadlines, tracked automatically.',
}

/**
 * The SA statutory calendar: EMP201, IRP6, ITR14, CIPC annual return, COIDA and
 * EMP501, each carrying the real penalty for missing it.
 *
 * Items are seeded per tenant by seed_compliance_calendar() on signup, statuses
 * are recomputed by a database trigger from due_date (so they cannot go stale),
 * and completing a recurring item schedules its next occurrence automatically.
 */
export default async function CompliancePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const tenantId = user.app_metadata?.tenant_id as string | undefined
  if (!tenantId) redirect('/dashboard')

  const { data } = await supabaseAdmin
    .from('compliance_items')
    .select('id, item_type, title, description, due_date, recurrence, status, penalty_description, completed_at')
    .eq('tenant_id', tenantId)
    .order('due_date', { ascending: true, nullsFirst: false })

  const rows = (data ?? []) as ComplianceRow[]

  const overdue   = rows.filter(r => r.status === 'overdue').length
  const dueSoon   = rows.filter(r => r.status === 'due').length
  const completed = rows.filter(r => r.status === 'completed').length
  const open      = rows.filter(r => r.status !== 'completed' && r.status !== 'not_applicable')

  const next = open.find(r => r.due_date)

  const stats: { label: string; value: string | number; tone: string }[] = [
    { label: 'Overdue',      value: overdue,   tone: 'var(--chip-red-fg)' },
    { label: 'Due soon',     value: dueSoon,   tone: 'var(--chip-amber-fg)' },
    { label: 'Completed',    value: completed, tone: 'var(--chip-green-fg)' },
    { label: 'Tracked',      value: rows.length, tone: 'var(--text-primary)' },
  ]

  return (
    <>
      <TopBar
        title="Compliance Calendar"
        subtitle="Every SARS, CIPC and Compensation Fund deadline — tracked for you"
      />

      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        {/* Lead line: the single next thing, stated plainly. */}
        {next && (
          <Card>
            <div className="p-4 md:p-5">
              <div className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>
                Next deadline
              </div>
              <div className="text-base md:text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                {next.title}
              </div>
              <div className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                Due {new Date(next.due_date + 'T00:00:00').toLocaleDateString('en-ZA', {
                  day: '2-digit', month: 'long', year: 'numeric',
                })}
                {next.penalty_description && (
                  <> · <span style={{ color: 'var(--chip-amber-fg)' }}>{next.penalty_description}</span></>
                )}
              </div>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {stats.map(s => (
            <Card key={s.label}>
              <div className="p-4">
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
                <div className="text-2xl font-bold mt-1" style={{ color: s.tone }}>{s.value}</div>
              </div>
            </Card>
          ))}
        </div>

        <Card>
          <div className="p-3 md:p-5 overflow-x-auto">
            <ComplianceTable rows={rows} />
          </div>
        </Card>

        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Dates are calculated from standard SARS, CIPC and Compensation Fund schedules and your
          financial year end. They are a guide, not tax advice — confirm anything unusual with your
          accountant.
        </p>
      </div>
    </>
  )
}
