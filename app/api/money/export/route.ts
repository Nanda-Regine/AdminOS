import { NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { fetchAll } from '@/lib/supabase/fetchAll'
import { withRoute } from '@/lib/api/withRoute'
import {
  buildVat201WorkingPaper, buildJournalCsv,
  buildIncomeStatement, buildExpensesByCategory, buildIncomeBySource, buildIncomeByCategory, buildArAging,
  type ExportInvoice, type ExportExpense,
} from '@/lib/money/exports'
import { sastDate } from '@/lib/time/sast'

// GET /api/money/export?type=vat201|journal|income_statement|expenses_by_category|
//   income_by_source|income_by_category|ar_aging [&month=YYYY-MM | &from=YYYY-MM-DD&to=YYYY-MM-DD]
// Returns an accountant-ready CSV working paper for the tenant.

const TYPES = ['vat201', 'journal', 'income_statement', 'expenses_by_category', 'income_by_source', 'income_by_category', 'ar_aging'] as const

const query = z.object({
  type:  z.enum(TYPES).default('vat201'),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(),
  from:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

export const GET = withRoute({
  action: 'money.read',
  query,
  audit: 'money.exported',
  resourceType: 'export',
}, async ({ ctx, query: q }) => {
  const { tenantId } = ctx

  // A month wins over explicit from/to — from = 1st, to = last day. Both are
  // inclusive SAST calendar dates (lib/money/exports inWindow).
  let from = q.from
  let to = q.to
  let periodLabel: string | undefined
  if (q.month) {
    const [y, m] = q.month.split('-').map(Number)
    const lastDay = new Date(y, m, 0).getDate()
    from = `${q.month}-01`
    to = `${q.month}-${String(lastDay).padStart(2, '0')}`
    periodLabel = new Date(y, m - 1, 1).toLocaleDateString('en-ZA', { timeZone: 'Africa/Johannesburg', month: 'long', year: 'numeric' })
  }

  // Every row, paged: these were plain selects, so a tenant past 1000
  // invoices got a VAT201 / P&L silently built from the first 1000 only.
  const [invoices, expenses] = await Promise.all([
    fetchAll<ExportInvoice>((a, b) => supabaseAdmin.from('invoices')
      .select('contact_name, amount, amount_paid, vat_amount, status, created_at, due_date, category')
      .eq('tenant_id', tenantId).is('deleted_at', null).order('id').range(a, b)),
    q.type === 'ar_aging' || q.type === 'income_by_source' || q.type === 'income_by_category'
      ? Promise.resolve([] as ExportExpense[])
      : fetchAll<ExportExpense>((a, b) => supabaseAdmin.from('expenses')
          .select('category, description, amount, created_at, status')
          .eq('tenant_id', tenantId).is('deleted_at', null).order('id').range(a, b)),
  ])

  const stamp = q.month ?? sastDate()
  const label = periodLabel ?? (from || to ? `${from ?? 'start'} to ${q.to ?? stamp}` : undefined)
  let csv: string
  let filename: string

  switch (q.type) {
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
    case 'income_by_category':
      csv = buildIncomeByCategory(invoices, { from, to })
      filename = `adminos-income-by-category-${stamp}.csv`; break
    case 'ar_aging':
      csv = buildArAging(invoices)
      filename = `adminos-ar-aging-${stamp}.csv`; break
    default:
      csv = buildVat201WorkingPaper(invoices, expenses, { from, to, label }).csv
      filename = `adminos-vat201-${stamp}.csv`
  }

  // UTF-8 BOM so Excel on Windows opens ZAR/accented text cleanly.
  return new NextResponse('﻿' + csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  })
})
