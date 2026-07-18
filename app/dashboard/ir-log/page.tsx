import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { TopBar } from '@/components/dashboard/TopBar'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { redirect } from 'next/navigation'
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react'
import { LogIncidentModal } from './LogIncidentModal'

export const dynamic = 'force-dynamic'

export default async function IRLogPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const tenantId = user.app_metadata?.tenant_id as string

  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const { data: staffList } = await supabaseAdmin
    .from('staff')
    .select('id, full_name')
    .eq('tenant_id', tenantId)
    .order('full_name')

  // Real disciplinary_records schema: record_type / incident_date /
  // acknowledged_at (no severity or status columns). type:record_type and
  // date:incident_date are aliased so the render reads naturally; a case is
  // "open" until the staff member has acknowledged it.
  const { data: records } = await supabaseAdmin
    .from('disciplinary_records')
    .select('id, staff_id, type:record_type, description, date:incident_date, outcome, acknowledged_at, created_at, staff(full_name)')
    .eq('tenant_id', tenantId)
    .order('incident_date', { ascending: false })
    .limit(100)

  const allRecords = records || []

  const openCases = allRecords.filter((r) => !r.acknowledged_at)
  const closedCases = allRecords.filter((r) => r.acknowledged_at)

  // Warnings issued this month (record_type mentions 'warning')
  const warningsThisMonth = allRecords.filter((r) => {
    const recordDate = r.date ? new Date(r.date) : null
    const isThisMonth = recordDate && recordDate >= monthStart
    return isThisMonth && r.type?.toLowerCase().includes('warning')
  }).length

  function RecordRow({ record }: { record: typeof allRecords[number] }) {
    const staffName = (record.staff as unknown as { full_name: string } | null)?.full_name || 'Staff member'
    const acknowledged = Boolean(record.acknowledged_at)
    const recordDate = record.date
      ? new Date(record.date).toLocaleDateString('en-ZA', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      : '—'

    return (
      <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] hover:bg-[var(--surface-hover)] transition-colors">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <p className="text-sm font-semibold text-[var(--text-primary)]">{staffName}</p>
              <Badge variant={acknowledged ? 'green' : 'yellow'} className="capitalize">
                {acknowledged ? 'Acknowledged' : 'Pending acknowledgement'}
              </Badge>
            </div>
            <p className="text-xs font-medium text-[var(--text-secondary)] mb-0.5 capitalize">
              {(record.type || 'Incident').replace(/_/g, ' ')}
            </p>
            {record.description && (
              <p className="text-xs text-[var(--text-muted)] line-clamp-2 mb-1">{record.description}</p>
            )}
            {record.outcome && (
              <p className="text-xs text-[var(--text-dim)]">
                <span className="font-medium">Outcome:</span> {record.outcome}
              </p>
            )}
          </div>
          <p className="text-xs text-[var(--text-dim)] shrink-0 whitespace-nowrap">{recordDate}</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <TopBar
        title="IR Log"
        subtitle="Industrial Relations &amp; Disciplinary Records"
        actions={<LogIncidentModal staff={staffList || []} />}
      />
      <div className="p-6 space-y-6">

        {/* Summary stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.15)' }}>
                <AlertTriangle className="w-5 h-5" style={{ color: '#F87171' }} />
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--text-primary)]">{openCases.length}</p>
                <p className="text-xs text-[var(--text-muted)]">Open Cases</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.15)' }}>
                <Clock className="w-5 h-5" style={{ color: '#F59E0B' }} />
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--text-primary)]">{warningsThisMonth}</p>
                <p className="text-xs text-[var(--text-muted)]">Warnings This Month</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(34,197,94,0.15)' }}>
                <CheckCircle className="w-5 h-5" style={{ color: '#34D399' }} />
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--text-primary)]">{closedCases.length}</p>
                <p className="text-xs text-[var(--text-muted)]">Closed Cases</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Open / Pending cases */}
        <Card>
          <h3 className="font-semibold text-[var(--text-primary)] mb-4">
            Open &amp; Pending Cases
            {openCases.length > 0 && (
              <span className="ml-2 text-xs font-normal text-[var(--text-muted)]">
                — {openCases.length} case{openCases.length !== 1 ? 's' : ''}
              </span>
            )}
          </h3>
          {openCases.length === 0 ? (
            <div className="text-center py-8 text-[var(--text-dim)]">
              <CheckCircle className="w-8 h-8 mx-auto text-[var(--text-dim)] mb-2" />
              <p className="text-sm">No open IR cases.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {openCases.map((record) => (
                <RecordRow key={record.id} record={record} />
              ))}
            </div>
          )}
        </Card>

        {/* Closed cases */}
        {closedCases.length > 0 && (
          <Card>
            <h3 className="font-semibold text-[var(--text-primary)] mb-4">
              Closed Cases
              <span className="ml-2 text-xs font-normal text-[var(--text-muted)]">
                — {closedCases.length} record{closedCases.length !== 1 ? 's' : ''}
              </span>
            </h3>
            <div className="space-y-3">
              {closedCases.map((record) => (
                <RecordRow key={record.id} record={record} />
              ))}
            </div>
          </Card>
        )}

        {allRecords.length === 0 && (
          <Card>
            <div className="text-center py-12 text-[var(--text-dim)]">
              <p className="text-3xl mb-2">📋</p>
              <p className="text-sm">No disciplinary records found.</p>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
