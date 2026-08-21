import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { TopBar } from '@/components/dashboard/TopBar'
import { Card } from '@/components/ui/card'
import { SafetyClient, type IncidentRow, type StaffOption } from './SafetyClient'
import { checkPermission } from '@/lib/auth/permissions'

export const metadata = {
  title: 'Safety Incidents — AdminOS',
  description: 'Workplace incident register — near misses, injuries and IOD reporting.',
}

/**
 * safety_incidents shipped with a working GET/POST API (and an automatic
 * COIDA compliance-item on major injury / fatality) and no page to report or
 * read anything — the same "backend ahead of the front door" pattern as
 * Suppliers and Licences before it.
 */
export default async function SafetyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Named staff injury/incident records — same manage_staff boundary as its own
  // API (app/api/safety/route.ts) and the staff pages. notFound(), not a
  // redirect, per the page-level denial convention in lib/auth/context.ts.
  if (!(await checkPermission('manage_staff'))) notFound()

  const tenantId = user.app_metadata?.tenant_id as string | undefined
  if (!tenantId) redirect('/dashboard')

  const [{ data: incidents }, { data: staff }] = await Promise.all([
    supabaseAdmin
      .from('safety_incidents')
      .select('id, staff_id, incident_date, incident_type, description, location, witnesses, immediate_action, root_cause, corrective_action, iod_reported, iod_reference, staff:staff(full_name)')
      .eq('tenant_id', tenantId)
      .order('incident_date', { ascending: false }),
    supabaseAdmin
      .from('staff')
      .select('id, full_name')
      .eq('tenant_id', tenantId)
      .order('full_name'),
  ])

  const staffOptions = (staff ?? []) as StaffOption[]
  const rows = ((incidents ?? []) as unknown as IncidentRow[])

  const majorOrFatal = rows.filter(r => r.incident_type === 'major_injury' || r.incident_type === 'fatality').length
  const iodOutstanding = rows.filter(r =>
    !r.iod_reported && (r.incident_type === 'major_injury' || r.incident_type === 'fatality')
  ).length

  const stats = [
    { label: 'Total incidents', value: rows.length,      tone: 'var(--text-primary)' },
    { label: 'Major / fatality', value: majorOrFatal,      tone: 'var(--chip-red-fg)' },
    { label: 'IOD not yet reported', value: iodOutstanding, tone: 'var(--chip-amber-fg)' },
  ]

  return (
    <>
      <TopBar
        title="Safety Incidents"
        subtitle="Workplace incident register — near misses, injuries, IOD reporting"
      />

      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
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

        <Card>
          <div className="p-3 md:p-5 overflow-x-auto">
            <SafetyClient rows={rows} staff={staffOptions} />
          </div>
        </Card>
      </div>
    </>
  )
}
