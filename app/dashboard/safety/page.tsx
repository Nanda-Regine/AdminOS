import { redirect } from 'next/navigation'
import { getContext } from '@/lib/auth/context'
import { can } from '@/lib/auth/roleMatrix'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { TopBar } from '@/components/dashboard/TopBar'
import { Card } from '@/components/ui/card'
import { SafetyClient, type IncidentRow, type StaffOption } from './SafetyClient'

export const metadata = {
  title: 'Safety Incidents — AdminOS',
  description: 'Workplace incident register — near misses, injuries and IOD reporting.',
}

const INJURIES = ['minor_injury', 'major_injury', 'fatality']

/**
 * Two views over one table, matching app/api/safety/route.ts:
 *  - hr.records (manage_staff): the full incident register.
 *  - everyone else: report an incident and see what they reported. OHSA
 *    expects every worker to report, so the page used to 404 a site manager
 *    (no manage_staff) who needed to log one.
 */
export default async function SafetyPage() {
  const ctx = await getContext()
  if (!ctx) redirect('/login')
  const tenantId = ctx.tenantId
  const register = can(ctx, 'hr.records')

  let incidentsQuery = supabaseAdmin
    .from('safety_incidents')
    .select('id, staff_id, incident_date, incident_type, description, location, witnesses, immediate_action, root_cause, corrective_action, iod_reported, iod_reference, staff:staff(full_name)')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('incident_date', { ascending: false })
    .limit(500)
  if (!register) incidentsQuery = incidentsQuery.eq('created_by', ctx.userId)

  const [{ data: incidents }, { data: staff }] = await Promise.all([
    incidentsQuery,
    // Names only — a reporter has to be able to say who was hurt.
    supabaseAdmin
      .from('staff')
      .select('id, full_name')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('full_name'),
  ])

  const staffOptions = (staff ?? []) as StaffOption[]
  const rows = ((incidents ?? []) as unknown as IncidentRow[])

  const majorOrFatal = rows.filter(r => r.incident_type === 'major_injury' || r.incident_type === 'fatality').length
  // COIDA W.Cl.2 applies to every injury on duty, minor ones included (the API
  // raises the reminder for all three) — this used to count major/fatal only.
  const iodOutstanding = rows.filter(r => !r.iod_reported && INJURIES.includes(r.incident_type)).length

  const stats = [
    { label: 'Total incidents', value: rows.length,      tone: 'var(--text-primary)' },
    { label: 'Major / fatality', value: majorOrFatal,      tone: 'var(--chip-red-fg)' },
    { label: 'IOD not yet reported', value: iodOutstanding, tone: 'var(--chip-amber-fg)' },
  ]

  return (
    <>
      <TopBar
        title={register ? 'Safety Incidents' : 'Report a safety incident'}
        subtitle={register
          ? 'Workplace incident register — near misses, injuries, IOD reporting'
          : 'Near misses, injuries and damage — your report goes straight to HR'}
      />

      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        {register && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
            {stats.map(s => (
              <Card key={s.label}>
                <div className="p-4">
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
                  <div className="text-2xl font-bold mt-1" style={{ color: s.tone }}>{s.value}</div>
                </div>
              </Card>
            ))}
          </div>
        )}

        <Card variant="flat">
          <div className="p-3 md:p-5 overflow-x-auto">
            <SafetyClient rows={rows} staff={staffOptions} register={register} />
          </div>
        </Card>
      </div>
    </>
  )
}
