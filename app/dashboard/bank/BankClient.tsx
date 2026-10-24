'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Landmark, Upload, CheckCircle2, EyeOff, Undo2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatZAR } from '@/lib/format'
import { EXPENSE_ACCOUNTS, INCOME_ACCOUNTS } from '@/lib/finance/chartOfAccounts'

type Suggestion = {
  invoiceId: string; reference: string | null; contactName: string | null; outstanding: number
  confidence: 'high' | 'medium'; reasons: string[]; partial: boolean; ambiguous: boolean
}
type Tx = {
  id: string; occurred_on: string; description: string; amount: number; balance: number | null
  category: string | null; category_source: string | null
  match_status: 'unmatched' | 'matched' | 'ignored'; matched_invoice_id: string | null
  suggestion: Suggestion | null
}
type Summary = { lines: number; moneyIn: number; moneyOut: number; unmatchedCredits: number; unmatchedCreditValue: number; uncategorisedDebits: number }
type Preview = {
  rows: { index: number; date: string; description: string; amount: number; duplicate: boolean; category: string | null
    match: { reference: string | null; contactName: string | null; confidence: 'high' | 'medium'; partial: boolean } | null }[]
  skipped: number; warnings: string[]; newCount: number; duplicateCount: number; moneyIn: number; moneyOut: number
  periodStart: string | null; periodEnd: string | null
}

const TABS = [
  { key: 'unmatched', label: 'To review' },
  { key: 'matched', label: 'Matched' },
  { key: 'ignored', label: 'Ignored' },
  { key: 'all', label: 'All' },
] as const
type TabKey = (typeof TABS)[number]['key']

const labelFor = (key: string | null) =>
  key ? [...EXPENSE_ACCOUNTS, ...INCOME_ACCOUNTS].find((a) => a.key === key)?.label ?? key : null

const fmtDate = (d: string) =>
  new Date(d + 'T12:00:00Z').toLocaleDateString('en-ZA', { timeZone: 'Africa/Johannesburg', day: '2-digit', month: 'short', year: 'numeric' })

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const fields = body.fields ? Object.values(body.fields).join(' ') : ''
    throw new Error(body.error ? `${body.error}${fields ? ' ' + fields : ''}` : 'Something went wrong. Please try again.')
  }
  return body as T
}

export function BankClient({ hasLines }: { hasLines: boolean }) {
  const router = useRouter()
  const [tab, setTab] = useState<TabKey>('unmatched')
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<Tx[]>([])
  const [total, setTotal] = useState(0)
  const [pageSize, setPageSize] = useState(50)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await api<{ rows: Tx[]; total: number; pageSize: number; summary: Summary }>(`/api/bank/transactions?status=${tab}&page=${page}`)
      setRows(d.rows); setTotal(d.total); setPageSize(d.pageSize); setSummary(d.summary); setError(null)
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load bank lines.') }
    finally { setLoading(false) }
  }, [tab, page])

  useEffect(() => { void load() }, [load])

  async function send(mode: 'preview' | 'commit') {
    if (!file) return
    setUploading(true); setError(null); setNotice(null)
    try {
      const form = new FormData(); form.append('file', file)
      if (mode === 'preview') {
        setPreview(await api<Preview>('/api/bank/import?mode=preview', { method: 'POST', body: form }))
      } else {
        const r = await api<{ imported: number; duplicates: number; categorised: number }>('/api/bank/import?mode=commit', { method: 'POST', body: form })
        setNotice(`Imported ${r.imported} new line${r.imported === 1 ? '' : 's'} (${r.categorised} categorised automatically)${r.duplicates ? `; ${r.duplicates} already imported were skipped` : ''}.`)
        setPreview(null); setFile(null); if (fileRef.current) fileRef.current.value = ''
        setTab('unmatched'); setPage(1); await load()
        router.refresh() // clears the server-rendered first-use empty state
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Upload failed.') }
    finally { setUploading(false) }
  }

  async function patch(id: string, body: Record<string, unknown>, okMsg?: string) {
    setBusy(id); setError(null); setNotice(null)
    try {
      await api(`/api/bank/transactions/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (okMsg) setNotice(okMsg)
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : 'That change did not save.') }
    finally { setBusy(null) }
  }

  const highPairs = rows.filter((r) => r.suggestion?.confidence === 'high' && r.match_status === 'unmatched')
    .map((r) => ({ transactionId: r.id, invoiceId: r.suggestion!.invoiceId }))

  async function confirmAllHigh() {
    setBusy('bulk'); setError(null); setNotice(null)
    try {
      const r = await api<{ matched: number; failed: number }>('/api/bank/reconcile', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ matches: highPairs.slice(0, 50) }),
      })
      setNotice(`${r.matched} payment${r.matched === 1 ? '' : 's'} recorded${r.failed ? `; ${r.failed} could not be applied` : ''}.`)
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not confirm those matches.') }
    finally { setBusy(null) }
  }

  const pages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {summary && summary.lines > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <Stat label="Money in" value={formatZAR(summary.moneyIn)} tone="var(--chip-green-fg)" />
          <Stat label="Money out" value={formatZAR(summary.moneyOut)} tone="var(--chip-red-fg)" />
          <Stat label="Payments to match" value={String(summary.unmatchedCredits)} sub={summary.unmatchedCredits ? formatZAR(summary.unmatchedCreditValue) : undefined} tone="var(--chip-amber-fg)" />
          <Stat label="Spend to categorise" value={String(summary.uncategorisedDebits)} tone="var(--text-primary)" />
        </div>
      )}

      <Card>
        <div className="p-4 md:p-5 space-y-3">
          <div className="flex items-start gap-3">
            <Landmark className="w-5 h-5 mt-0.5 shrink-0" style={{ color: 'var(--indigo-light)' }} aria-hidden />
            <div className="min-w-0">
              <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Upload a bank statement</h2>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                In your banking app choose Export → CSV (FNB, Capitec, ABSA, Standard Bank, Nedbank and TymeBank work). You see exactly what will happen before anything is saved.
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <label className="flex-1 min-w-0">
              <span className="sr-only">Bank statement CSV file</span>
              <input
                ref={fileRef} type="file" accept=".csv,.txt,text/csv"
                onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPreview(null); setError(null) }}
                className="block w-full text-sm min-h-[44px] file:mr-3 file:rounded-lg file:border-0 file:px-4 file:py-2.5 file:font-medium file:cursor-pointer"
                style={{ color: 'var(--text-secondary)' }}
              />
            </label>
            <Button onClick={() => send('preview')} disabled={!file || uploading} loading={uploading && !preview} variant="secondary">
              <Upload className="w-4 h-4" aria-hidden /> Check statement
            </Button>
          </div>
        </div>
      </Card>

      {error && <p role="alert" className="text-sm rounded-lg px-4 py-3" style={{ background: 'var(--chip-red-bg)', color: 'var(--chip-red-fg)' }}>{error}</p>}
      {notice && <p role="status" className="text-sm rounded-lg px-4 py-3" style={{ background: 'var(--chip-green-bg)', color: 'var(--chip-green-fg)' }}>{notice}</p>}

      {preview && (
        <Card>
          <div className="p-4 md:p-5 space-y-4">
            <div>
              <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                {preview.newCount} new line{preview.newCount === 1 ? '' : 's'} ready to import
              </h2>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {preview.periodStart && preview.periodEnd ? `${fmtDate(preview.periodStart)} – ${fmtDate(preview.periodEnd)} · ` : ''}
                {formatZAR(preview.moneyIn)} in · {formatZAR(preview.moneyOut)} out
                {preview.duplicateCount > 0 && ` · ${preview.duplicateCount} already imported (will be skipped)`}
                {preview.skipped > 0 && ` · ${preview.skipped} unreadable line${preview.skipped === 1 ? '' : 's'} skipped`}
              </p>
              {preview.warnings.map((w) => <p key={w} className="text-xs mt-1" style={{ color: 'var(--chip-amber-fg)' }}>{w}</p>)}
            </div>
            <ul className="divide-y max-h-80 overflow-y-auto rounded-lg border" style={{ borderColor: 'var(--border)' }}>
              {preview.rows.slice(0, 100).map((r) => (
                <li key={r.index} className="px-3 py-2 flex items-center gap-3 text-sm" style={{ opacity: r.duplicate ? 0.5 : 1, borderColor: 'var(--border)' }}>
                  <span className="w-20 shrink-0 text-xs" style={{ color: 'var(--text-muted)' }}>{fmtDate(r.date)}</span>
                  <span className="flex-1 min-w-0 truncate" style={{ color: 'var(--text-primary)' }}>{r.description}</span>
                  {r.duplicate ? <Badge variant="gray">Already imported</Badge>
                    : r.match ? <Badge variant="green">Pays {r.match.reference ?? 'an invoice'}</Badge>
                    : r.category ? <Badge variant="blue">{labelFor(r.category)}</Badge> : null}
                  <span className="w-24 shrink-0 text-right tabular-nums" style={{ color: r.amount > 0 ? 'var(--chip-green-fg)' : 'var(--text-primary)' }}>{formatZAR(r.amount, { cents: true })}</span>
                </li>
              ))}
            </ul>
            {preview.rows.length > 100 && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Showing the first 100 of {preview.rows.length} lines.</p>}
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => send('commit')} loading={uploading} disabled={preview.newCount === 0}>Import {preview.newCount} line{preview.newCount === 1 ? '' : 's'}</Button>
              <Button variant="ghost" onClick={() => setPreview(null)}>Cancel</Button>
            </div>
          </div>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Bank lines">
        {TABS.map((t) => (
          <button
            key={t.key} role="tab" aria-selected={tab === t.key}
            onClick={() => { setTab(t.key); setPage(1) }}
            className="px-4 min-h-[44px] rounded-full text-sm font-medium border transition-colors"
            style={tab === t.key
              ? { background: 'var(--indigo)', color: '#fff', borderColor: 'var(--indigo)' }
              : { color: 'var(--text-secondary)', borderColor: 'var(--border)' }}
          >{t.label}</button>
        ))}
        {tab === 'unmatched' && highPairs.length > 0 && (
          <Button size="sm" className="ml-auto" onClick={confirmAllHigh} loading={busy === 'bulk'}>
            <CheckCircle2 className="w-4 h-4" aria-hidden /> Confirm {highPairs.length} sure match{highPairs.length === 1 ? '' : 'es'}
          </Button>
        )}
      </div>

      {loading && rows.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }} role="status">Loading bank lines…</p>
      ) : rows.length === 0 ? (
        hasLines || summary?.lines ? (
          <Card>
            <EmptyState
              icon={Landmark}
              title="Nothing here"
              body={tab === 'unmatched' ? 'Every line has been reviewed. Nice.' : 'No lines in this view.'}
            />
          </Card>
        ) : null
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => <TxCard key={r.id} tx={r} busy={busy === r.id} onPatch={patch} />)}
        </ul>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-between">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Page {page} of {pages}</span>
          <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone: string }) {
  return (
    <Card>
      <div className="p-4">
        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</div>
        <div className="text-xl md:text-2xl font-bold mt-1 tabular-nums" style={{ color: tone }}>{value}</div>
        {sub && <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{sub}</div>}
      </div>
    </Card>
  )
}

function TxCard({ tx, busy, onPatch }: { tx: Tx; busy: boolean; onPatch: (id: string, body: Record<string, unknown>, okMsg?: string) => void }) {
  const money = tx.amount > 0
  const [remember, setRemember] = useState(true)
  const s = tx.suggestion
  const accounts = money ? INCOME_ACCOUNTS : EXPENSE_ACCOUNTS

  return (
    <li>
      <Card>
        <div className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{fmtDate(tx.occurred_on)}</div>
              <div className="font-medium break-words" style={{ color: 'var(--text-primary)' }}>{tx.description}</div>
            </div>
            <div className="text-right shrink-0">
              <div className="font-bold tabular-nums" style={{ color: money ? 'var(--chip-green-fg)' : 'var(--text-primary)' }}>
                {money ? '+' : '−'}{formatZAR(Math.abs(tx.amount), { cents: true })}
              </div>
              {tx.match_status === 'matched' && <Badge variant="green">Matched to invoice</Badge>}
              {tx.match_status === 'ignored' && <Badge variant="gray">Ignored</Badge>}
            </div>
          </div>

          {tx.match_status === 'unmatched' && s && (
            <div className="rounded-lg p-3 flex flex-col sm:flex-row sm:items-center gap-3" style={{ background: 'var(--chip-green-bg)' }}>
              <div className="flex-1 min-w-0 text-sm" style={{ color: 'var(--chip-green-fg)' }}>
                <div className="font-semibold">
                  {s.confidence === 'high' ? 'Looks like payment for ' : 'Could be payment for '}
                  {s.reference ?? 'an invoice'}{s.contactName ? ` · ${s.contactName}` : ''}
                </div>
                <div className="text-xs opacity-90">
                  {formatZAR(s.outstanding, { cents: true })} owed · {s.reasons.join(' · ')}
                  {s.partial && ' · part-payment'}{s.ambiguous && ' · another invoice fits equally — check first'}
                </div>
              </div>
              <Button size="sm" loading={busy} onClick={() => onPatch(tx.id, { matchInvoiceId: s.invoiceId }, `Payment recorded against ${s.reference ?? 'the invoice'}.`)}>
                <CheckCircle2 className="w-4 h-4" aria-hidden /> Confirm payment
              </Button>
            </div>
          )}

          {tx.match_status === 'unmatched' && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <label className="flex-1 min-w-0">
                <span className="sr-only">Category for this line</span>
                <select
                  value={tx.category ?? ''}
                  disabled={busy}
                  onChange={(e) => e.target.value && onPatch(tx.id, { category: e.target.value, remember })}
                  className="w-full min-h-[44px] rounded-lg border px-3 text-sm"
                  style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                >
                  <option value="">{money ? 'Categorise this income…' : 'Choose a category…'}</option>
                  {accounts.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-2 text-xs min-h-[44px]" style={{ color: 'var(--text-muted)' }}>
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="w-4 h-4" />
                Remember for this vendor
              </label>
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => onPatch(tx.id, { ignore: true })}>
                <EyeOff className="w-4 h-4" aria-hidden /> Not business
              </Button>
            </div>
          )}

          {tx.match_status === 'ignored' && (
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => onPatch(tx.id, { ignore: false })}>
              <Undo2 className="w-4 h-4" aria-hidden /> Bring back
            </Button>
          )}
          {tx.match_status === 'matched' && tx.category && <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{labelFor(tx.category)}</div>}
        </div>
      </Card>
    </li>
  )
}
