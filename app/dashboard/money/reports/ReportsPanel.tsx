'use client'

import { useState } from 'react'
import { FileSpreadsheet, Landmark, Receipt, TrendingUp, Users, Clock, Banknote, Download } from 'lucide-react'

const REPORTS = [
  { type: 'income_statement',     label: 'Income Statement (P&L)', desc: 'Revenue, expenses by category, net profit.', icon: TrendingUp, monthly: true },
  { type: 'vat201',              label: 'VAT201 Working Paper',    desc: 'Output vs input VAT → net payable to SARS.', icon: Landmark, monthly: true },
  { type: 'journal',             label: 'General Journal',         desc: 'Double-entry lines, Xero/Sage-importable.', icon: FileSpreadsheet, monthly: true },
  { type: 'expenses_by_category',label: 'Expenses by Category',    desc: 'Every expense grouped + VAT split.', icon: Receipt, monthly: true },
  { type: 'income_by_source',    label: 'Income by Customer',      desc: 'Billed, paid and outstanding per customer.', icon: Users, monthly: true },
  { type: 'ar_aging',            label: 'AR Aging',                desc: 'Outstanding balances bucketed by age (as of today).', icon: Clock, monthly: false },
] as const

function currentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function ReportsPanel() {
  const [month, setMonth] = useState(currentMonth())

  return (
    <div className="space-y-6">
      <div className="glass rounded-2xl p-5 flex items-center gap-4 flex-wrap">
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Month</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Pick a month, then download the pack for your accountant.</p>
        </div>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)}
          className="rounded-lg px-3 py-2 text-sm ml-auto"
          style={{ background: 'var(--surface-2)', color: 'var(--text-primary)', border: '1px solid var(--border)' }} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {REPORTS.map(r => {
          const href = `/api/money/export?type=${r.type}${r.monthly ? `&month=${month}` : ''}`
          return (
            <a key={r.type} href={href}
              className="glass rounded-2xl p-5 flex items-start gap-3 hover:bg-[var(--surface-hover)] transition-colors group">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--indigo-muted)' }}>
                <r.icon className="w-5 h-5" style={{ color: 'var(--indigo-light)' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{r.label}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{r.desc}</p>
                {!r.monthly && <p className="text-[10px] mt-1" style={{ color: 'var(--text-dim)' }}>Snapshot — not month-specific</p>}
              </div>
              <Download className="w-4 h-4 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--text-muted)' }} />
            </a>
          )
        })}

        {/* Payroll summary lives on its own route */}
        <a href="/api/payroll/emp201?format=csv"
          className="glass rounded-2xl p-5 flex items-start gap-3 hover:bg-[var(--surface-hover)] transition-colors group">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--indigo-muted)' }}>
            <Banknote className="w-5 h-5" style={{ color: 'var(--indigo-light)' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Payroll Summary (EMP201)</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>PAYE / UIF / SDL totals from your latest payroll run.</p>
            <p className="text-[10px] mt-1" style={{ color: 'var(--text-dim)' }}>Latest run</p>
          </div>
          <Download className="w-4 h-4 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--text-muted)' }} />
        </a>
      </div>

      <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
        Every report is a clean, categorised working paper (Excel-ready CSV). Hand the pack to your accountant — no integration to maintain.
      </p>
    </div>
  )
}
