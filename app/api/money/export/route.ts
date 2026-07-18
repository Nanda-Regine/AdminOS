import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { buildVat201WorkingPaper, buildJournalCsv } from '@/lib/money/exports'

// GET /api/money/export?type=vat201|journal[&from=YYYY-MM-DD&to=YYYY-MM-DD]
// Returns an accountant-ready CSV working paper for the tenant.
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.app_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  const url = new URL(request.url)
  const type = url.searchParams.get('type') ?? 'vat201'
  const from = url.searchParams.get('from') ?? undefined
  const to = url.searchParams.get('to') ?? undefined

  const [invRes, expRes] = await Promise.all([
    supabaseAdmin.from('invoices').select('contact_name, amount, amount_paid, status, created_at, due_date').eq('tenant_id', tenantId),
    supabaseAdmin.from('expenses').select('category, description, amount, created_at, status').eq('tenant_id', tenantId),
  ])
  const invoices = invRes.data ?? []
  const expenses = expRes.data ?? []

  const stamp = new Date().toISOString().slice(0, 10)
  let csv: string
  let filename: string

  if (type === 'journal') {
    csv = buildJournalCsv(invoices, expenses, { from, to })
    filename = `adminos-journal-${stamp}.csv`
  } else {
    csv = buildVat201WorkingPaper(invoices, expenses, { from, to, label: from || to ? `${from ?? 'start'} to ${to ?? stamp}` : undefined }).csv
    filename = `adminos-vat201-${stamp}.csv`
  }

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
