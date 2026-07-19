'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Modal, FormField, inputCls, inputSty, Btn } from '@/components/ui/modal'
import { CalendarPlus } from 'lucide-react'

interface StaffOption { id: string; full_name: string | null }

const EMPTY = { staffId: '', shiftDate: '', startTime: '09:00', endTime: '17:00', location: '', notes: '' }
type FormState = typeof EMPTY

export function CreateShiftModal({ staff }: { staff: StaffOption[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }
  function handleOpen() { setForm(EMPTY); setError(null); setOpen(true) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!form.staffId) { setError('Choose a staff member.'); return }
    if (!form.shiftDate) { setError('Pick a date.'); return }
    setLoading(true)
    try {
      const body = {
        staffId: form.staffId,
        shiftDate: form.shiftDate,
        startTime: form.startTime,
        endTime: form.endTime,
        location: form.location.trim() || undefined,
        notes: form.notes.trim() || undefined,
      }
      const res = await fetch('/api/shifts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || `Failed (${res.status})`)
      router.refresh()
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create shift')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button type="button" onClick={handleOpen}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium"
        style={{ background: 'var(--indigo)', color: '#fff' }}>
        <CalendarPlus className="w-3.5 h-3.5" />
        New shift
      </button>

      <Modal open={open} onClose={() => !loading && setOpen(false)} title="Schedule a shift" size="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Staff member *">
            <select name="staffId" required value={form.staffId} onChange={handleChange} className={inputCls} style={inputSty}>
              <option value="">Select staff…</option>
              {staff.map(s => <option key={s.id} value={s.id}>{s.full_name || 'Unnamed'}</option>)}
            </select>
          </FormField>
          <FormField label="Date *">
            <input name="shiftDate" type="date" required value={form.shiftDate} onChange={handleChange} className={inputCls} style={inputSty} />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Start">
              <input name="startTime" type="time" required value={form.startTime} onChange={handleChange} className={inputCls} style={inputSty} />
            </FormField>
            <FormField label="End">
              <input name="endTime" type="time" required value={form.endTime} onChange={handleChange} className={inputCls} style={inputSty} />
            </FormField>
          </div>
          <FormField label="Location">
            <input name="location" type="text" value={form.location} onChange={handleChange} placeholder="e.g. Main branch" className={inputCls} style={inputSty} />
          </FormField>
          <FormField label="Notes">
            <textarea name="notes" rows={2} value={form.notes} onChange={handleChange} placeholder="Optional" className={inputCls} style={inputSty} />
          </FormField>
          {error && <p className="text-sm text-red-400 rounded-lg px-3 py-2" style={{ background: 'rgba(239,68,68,0.1)' }}>{error}</p>}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Btn variant="ghost" onClick={() => setOpen(false)} type="button">Cancel</Btn>
            <Btn type="submit" loading={loading}>Schedule shift</Btn>
          </div>
        </form>
      </Modal>
    </>
  )
}
