import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'
import { checkPermission } from '@/lib/auth/permissions'

// Profit First — 5-account allocation model by Mike Michalowicz
// Columns: income_account, profit_account, owner_pay_account, tax_account, opex_account

const setupSchema = z.object({
  incomeAccount:   z.string().min(1).max(100).default('INCOME'),
  profitAccount:   z.string().min(1).max(100).default('PROFIT'),
  ownerPayAccount: z.string().min(1).max(100).default('OWNER PAY'),
  taxAccount:      z.string().min(1).max(100).default('TAX'),
  opexAccount:     z.string().min(1).max(100).default('OPEX'),
  profitPct:       z.number().min(0).max(100).default(5),
  ownerPayPct:     z.number().min(0).max(100).default(50),
  taxPct:          z.number().min(0).max(100).default(15),
  // opexPct is auto-calculated: 100 - profit - ownerPay - tax
  transferDays:    z.array(z.number().int().min(1).max(28)).default([10, 25]),
})

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.app_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  if (!(await checkPermission('view_financials'))) return new NextResponse('Forbidden', { status: 403 })

  const { data, error } = await supabaseAdmin
    .from('profit_first_config')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  if (!data) {
    return NextResponse.json({
      configured: false,
      message: 'Profit First not yet configured. Use PATCH to set up your 5 accounts.',
      defaults: { profit_pct: 5, owner_pay_pct: 50, tax_pct: 15, opex_pct: 30, transfer_days: [10, 25] },
    })
  }

  return NextResponse.json({ ...data, configured: data.setup_complete })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.app_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  if (!(await checkPermission('view_financials'))) return new NextResponse('Forbidden', { status: 403 })

  let body: z.infer<typeof setupSchema>
  try { body = setupSchema.parse(await request.json()) } catch (e) {
    return NextResponse.json({ error: 'Invalid request', detail: e }, { status: 400 })
  }

  const opexPct = 100 - body.profitPct - body.ownerPayPct - body.taxPct
  if (opexPct < 0) {
    return NextResponse.json({
      error: `Profit + Owner Pay + Tax (${body.profitPct + body.ownerPayPct + body.taxPct}%) exceeds 100%.`,
    }, { status: 422 })
  }

  const { data, error } = await supabaseAdmin
    .from('profit_first_config')
    .upsert({
      tenant_id:       tenantId,
      income_account:  body.incomeAccount,
      profit_account:  body.profitAccount,
      owner_pay_account: body.ownerPayAccount,
      tax_account:     body.taxAccount,
      opex_account:    body.opexAccount,
      profit_pct:      body.profitPct,
      owner_pay_pct:   body.ownerPayPct,
      tax_pct:         body.taxPct,
      opex_pct:        opexPct,
      transfer_days:   body.transferDays,
      setup_complete:  true,
      updated_at:      new Date().toISOString(),
    }, { onConflict: 'tenant_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

// POST /api/profit-first/calculate — calculate allocation for a given income amount
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.app_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  const body = await request.json() as { income: number }
  if (!body.income || typeof body.income !== 'number' || body.income <= 0) {
    return NextResponse.json({ error: 'income must be a positive number' }, { status: 400 })
  }

  const { data: cfg } = await supabaseAdmin
    .from('profit_first_config')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  const profitPct   = cfg?.profit_pct    ?? 5
  const ownerPayPct = cfg?.owner_pay_pct ?? 50
  const taxPct      = cfg?.tax_pct       ?? 15
  const opexPct     = cfg?.opex_pct      ?? Math.max(0, 100 - profitPct - ownerPayPct - taxPct)
  const income      = body.income

  return NextResponse.json({
    income,
    allocations: {
      profit:    { account: cfg?.profit_account    ?? 'PROFIT',    pct: profitPct,   amount: Math.round(income * profitPct / 100 * 100) / 100 },
      owner_pay: { account: cfg?.owner_pay_account ?? 'OWNER PAY', pct: ownerPayPct, amount: Math.round(income * ownerPayPct / 100 * 100) / 100 },
      tax:       { account: cfg?.tax_account       ?? 'TAX',       pct: taxPct,      amount: Math.round(income * taxPct / 100 * 100) / 100 },
      opex:      { account: cfg?.opex_account      ?? 'OPEX',      pct: opexPct,     amount: Math.round(income * opexPct / 100 * 100) / 100 },
    },
    next_transfer_days: cfg?.transfer_days ?? [10, 25],
  })
}
