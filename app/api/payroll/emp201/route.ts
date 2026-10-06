import { NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { generateEMP201 } from '@/lib/payroll/calculate'
import { withRoute, unwrap, notFound } from '@/lib/api/withRoute'

// GET /api/payroll/emp201?month=6&year=2026[&format=csv]
// EMP201 totals for a pay period — the latest calculated run when no period is given.

const query = z.object({
  month:    z.coerce.number().int().min(1).max(12).optional(),
  year:     z.coerce.number().int().min(2020).max(2099).optional(),
  format:   z.enum(['json', 'csv']).optional(),
  download: z.enum(['true', 'false']).optional(),
})

export const GET = withRoute({ action: 'payroll.read', query }, async ({ ctx, query: q }) => {
  const { tenantId } = ctx
  const asCsv = q.format === 'csv' || q.download === 'true'

  // Only calculated runs: a draft/processing run has no reliable figures.
  let runQuery = supabaseAdmin
    .from('payroll_runs')
    .select('id, period_month, period_year, status, emp201_data')
    .eq('tenant_id', tenantId)
    .in('status', ['finalised', 'paid'])
    .is('deleted_at', null)

  runQuery = q.month && q.year
    ? runQuery.eq('period_month', q.month).eq('period_year', q.year)
    : runQuery.order('period_year', { ascending: false }).order('period_month', { ascending: false }).limit(1)

  const run = unwrap(await runQuery.maybeSingle())
  if (!run) throw notFound('No calculated payroll for this period yet. Run payroll first.')
  const month = run.period_month as number
  const year  = run.period_year  as number

  // Cached by the run; regenerated from live payslips for runs calculated
  // before it was cached. generateEMP201 now accepts payslip rows directly —
  // it used to read camelCase fields off snake_case rows and return NaN UIF.
  let emp201 = run.emp201_data as Record<string, unknown> | null
  if (!emp201) {
    const payslips = unwrap(await supabaseAdmin
      .from('payslips')
      .select('paye, uif_employee, uif_employer, sdl')
      .eq('payroll_run_id', run.id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)) ?? []
    emp201 = generateEMP201(payslips, month, year) as unknown as Record<string, unknown>
    await supabaseAdmin.from('payroll_runs').update({ emp201_data: emp201 }).eq('id', run.id).eq('tenant_id', tenantId)
  }

  if (!asCsv) return { run_id: run.id, period: { month, year }, emp201 }

  // ── EMP201 working paper CSV, Excel-friendly UTF-8 BOM ─────────────────────
  const { data: tenant } = await supabaseAdmin.from('tenants').select('name').eq('id', tenantId).maybeSingle()
  const monthName = new Date(year, month - 1, 1).toLocaleDateString('en-ZA', { timeZone: 'Africa/Johannesburg', month: 'long', year: 'numeric' })
  const humanize = (k: string) => k.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\bPaye\b/i, 'PAYE').replace(/\bUif\b/i, 'UIF').replace(/\bSdl\b/i, 'SDL').replace(/\bEti\b/i, 'ETI')
  const cell = (v: unknown) => {
    const s = String(v ?? '')
    // Leading = + - @ would run as a formula when the accountant opens the CSV.
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
  }
  const lines: string[] = [
    ['EMP201 Working Paper'].map(cell).join(','),
    ['Business', tenant?.name ?? ''].map(cell).join(','),
    ['Period', monthName].map(cell).join(','),
    ['Generated', new Date().toLocaleDateString('en-ZA', { timeZone: 'Africa/Johannesburg' })].map(cell).join(','),
    '',
    ['Item', 'Amount (ZAR)'].map(cell).join(','),
    ...Object.entries(emp201)
      .filter(([k]) => k !== 'periodMonth' && k !== 'periodYear')
      .map(([k, v]) => [humanize(k), typeof v === 'number' ? (k === 'employeeCount' ? String(v) : v.toFixed(2)) : String(v ?? '')].map(cell).join(',')),
  ]
  return new NextResponse('﻿' + lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="adminos-emp201-${year}-${String(month).padStart(2, '0')}.csv"`,
      'Cache-Control': 'private, no-store',
    },
  })
})
