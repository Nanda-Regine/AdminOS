'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Modal, Btn } from '@/components/ui/modal'

/**
 * Recalculate / send payslips for one run. These were native <form> posts,
 * so the browser navigated to the route's raw JSON response.
 */
export function PayrollRunActions({ runId, status, periodMonth, periodYear, payslipCount, compact }: {
  runId: string
  status: string
  periodMonth: number
  periodYear: number
  /** Known for the latest run; omitted for history rows (the server checks it either way). */
  payslipCount?: number
  compact?: boolean
}) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState<null | 'recalc' | 'send'>(null)
  const [error, setError] = useState<string | null>(null)

  async function call(kind: 'recalc' | 'send') {
    setLoading(kind)
    setError(null)
    try {
      const res = kind === 'send'
        ? await fetch(`/api/payroll/${runId}/distribute`, { method: 'POST' })
        : await fetch('/api/payroll/run', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ periodMonth, periodYear }),
          })
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? `Failed (${res.status})`)
      setConfirming(false)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(null)
    }
  }

  if (status === 'paid') return <span className="text-xs" style={{ color: 'var(--text-dim)' }}>Payslips sent</span>

  const small = 'text-xs hover:underline disabled:opacity-50'
  const big = 'text-sm px-4 py-2 rounded-lg transition-colors disabled:opacity-50'

  return (
    <div className={compact ? 'flex flex-col gap-1' : 'space-y-2'}>
      <div className={compact ? 'flex gap-3' : 'flex flex-wrap gap-3'}>
        {status === 'finalised' && payslipCount !== 0 && (
          <button type="button" onClick={() => { setError(null); setConfirming(true) }}
            className={compact ? small : big}
            style={compact ? { color: 'var(--indigo-light)' } : { background: 'var(--indigo)', color: '#fff' }}>
            Send payslips
          </button>
        )}
        <button type="button" disabled={loading !== null} onClick={() => call('recalc')}
          className={compact ? small : `${big} border`}
          style={compact ? { color: 'var(--text-muted)' } : { borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
          {loading === 'recalc' ? 'Calculating…' : status === 'finalised' ? 'Recalculate' : 'Calculate'}
        </button>
      </div>
      {error && !confirming && <p className="text-xs text-red-400">{error}</p>}

      <Modal open={confirming} onClose={() => loading === null && setConfirming(false)} title="Send payslips?" size="sm">
        <div className="space-y-4">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            This marks {periodMonth}/{periodYear} payroll as paid and WhatsApps {payslipCount === undefined ? 'every employee on it' : `${payslipCount} employee${payslipCount === 1 ? '' : 's'}`} a private link to their payslip. It can&apos;t be recalculated afterwards.
            You&apos;ll get a summary of anyone it couldn&apos;t reach.
          </p>
          {error && <p className="text-sm text-red-400 rounded-lg px-3 py-2" style={{ background: 'rgba(239,68,68,0.1)' }}>{error}</p>}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Btn variant="ghost" onClick={() => setConfirming(false)}>Not yet</Btn>
            <Btn loading={loading === 'send'} onClick={() => call('send')}>Yes, send payslips</Btn>
          </div>
        </div>
      </Modal>
    </div>
  )
}
