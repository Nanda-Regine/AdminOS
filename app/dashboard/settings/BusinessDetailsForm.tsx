'use client'

import { useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2 } from 'lucide-react'
import { businessTypeOptions, MONTHS } from '@/lib/business/profile'

export interface BusinessDetailsInitial {
  name: string
  tradingName: string
  businessType: string
  contactEmail: string
  contactPhone: string
  registrationNumber: string
  incorporationDate: string
  financialYearEndMonth: number
  incomeTaxNumber: string
  payeReference: string
  sdlReference: string
  uifReference: string
  payrollDay: number
}

// Module level, not inside the form: a component declared in render remounts
// its inputs on every keystroke and the cursor jumps out.
function Field({ k, label, hint, error, children }: { k: string; label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={`bd-${k}`} className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</label>
      {children}
      {error ? <p className="text-xs mt-1" style={{ color: '#F87171' }}>{error}</p>
        : hint ? <p className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>{hint}</p> : null}
    </div>
  )
}

/**
 * The business's identity and tax registrations. These drive the statutory
 * calendar (year end → IRP6/ITR14 dates; incorporation date → CIPC annual
 * return; industry → NPO report), the payslip (UIF reference), the cash-flow
 * forecast (pay day) and which pages the menu shows (industry).
 */
export function BusinessDetailsForm({ initial }: { initial: BusinessDetailsInitial }) {
  const router = useRouter()
  const [v, setV] = useState(initial)
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [fields, setFields] = useState<Record<string, string>>({})
  const set = <K extends keyof BusinessDetailsInitial>(k: K, value: BusinessDetailsInitial[K]) => setV((p) => ({ ...p, [k]: value }))

  const input = 'w-full text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500'
  const inputStyle = { background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }

  async function save() {
    setState('saving'); setError(null); setFields({})
    try {
      const res = await fetch('/api/settings/profile', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(v),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setFields(json.fields ?? {})
        throw new Error(json.error || `Could not save (${res.status})`)
      }
      setState('saved')
      router.refresh()
      setTimeout(() => setState('idle'), 2500)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save')
      setState('error')
    }
  }

  const textInput = (k: keyof BusinessDetailsInitial, placeholder = '', type = 'text') => (
    <input id={`bd-${k}`} type={type} className={input} style={inputStyle} placeholder={placeholder}
      value={String(v[k] ?? '')} onChange={(e) => set(k, e.target.value as never)} />
  )

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field k="name" error={fields.name} label="Registered name">{textInput('name', 'Sunshine Hardware (Pty) Ltd')}</Field>
        <Field k="tradingName" error={fields.tradingName} label="Trading as" hint="Optional — if customers know you by another name.">{textInput('tradingName')}</Field>
        <Field k="businessType" error={fields.businessType} label="Industry" hint="Shapes your menu and your compliance calendar.">
          <select id="bd-businessType" className={input} style={inputStyle} value={v.businessType} onChange={(e) => set('businessType', e.target.value)}>
            <option value="">Choose…</option>
            {businessTypeOptions(initial.businessType).map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
          </select>
        </Field>
        <Field k="contactEmail" error={fields.contactEmail} label="Business email">{textInput('contactEmail', 'accounts@yourbusiness.co.za', 'email')}</Field>
        <Field k="contactPhone" error={fields.contactPhone} label="Business phone">{textInput('contactPhone', '043 123 4567', 'tel')}</Field>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-dim)' }}>Registration &amp; tax year</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field k="registrationNumber" error={fields.registrationNumber} label="CIPC registration no.">{textInput('registrationNumber', '2019/123456/07')}</Field>
          <Field k="incorporationDate" error={fields.incorporationDate} label="Date of incorporation" hint="Schedules your CIPC annual return.">{textInput('incorporationDate', '', 'date')}</Field>
          <Field k="financialYearEndMonth" error={fields.financialYearEndMonth} label="Financial year ends" hint="Sets your IRP6 and ITR14 dates.">
            <select id="bd-financialYearEndMonth" className={input} style={inputStyle} value={v.financialYearEndMonth}
              onChange={(e) => set('financialYearEndMonth', Number(e.target.value))}>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </Field>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-dim)' }}>SARS &amp; payroll</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field k="incomeTaxNumber" error={fields.incomeTaxNumber} label="Income tax reference">{textInput('incomeTaxNumber', '10 digits')}</Field>
          <Field k="payeReference" error={fields.payeReference} label="PAYE reference">{textInput('payeReference', '7XXXXXXXXX')}</Field>
          <Field k="sdlReference" error={fields.sdlReference} label="SDL reference">{textInput('sdlReference', 'LXXXXXXXXX')}</Field>
          <Field k="uifReference" error={fields.uifReference} label="UIF reference" hint="Printed on payslips.">{textInput('uifReference', 'UXXXXXXXXX')}</Field>
          <Field k="payrollDay" error={fields.payrollDay} label="Pay day" hint="Day of the month salaries go out; used in your cash-flow forecast.">
            <select id="bd-payrollDay" className={input} style={inputStyle} value={v.payrollDay} onChange={(e) => set('payrollDay', Number(e.target.value))}>
              {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </Field>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button type="button" onClick={save} disabled={state === 'saving'}
          className="inline-flex items-center gap-2 text-white text-sm px-4 py-2 rounded-lg transition-colors disabled:opacity-60"
          style={{ background: 'var(--indigo)' }}>
          {state === 'saving' ? <Loader2 className="w-4 h-4 animate-spin" /> : state === 'saved' ? <Check className="w-4 h-4" /> : null}
          {state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : 'Save'}
        </button>
        {error && <span className="text-xs" style={{ color: '#F87171' }}>{error}</span>}
      </div>
    </div>
  )
}
