'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Modal, FormField, inputCls, inputSty, Btn } from '@/components/ui/modal'

interface Props {
  staff: Array<{ id: string; full_name: string }>
}

export function LogIncidentModal({ staff }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const today = new Date().toISOString().split('T')[0]

  const [form, setForm] = useState({
    staffId: '',
    recordType: 'verbal_warning' as string,
    severity: 'minor' as string,
    incidentDate: today,
    description: '',
    outcome: '',
  })

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleOpen() {
    setForm({
      staffId: staff[0]?.id ?? '',
      recordType: 'verbal_warning',
      severity: 'minor',
      incidentDate: today,
      description: '',
      outcome: '',
    })
    setError(null)
    setOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!form.staffId) { setError('Please select a staff member.'); return }
    if (!form.description.trim()) { setError('Description is required.'); return }
    if (!form.incidentDate) { setError('Incident date is required.'); return }

    setLoading(true)
    try {
      const res = await fetch('/api/disciplinary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId: form.staffId,
          recordType: form.recordType,
          severity: form.severity,
          incidentDate: form.incidentDate,
          description: form.description.trim(),
          outcome: form.outcome.trim() || undefined,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || `Error ${res.status}`)
      }

      setOpen(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors"
      >
        + Log Incident
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Log Incident" size="md">
        <form onSubmit={handleSubmit} className="space-y-4">

          <FormField label="Staff Member">
            <select
              className={inputCls}
              style={inputSty}
              value={form.staffId}
              onChange={(e) => set('staffId', e.target.value)}
              required
            >
              <option value="">— Select staff member —</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>{s.full_name}</option>
              ))}
            </select>
          </FormField>

          <FormField label="Incident Type">
            <select
              className={inputCls}
              style={inputSty}
              value={form.recordType}
              onChange={(e) => set('recordType', e.target.value)}
              required
            >
              <option value="verbal_warning">Verbal Warning</option>
              <option value="written_warning">Written Warning</option>
              <option value="final_warning">Final Warning</option>
              <option value="suspension">Suspension</option>
              <option value="dismissal">Dismissal</option>
              <option value="grievance">Grievance</option>
              <option value="hearing">Hearing</option>
            </select>
          </FormField>

          <FormField label="Severity">
            <select
              className={inputCls}
              style={inputSty}
              value={form.severity}
              onChange={(e) => set('severity', e.target.value)}
              required
            >
              <option value="minor">Minor</option>
              <option value="major">Major</option>
              <option value="gross">Gross</option>
            </select>
          </FormField>

          <FormField label="Incident Date">
            <input
              type="date"
              className={inputCls}
              style={inputSty}
              value={form.incidentDate}
              onChange={(e) => set('incidentDate', e.target.value)}
              required
            />
          </FormField>

          <FormField label="Description">
            <textarea
              className={inputCls}
              style={inputSty}
              rows={4}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Describe the incident..."
              required
            />
          </FormField>

          <FormField label="Outcome" hint="Optional — e.g. outcome of hearing, sanction applied">
            <textarea
              className={inputCls}
              style={inputSty}
              rows={2}
              value={form.outcome}
              onChange={(e) => set('outcome', e.target.value)}
              placeholder="Leave blank if not yet resolved..."
            />
          </FormField>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="ghost" onClick={() => setOpen(false)}>Cancel</Btn>
            <Btn type="submit" loading={loading}>Log Incident</Btn>
          </div>
        </form>
      </Modal>
    </>
  )
}
