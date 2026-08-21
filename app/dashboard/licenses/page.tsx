import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { TopBar } from '@/components/dashboard/TopBar'
import { Card } from '@/components/ui/card'
import { LicensesClient, type LicenseRow, type StaffOption } from './LicensesClient'

export const metadata = {
  title: 'Licences & Permits — AdminOS',
  description: 'Professional registrations, trade licences and permits, with expiry warnings.',
}

/**
 * professional_licenses shipped in Phase 8 with a working API and a nightly
 * renewal-reminder cron — and no page to enter or read anything. The reminders
 * were firing against a table nobody could populate.
 */
export default async function LicensesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const tenantId = user.app_metadata?.tenant_id as string | undefined
  if (!tenantId) redirect('/dashboard')

  const [{ data: licenses }, { data: staff }] = await Promise.all([
    supabaseAdmin
      .from('professional_licenses')
      .select('id, staff_id, license_type, license_number, issuing_body, issue_date, expiry_date, renewal_reminder_days')
      .eq('tenant_id', tenantId)
      .order('expiry_date', { ascending: true, nullsFirst: false }),
    supabaseAdmin
      .from('staff')
      // staff has no `name` column (it's `full_name` — see supabase/schema.sql:183);
      // aliased here so StaffOption/LicensesClient can keep using `.name` untouched.
      .select('id, name:full_name')
      .eq('tenant_id', tenantId)
      .order('full_name'),
  ])

  const staffOptions = (staff ?? []) as StaffOption[]
  const byId = new Map(staffOptions.map(s => [s.id, s.name]))
  const rows: LicenseRow[] = ((licenses ?? []) as LicenseRow[]).map(l => ({
    ...l,
    staff_name: l.staff_id ? byId.get(l.staff_id) ?? null : null,
  }))

  const today = new Date(new Date().toDateString()).getTime()
  const days = (d: string | null) =>
    d === null ? null : Math.round((new Date(d + 'T00:00:00').getTime() - today) / 86_400_000)

  const expired = rows.filter(r => { const n = days(r.expiry_date); return n !== null && n < 0 }).length
  const dueSoon = rows.filter(r => {
    const n = days(r.expiry_date)
    return n !== null && n >= 0 && n <= r.renewal_reminder_days
  }).length

  const stats = [
    { label: 'Tracked',      value: rows.length, tone: 'var(--text-primary)' },
    { label: 'Expired',      value: expired,     tone: 'var(--chip-red-fg)' },
    { label: 'Renewal due',  value: dueSoon,     tone: 'var(--chip-amber-fg)' },
  ]

  return (
    <>
      <TopBar
        title="Licences & Permits"
        subtitle="Registrations, trade licences and permits — warned before they lapse"
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
            <LicensesClient rows={rows} staff={staffOptions} />
          </div>
        </Card>
      </div>
    </>
  )
}
