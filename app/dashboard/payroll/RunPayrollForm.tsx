'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Modal, FormField, inputCls, inputSty, Btn } from '@/components/ui/modal'
import { useOpenOnParam } from '@/lib/hooks/useOpenOnParam'
import { Play } from 'lucide-react'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export function RunPayrollForm({ defaultMonth, defaultYear }: { defaultMonth: number; defaultYear: number }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(defaultMonth)
  const [year, setYear] = useState(defaultYear)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useOpenOnParam('new', () => { setError(null); setOpen(true) })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null); setLoading(true)
    try {
      const res = await fetch('/api/payroll/run', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodMonth: month, periodYear: year }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || `Failed (${res.status})`)
      router.refresh()
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not run payroll')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button type="button" onClick={() => { setError(null); setOpen(true) }}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium"
        style={{ background: 'var(--indigo)', color: '#fff' }}>
        <Play className="w-3.5 h-3.5" />
        Run payroll
      </button>

      <Modal open={open} onClose={() => !loading && setOpen(false)} title="Run payroll" size="sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Generates payslips for all active staff for the chosen period, with PAYE / UIF / SDL worked out. You review before distributing.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Month">
              <select value={month} onChange={e => setMonth(Number(e.target.value))} className={inputCls} style={inputSty}>
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </FormField>
            <FormField label="Year">
              <input type="number" min="2020" max="2099" value={year} onChange={e => setYear(Number(e.target.value))} className={inputCls} style={inputSty} />
            </FormField>
          </div>
          {error && <p className="text-sm text-red-400 rounded-lg px-3 py-2" style={{ background: 'rgba(239,68,68,0.1)' }}>{error}</p>}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Btn variant="ghost" onClick={() => setOpen(false)} type="button">Cancel</Btn>
            <Btn type="submit" loading={loading}>Run payroll</Btn>
          </div>
        </form>
      </Modal>
    </>
  )
}
