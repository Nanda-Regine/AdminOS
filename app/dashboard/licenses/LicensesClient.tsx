'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BadgeCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { DataTable, type Column, type FilterDef } from '@/components/ui/DataTable'
import { EmptyState } from '@/components/ui/EmptyState'
import { useOpenOnParam } from '@/lib/hooks/useOpenOnParam'

export type LicenseRow = {
  id:                    string
  staff_id:              string | null
  license_type:          string
  license_number:        string | null
  issuing_body:          string | null
  issue_date:            string | null
  expiry_date:           string | null
  renewal_reminder_days: number
  staff_name?:           string | null
}

export type StaffOption = { id: string; name: string }

const FIELD =
  'w-full rounded-lg px-3 py-2.5 text-sm min-h-[44px] bg-[var(--surface-2)] ' +
  'border border-[var(--border)] text-[var(--text-primary)] ' +
  'placeholder:text-[var(--text-dim)] focus:outline-none focus:ring-2 focus:ring-[var(--indigo)]'
const LABEL = 'block text-xs font-medium mb-1 text-[var(--text-secondary)]'

function daysLeft(d: string | null): number | null {
  if (!d) return null
  return Math.round(
    (new Date(d + 'T00:00:00').getTime() - new Date(new Date().toDateString()).getTime()) / 86_400_000
  )
}

/**
 * Expiry state is derived from the licence's own reminder window rather than a
 * fixed threshold — an HPCSA registration and a PrDP renew on very different
 * lead times, and the nightly reminder cron already uses this field, so the
 * badge and the notification agree.
 */
function expiryState(r: LicenseRow): { label: string; tone: 'green' | 'yellow' | 'red' | 'gray' } {
  const n = daysLeft(r.expiry_date)
  if (n === null) return { label: 'No expiry set', tone: 'gray' }
  if (n < 0) return { label: `Expired ${Math.abs(n)}d ago`, tone: 'red' }
  if (n <= r.renewal_reminder_days) return { label: `Renew in ${n}d`, tone: 'yellow' }
  return { label: `Valid · ${n}d`, tone: 'green' }
}

const fmt = (d: string | null) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

export function LicensesClient({ rows, staff }: { rows: LicenseRow[]; staff: StaffOption[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useOpenOnParam('new', () => setOpen(true))

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true); setError(null)
    const fd = new FormData(e.currentTarget)
    const str = (k: string) => { const v = (fd.get(k) as string | null)?.trim(); return v ? v : undefined }
    try {
      const res = await fetch('/api/licenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId:             str('staffId'),
          licenseType:         str('licenseType'),
          licenseNumber:       str('licenseNumber'),
          issuingBody:         str('issuingBody'),
          issueDate:           str('issueDate'),
          expiryDate:          str('expiryDate'),
          renewalReminderDays: Number(fd.get('renewalReminderDays') || 60),
        }),
      })
      if (!res.ok) {
        const b = await res.json().catch(() => null)
        throw new Error(b?.error ?? 'Could not save that licence')
      }
      setOpen(false); router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that licence')
    } finally { setSaving(false) }
  }

  const columns: Column<LicenseRow>[] = [
    {
      key: 'license_type',
      header: 'Licence',
      accessor: r => r.license_type,
      render: r => (
        <div className="min-w-0">
          <div className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>{r.license_type}</div>
          {r.license_number && (
            <div className="text-xs font-mono truncate" style={{ color: 'var(--text-muted)' }}>{r.license_number}</div>
          )}
        </div>
      ),
    },
    {
      key: 'staff_name',
      header: 'Held by',
      accessor: r => r.staff_name ?? '',
      render: r => <span style={{ color: 'var(--text-secondary)' }}>{r.staff_name || 'Business-wide'}</span>,
    },
    {
      key: 'issuing_body',
      header: 'Issued by',
      accessor: r => r.issuing_body ?? '',
      render: r => <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{r.issuing_body || '—'}</span>,
    },
    {
      key: 'expiry_date',
      header: 'Expires',
      accessor: r => r.expiry_date ?? '',
      render: r => <span className="whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>{fmt(r.expiry_date)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      accessor: r => expiryState(r).label,
      render: r => { const s = expiryState(r); return <Badge variant={s.tone}>{s.label}</Badge> },
    },
  ]

  const filters: FilterDef<LicenseRow>[] = [
    {
      key: 'status',
      label: 'Status',
      options: [
        { value: 'expired', label: 'Expired' },
        { value: 'due', label: 'Renewal due' },
        { value: 'valid', label: 'Valid' },
        { value: 'none', label: 'No expiry set' },
      ],
      predicate: (r, v) => {
        const n = daysLeft(r.expiry_date)
        if (v === 'none') return n === null
        if (n === null) return false
        if (v === 'expired') return n < 0
        if (v === 'due') return n >= 0 && n <= r.renewal_reminder_days
        return n > r.renewal_reminder_days
      },
    },
  ]

  return (
    <>
      <div className="flex justify-end mb-3">
        <Button onClick={() => setOpen(true)}>Add licence</Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={BadgeCheck}
          title="No licences tracked yet"
          body="Add professional registrations, trade licences, permits or driver PrDPs and AdminOS will warn you before each one lapses."
          action={{ label: 'Add your first licence', href: '/dashboard/licenses?new=1' }}
        />
      ) : (
        <DataTable
          rows={rows}
          columns={columns}
          filters={filters}
          getRowKey={r => r.id}
          searchPlaceholder="Search licences…"
          csvFilename="licences"
          initialSort={{ key: 'expiry_date', dir: 'asc' }}
        />
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Add licence" size="md">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className={LABEL} htmlFor="lt">Licence type *</label>
            <input id="lt" name="licenseType" required maxLength={200} className={FIELD}
                   placeholder="e.g. HPCSA registration, PrDP, CIDB grading" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL} htmlFor="ln">Licence number</label>
              <input id="ln" name="licenseNumber" maxLength={100} className={FIELD} />
            </div>
            <div>
              <label className={LABEL} htmlFor="ib">Issuing body</label>
              <input id="ib" name="issuingBody" maxLength={200} className={FIELD}
                     placeholder="e.g. HPCSA, CIDB, DoT" />
            </div>
          </div>
          <div>
            <label className={LABEL} htmlFor="sid">Held by</label>
            <select id="sid" name="staffId" defaultValue="" className={FIELD}>
              <option value="">Business-wide (not a person)</option>
              {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL} htmlFor="idt">Issued</label>
              <input id="idt" name="issueDate" type="date" className={FIELD} />
            </div>
            <div>
              <label className={LABEL} htmlFor="edt">Expires</label>
              <input id="edt" name="expiryDate" type="date" className={FIELD} />
            </div>
          </div>
          <div>
            <label className={LABEL} htmlFor="rr">Warn me this many days before expiry</label>
            <input id="rr" name="renewalReminderDays" type="number" min={7} max={365}
                   defaultValue={60} className={FIELD} />
          </div>

          {error && (
            <div className="rounded-lg px-3 py-2 text-sm"
                 style={{ background: 'var(--chip-red-bg)', color: 'var(--chip-red-fg)' }}>{error}</div>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Save licence</Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
