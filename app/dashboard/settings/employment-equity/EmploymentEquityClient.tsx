'use client'

import { useMemo, useState } from 'react'
import { Download, Info } from 'lucide-react'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export type Demographics = Partial<{
  african_male: number; african_female: number
  coloured_male: number; coloured_female: number
  indian_male: number; indian_female: number
  white_male: number; white_female: number
  foreign_male: number; foreign_female: number
  disabled: number
}>

export type EEData = {
  reporting_year:     number
  total_workforce:    number | null
  demographics:       Demographics
  eea2_generated_at?: string | null
}

const FIELD =
  'w-full rounded-lg px-3 py-2 text-sm min-h-[40px] bg-[var(--surface-2)] ' +
  'border border-[var(--border)] text-[var(--text-primary)] text-right tabular-nums ' +
  'focus:outline-none focus:ring-2 focus:ring-[var(--indigo)]'
const LABEL = 'block text-xs font-medium mb-1 text-[var(--text-secondary)]'

const RACE_ROWS: { key: 'african' | 'coloured' | 'indian' | 'white' | 'foreign'; label: string }[] = [
  { key: 'african',  label: 'African' },
  { key: 'coloured', label: 'Coloured' },
  { key: 'indian',   label: 'Indian / Asian' },
  { key: 'white',    label: 'White' },
  { key: 'foreign',  label: 'Foreign National' },
]

const num = (v: number | undefined) => v ?? 0

export function EmploymentEquityClient({ initial, currentYear }: { initial: EEData; currentYear: number }) {
  const [year, setYear] = useState(initial.reporting_year)
  const [totalWorkforce, setTotalWorkforce] = useState<number | ''>(initial.total_workforce ?? '')
  const [demo, setDemo] = useState<Demographics>(initial.demographics ?? {})
  const [loadingYear, setLoadingYear] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const demoTotal = useMemo(
    () => RACE_ROWS.reduce((sum, r) => sum + num(demo[`${r.key}_male` as keyof Demographics]) + num(demo[`${r.key}_female` as keyof Demographics]), 0),
    [demo]
  )

  function setCell(key: keyof Demographics, value: string) {
    const n = value === '' ? undefined : Math.max(0, parseInt(value, 10) || 0)
    setDemo(prev => ({ ...prev, [key]: n }))
  }

  async function loadYear(y: number) {
    setYear(y); setLoadingYear(true); setError(null); setSaved(false)
    try {
      const res = await fetch(`/api/ee?year=${y}`)
      if (!res.ok) throw new Error('Could not load that year')
      const data = await res.json()
      setTotalWorkforce(data.total_workforce ?? '')
      setDemo(data.demographics ?? {})
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load that year')
    } finally {
      setLoadingYear(false)
    }
  }

  async function save() {
    setSaving(true); setError(null); setSaved(false)
    try {
      const res = await fetch('/api/ee', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportingYear:  year,
          totalWorkforce: totalWorkforce === '' ? undefined : Number(totalWorkforce),
          demographics: {
            african_male:    num(demo.african_male),
            african_female:  num(demo.african_female),
            coloured_male:   num(demo.coloured_male),
            coloured_female: num(demo.coloured_female),
            indian_male:     num(demo.indian_male),
            indian_female:   num(demo.indian_female),
            white_male:      num(demo.white_male),
            white_female:    num(demo.white_female),
            foreign_male:    num(demo.foreign_male),
            foreign_female:  num(demo.foreign_female),
            disabled:        num(demo.disabled),
          },
        }),
      })
      if (!res.ok) {
        const b = await res.json().catch(() => null)
        throw new Error(b?.error ?? 'Could not save employment equity data')
      }
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save employment equity data')
    } finally {
      setSaving(false)
    }
  }

  const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - 4 + i)

  return (
    <div className="space-y-4 md:space-y-6 max-w-3xl">
      <Card>
        <div className="p-4 flex items-start gap-3" style={{ background: 'var(--indigo-muted)', borderRadius: 12 }}>
          <Info className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--indigo-light)' }} />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            South African businesses with 50 or more employees (or that meet their sector&rsquo;s turnover
            threshold) must submit annual EEA2 and EEA4 reports to the Department of Employment and Labour.
            This page is for internal data collection only — it does not submit anything to the department.
            The official submission still happens via the DoEL&rsquo;s own online system (
            <span className="whitespace-nowrap">www.labour.gov.za</span>).
          </p>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reporting year</CardTitle>
          <select
            value={year}
            onChange={e => loadYear(Number(e.target.value))}
            disabled={loadingYear}
            className={`${FIELD} w-auto text-left`}
          >
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </CardHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          <div>
            <label className={LABEL} htmlFor="tw">Total workforce</label>
            <input
              id="tw" type="number" min={0}
              value={totalWorkforce}
              onChange={e => setTotalWorkforce(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value, 10) || 0))}
              className={`${FIELD} text-left`}
              placeholder="e.g. 62"
            />
          </div>
          <div>
            <label className={LABEL} htmlFor="dis">Employees with disabilities</label>
            <input
              id="dis" type="number" min={0}
              value={demo.disabled ?? ''}
              onChange={e => setCell('disabled', e.target.value)}
              className={`${FIELD} text-left`}
            />
          </div>
        </div>

        <div className="overflow-x-auto -mx-1 px-1">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th className="text-left px-2 py-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                  Race group
                </th>
                <th className="text-right px-2 py-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                  Male
                </th>
                <th className="text-right px-2 py-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                  Female
                </th>
              </tr>
            </thead>
            <tbody>
              {RACE_ROWS.map(r => (
                <tr key={r.key} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td className="px-2 py-2" style={{ color: 'var(--text-primary)' }}>{r.label}</td>
                  <td className="px-2 py-2">
                    <input
                      type="number" min={0} aria-label={`${r.label} male`}
                      value={demo[`${r.key}_male` as keyof Demographics] ?? ''}
                      onChange={e => setCell(`${r.key}_male` as keyof Demographics, e.target.value)}
                      className={FIELD}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number" min={0} aria-label={`${r.label} female`}
                      value={demo[`${r.key}_female` as keyof Demographics] ?? ''}
                      onChange={e => setCell(`${r.key}_female` as keyof Demographics, e.target.value)}
                      className={FIELD}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="px-2 py-2 font-semibold" style={{ color: 'var(--text-primary)' }}>Demographics total</td>
                <td colSpan={2} className="px-2 py-2 text-right font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                  {demoTotal}
                  {totalWorkforce !== '' && demoTotal !== totalWorkforce && (
                    <span className="ml-2 text-xs font-normal" style={{ color: 'var(--chip-amber-fg)' }}>
                      ≠ total workforce ({totalWorkforce})
                    </span>
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {error && (
          <div className="rounded-lg px-3 py-2 text-sm mt-4"
               style={{ background: 'var(--chip-red-bg)', color: 'var(--chip-red-fg)' }}>{error}</div>
        )}
        {saved && !error && (
          <div className="rounded-lg px-3 py-2 text-sm mt-4"
               style={{ background: 'var(--chip-green-bg)', color: 'var(--chip-green-fg)' }}>Saved.</div>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3 pt-5 mt-1" style={{ borderTop: '1px solid var(--border)' }}>
          <a
            href={`/api/ee/report?year=${year}&download=true`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors px-4 py-2 text-sm min-h-[44px]"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
          >
            <Download className="w-4 h-4" /> Download EEA2 report
          </a>
          <Button onClick={save} loading={saving || loadingYear}>Save employment equity data</Button>
        </div>
      </Card>
    </div>
  )
}
