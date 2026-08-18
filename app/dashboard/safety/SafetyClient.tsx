'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { DataTable, type Column, type FilterDef } from '@/components/ui/DataTable'
import { EmptyState } from '@/components/ui/EmptyState'
import { useOpenOnParam } from '@/lib/hooks/useOpenOnParam'

export type IncidentType =
  | 'near_miss' | 'minor_injury' | 'major_injury' | 'fatality' | 'property_damage' | 'environmental'

export type IncidentRow = {
  id:                string
  staff_id:          string | null
  incident_date:     string
  incident_type:     IncidentType
  description:       string
  location:          string | null
  witnesses:         string[]
  immediate_action:  string | null
  root_cause:        string | null
  corrective_action: string | null
  iod_reported:      boolean
  iod_reference:     string | null
  staff?:            { full_name: string } | null
}

export type StaffOption = { id: string; full_name: string }

const FIELD =
  'w-full rounded-lg px-3 py-2.5 text-sm min-h-[44px] bg-[var(--surface-2)] ' +
  'border border-[var(--border)] text-[var(--text-primary)] ' +
  'placeholder:text-[var(--text-dim)] focus:outline-none focus:ring-2 focus:ring-[var(--indigo)]'
const LABEL = 'block text-xs font-medium mb-1 text-[var(--text-secondary)]'

const TYPE_LABELS: Record<IncidentType, string> = {
  near_miss:        'Near miss',
  minor_injury:     'Minor injury',
  major_injury:     'Major injury',
  fatality:         'Fatality',
  property_damage:  'Property damage',
  environmental:    'Environmental',
}

// near_miss / minor_injury read as a caution; major_injury / fatality are the
// ones COIDA cares about and get red; property_damage / environmental are
// neither a person-safety nor near-miss signal, so they stay neutral.
const TYPE_TONE: Record<IncidentType, 'yellow' | 'red' | 'gray'> = {
  near_miss:        'yellow',
  minor_injury:     'yellow',
  major_injury:     'red',
  fatality:         'red',
  property_damage:  'gray',
  environmental:    'gray',
}

const fmt = (d: string) =>
  new Date(d).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

export function SafetyClient({ rows, staff }: { rows: IncidentRow[]; staff: StaffOption[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [iodChecked, setIodChecked] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useOpenOnParam('new', () => setOpen(true))

  function close() {
    setOpen(false)
    setError(null)
    setIodChecked(false)
  }

  // Date-range narrows the row set client-side, matching the GET route's
  // `from`/`to` params, before DataTable applies its own search/type filter.
  const dateFiltered = useMemo(() => {
    return rows.filter(r => {
      const d = r.incident_date.slice(0, 10)
      if (dateFrom && d < dateFrom) return false
      if (dateTo && d > dateTo) return false
      return true
    })
  }, [rows, dateFrom, dateTo])

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true); setError(null)
    const fd = new FormData(e.currentTarget)
    const str = (k: string) => { const v = (fd.get(k) as string | null)?.trim(); return v ? v : undefined }
    const dateStr = str('incidentDate')
    const witnesses = (str('witnesses') ?? '')
      .split(',')
      .map(w => w.trim())
      .filter(Boolean)

    try {
      const res = await fetch('/api/safety', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId:          str('staffId'),
          incidentDate:     dateStr ? new Date(dateStr).toISOString() : undefined,
          incidentType:     str('incidentType'),
          description:      str('description'),
          location:         str('location'),
          witnesses,
          immediateAction:  str('immediateAction'),
          rootCause:        str('rootCause'),
          correctiveAction: str('correctiveAction'),
          iodReported:      fd.get('iodReported') === 'on',
          iodReference:     str('iodReference'),
        }),
      })
      if (!res.ok) {
        const b = await res.json().catch(() => null)
        throw new Error(b?.error ?? 'Could not save that incident')
      }
      close(); router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that incident')
    } finally { setSaving(false) }
  }

  const columns: Column<IncidentRow>[] = [
    {
      key: 'incident_date',
      header: 'Date',
      accessor: r => r.incident_date,
      render: r => <span className="whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>{fmt(r.incident_date)}</span>,
    },
    {
      key: 'incident_type',
      header: 'Type',
      accessor: r => TYPE_LABELS[r.incident_type],
      render: r => <Badge variant={TYPE_TONE[r.incident_type]}>{TYPE_LABELS[r.incident_type]}</Badge>,
    },
    {
      key: 'description',
      header: 'Description',
      accessor: r => r.description,
      render: r => <span className="text-sm" style={{ color: 'var(--text-secondary)' }} title={r.description}>{truncate(r.description, 80)}</span>,
      sortable: false,
    },
    {
      key: 'staff_name',
      header: 'Staff member',
      accessor: r => r.staff?.full_name ?? '',
      render: r => <span style={{ color: 'var(--text-secondary)' }}>{r.staff?.full_name || '—'}</span>,
    },
    {
      key: 'iod_reported',
      header: 'IOD',
      accessor: r => r.iod_reported ? 'Reported' : 'Not reported',
      render: r => r.iod_reported
        ? <Badge variant="green">Reported{r.iod_reference ? ` · ${r.iod_reference}` : ''}</Badge>
        : <Badge variant="gray">Not reported</Badge>,
    },
  ]

  const filters: FilterDef<IncidentRow>[] = [
    {
      key: 'incident_type',
      label: 'Type',
      options: (Object.keys(TYPE_LABELS) as IncidentType[]).map(t => ({ value: t, label: TYPE_LABELS[t] })),
      predicate: (r, v) => r.incident_type === v,
    },
  ]

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-3">
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className={LABEL} htmlFor="df">From</label>
            <input id="df" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={FIELD} />
          </div>
          <div>
            <label className={LABEL} htmlFor="dt">To</label>
            <input id="dt" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={FIELD} />
          </div>
          {(dateFrom || dateTo) && (
            <button
              type="button"
              onClick={() => { setDateFrom(''); setDateTo('') }}
              className="text-xs font-medium px-2 py-1 rounded-md h-[44px]"
              style={{ color: 'var(--text-muted)' }}
            >
              Clear dates
            </button>
          )}
        </div>
        <Button onClick={() => setOpen(true)}>Report incident</Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={ShieldAlert}
          title="No incidents reported yet"
          body="Log near misses, injuries and property damage as they happen — major injuries and fatalities automatically raise a COIDA compliance reminder."
          action={{ label: 'Report your first incident', href: '/dashboard/safety?new=1' }}
        />
      ) : (
        <DataTable
          rows={dateFiltered}
          columns={columns}
          filters={filters}
          getRowKey={r => r.id}
          searchPlaceholder="Search incidents…"
          csvFilename="safety-incidents"
          initialSort={{ key: 'incident_date', dir: 'desc' }}
        />
      )}

      <Modal open={open} onClose={close} title="Report incident" size="md">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL} htmlFor="idt">Incident date *</label>
              <input id="idt" name="incidentDate" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className={FIELD} />
            </div>
            <div>
              <label className={LABEL} htmlFor="itp">Type *</label>
              <select id="itp" name="incidentType" required defaultValue="" className={FIELD}>
                <option value="" disabled>Select type…</option>
                {(Object.keys(TYPE_LABELS) as IncidentType[]).map(t => (
                  <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={LABEL} htmlFor="sid">Staff member involved</label>
            <select id="sid" name="staffId" defaultValue="" className={FIELD}>
              <option value="">Not a specific person</option>
              {staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </select>
          </div>

          <div>
            <label className={LABEL} htmlFor="desc">Description *</label>
            <textarea id="desc" name="description" required minLength={10} maxLength={5000} rows={3} className={FIELD}
                      placeholder="What happened, in as much detail as you have" />
          </div>

          <div>
            <label className={LABEL} htmlFor="loc">Location</label>
            <input id="loc" name="location" maxLength={300} className={FIELD} placeholder="e.g. Warehouse floor, Bay 3" />
          </div>

          <div>
            <label className={LABEL} htmlFor="wit">Witnesses</label>
            <input id="wit" name="witnesses" className={FIELD} placeholder="Comma-separated names" />
          </div>

          <div>
            <label className={LABEL} htmlFor="ia">Immediate action taken</label>
            <textarea id="ia" name="immediateAction" maxLength={2000} rows={2} className={FIELD} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL} htmlFor="rc">Root cause</label>
              <textarea id="rc" name="rootCause" maxLength={2000} rows={2} className={FIELD} />
            </div>
            <div>
              <label className={LABEL} htmlFor="ca">Corrective action</label>
              <textarea id="ca" name="correctiveAction" maxLength={2000} rows={2} className={FIELD} />
            </div>
          </div>

          <fieldset className="rounded-lg border border-[var(--border)] p-3">
            <legend className="px-1 text-xs text-[var(--text-secondary)]">COIDA / IOD</legend>
            <label className="flex items-center gap-2 text-sm min-h-[44px] text-[var(--text-primary)]">
              <input type="checkbox" name="iodReported" className="w-4 h-4"
                     checked={iodChecked} onChange={e => setIodChecked(e.target.checked)} />
              Injury on Duty has been reported to the Compensation Fund
            </label>
            {iodChecked && (
              <div className="mt-2">
                <label className={LABEL} htmlFor="ir">IOD reference number</label>
                <input id="ir" name="iodReference" maxLength={100} className={FIELD} />
              </div>
            )}
          </fieldset>

          {error && (
            <div className="rounded-lg px-3 py-2 text-sm"
                 style={{ background: 'var(--chip-red-bg)', color: 'var(--chip-red-fg)' }}>{error}</div>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={close}>Cancel</Button>
            <Button type="submit" loading={saving}>Save incident</Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
