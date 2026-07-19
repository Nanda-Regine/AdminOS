import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import {
  buildVat201WorkingPaper, buildJournalCsv,
  buildIncomeStatement, buildExpensesByCategory, buildIncomeBySource, buildArAging,
} from '@/lib/money/exports'

// GET /api/money/export?type=vat201|journal|income_statement|expenses_by_category|
//   income_by_source|ar_aging [&month=YYYY-MM | &from=YYYY-MM-DD&to=YYYY-MM-DD]
// Returns an accountant-ready CSV working paper for the tenant.
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.app_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  const url = new URL(request.url)
  const type = url.searchParams.get('type') ?? 'vat201'
  const month = url.searchParams.get('month') ?? undefined // YYYY-MM

  // A month wins over explicit from/to — from = 1st, to = last day 23:59:59 (so
  // full-timestamp created_at on the last day is included by the <= window).
  let from = url.searchParams.get('from') ?? undefined
  let to = url.searchParams.get('to') ?? undefined
  let periodLabel: string | undefined
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split('-').map(Number)
    const lastDay = new Date(y, m, 0).getDate()
    from = `${month}-01`
    to = `${month}-${String(lastDay).padStart(2, '0')}T23:59:59`
    periodLabel = new Date(y, m - 1, 1).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })
  }

  const [invRes, expRes] = await Promise.all([
    supabaseAdmin.from('invoices').select('contact_name, amount, amount_paid, status, created_at, due_date').eq('tenant_id', tenantId),
    supabaseAdmin.from('expenses').select('category, description, amount, created_at, status').eq('tenant_id', tenantId),
  ])
  const invoices = invRes.data ?? []
  const expenses = expRes.data ?? []

  const stamp = month ?? new Date().toISOString().slice(0, 10)
  const label = periodLabel ?? (from || to ? `${from ?? 'start'} to ${to ?? stamp}` : undefined)
  let csv: string
  let filename: string

  switch (type) {
    case 'journal':
      csv = buildJournalCsv(invoices, expenses, { from, to })
      filename = `adminos-journal-${stamp}.csv`; break
    case 'income_statement':
      csv = buildIncomeStatement(invoices, expenses, { from, to, label })
      filename = `adminos-income-statement-${stamp}.csv`; break
    case 'expenses_by_category':
      csv = buildExpensesByCategory(expenses, { from, to })
      filename = `adminos-expenses-by-category-${stamp}.csv`; break
    case 'income_by_source':
      csv = buildIncomeBySource(invoices, { from, to })
      filename = `adminos-income-by-source-${stamp}.csv`; break
    case 'ar_aging':
      csv = buildArAging(invoices)
      filename = `adminos-ar-aging-${stamp}.csv`; break
    default:
      csv = buildVat201WorkingPaper(invoices, expenses, { from, to, label }).csv
      filename = `adminos-vat201-${stamp}.csv`
  }

  // Prepend a UTF-8 BOM so Excel on Windows opens ZAR/accented text cleanly.
  return new NextResponse('﻿' + csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
