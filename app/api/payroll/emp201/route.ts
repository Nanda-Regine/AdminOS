import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { generateEMP201 } from '@/lib/payroll/calculate'
import { checkPermission } from '@/lib/auth/permissions'

// GET /api/payroll/emp201?month=6&year=2026
// Returns EMP201 totals for a given pay period

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.app_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  if (!(await checkPermission('view_payroll'))) return new NextResponse('Forbidden', { status: 403 })

  const url        = new URL(request.url)
  const monthParam = url.searchParams.get('month')
  const yearParam  = url.searchParams.get('year')
  const asCsv      = url.searchParams.get('format') === 'csv' || url.searchParams.get('download') === 'true'

  // Resolve the run: an explicit period if given, otherwise the LATEST run (the
  // old default of "current month" 404'd whenever this month hadn't been run yet).
  let runQuery = supabaseAdmin
    .from('payroll_runs')
    .select('id, period_month, period_year, status, emp201_data')
    .eq('tenant_id', tenantId)

  if (monthParam && yearParam) {
    const month = parseInt(monthParam), year = parseInt(yearParam)
    if (isNaN(month) || month < 1 || month > 12 || isNaN(year)) {
      return NextResponse.json({ error: 'Invalid month or year' }, { status: 400 })
    }
    runQuery = runQuery.eq('period_month', month).eq('period_year', year)
  } else {
    runQuery = runQuery.order('period_year', { ascending: false }).order('period_month', { ascending: false }).limit(1)
  }

  const { data: run, error: runError } = await runQuery.maybeSingle()
  if (runError) return NextResponse.json({ error: runError.message }, { status: 400 })
  if (!run) {
    return NextResponse.json({ message: 'No payroll run found yet. Run payroll first.' }, { status: 404 })
  }
  const month = run.period_month as number
  const year  = run.period_year  as number

  // Use cached EMP201 data, or regenerate from payslips.
  let emp201 = run.emp201_data as Record<string, unknown> | null
  if (!emp201) {
    const { data: payslips, error: psError } = await supabaseAdmin
      .from('payslips').select('*').eq('payroll_run_id', run.id)
    if (psError) return NextResponse.json({ error: psError.message }, { status: 400 })
    emp201 = generateEMP201(payslips ?? [], month, year) as unknown as Record<string, unknown>
    await supabaseAdmin.from('payroll_runs').update({ emp201_data: emp201 }).eq('id', run.id)
  }

  if (!asCsv) {
    return NextResponse.json({ run_id: run.id, period: { month, year }, emp201 })
  }

  // ── Professional CSV (EMP201 working paper), Excel-friendly UTF-8 BOM ─────────
  const { data: tenant } = await supabaseAdmin.from('tenants').select('name').eq('id', tenantId).maybeSingle()
  const monthName = new Date(year, month - 1, 1).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })
  const humanize = (k: string) => k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\bPaye\b/i, 'PAYE').replace(/\bUif\b/i, 'UIF').replace(/\bSdl\b/i, 'SDL')
  const cell = (v: unknown) => {
    const s = String(v ?? '')
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines: string[] = [
    ['EMP201 Working Paper'].map(cell).join(','),
    ['Business', tenant?.name ?? ''].map(cell).join(','),
    ['Period', monthName].map(cell).join(','),
    ['Generated', new Date().toLocaleDateString('en-ZA')].map(cell).join(','),
    '',
    ['Item', 'Amount (ZAR)'].map(cell).join(','),
    ...Object.entries(emp201).map(([k, v]) =>
      [humanize(k), typeof v === 'number' ? v.toFixed(2) : String(v ?? '')].map(cell).join(',')),
  ]
  const csv = '﻿' + lines.join('\r\n')
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="adminos-emp201-${year}-${String(month).padStart(2, '0')}.csv"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
