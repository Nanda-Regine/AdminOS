import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'
import { withRoute, unwrap, RouteError } from '@/lib/api/withRoute'

// Profit First — 5-account allocation model by Mike Michalowicz
// Columns: income_account, profit_account, owner_pay_account, tax_account, opex_account

const DEFAULTS = { profit_pct: 5, owner_pay_pct: 50, tax_pct: 15, opex_pct: 30, transfer_days: [10, 25] }

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
  transferDays:    z.array(z.number().int().min(1).max(28)).max(4).default([10, 25]),
})

export const GET = withRoute({ action: 'money.read' }, async ({ ctx }) => {
  const data = unwrap(await supabaseAdmin
    .from('profit_first_config')
    .select('*')
    .eq('tenant_id', ctx.tenantId)
    .maybeSingle())

  if (!data) {
    return {
      configured: false,
      message: 'Profit First not yet configured. Use PATCH to set up your 5 accounts.',
      defaults: DEFAULTS,
    }
  }
  return { ...data, configured: data.setup_complete }
})

export const PATCH = withRoute({
  action: 'money.write',
  body: setupSchema,
  audit: 'profit_first.configured',
  resourceType: 'profit_first_config',
}, async ({ ctx, body }) => {
  const opexPct = 100 - body.profitPct - body.ownerPayPct - body.taxPct
  if (opexPct < 0) {
    throw new RouteError(422, `Profit + Owner Pay + Tax (${body.profitPct + body.ownerPayPct + body.taxPct}%) exceeds 100%.`, 'over_allocated')
  }

  return unwrap(await supabaseAdmin
    .from('profit_first_config')
    .upsert({
      tenant_id:         ctx.tenantId,
      income_account:    body.incomeAccount,
      profit_account:    body.profitAccount,
      owner_pay_account: body.ownerPayAccount,
      tax_account:       body.taxAccount,
      opex_account:      body.opexAccount,
      profit_pct:        body.profitPct,
      owner_pay_pct:     body.ownerPayPct,
      tax_pct:           body.taxPct,
      opex_pct:          opexPct,
      transfer_days:     body.transferDays,
      setup_complete:    true,
      updated_at:        new Date().toISOString(),
    }, { onConflict: 'tenant_id' })
    .select()
    .single())
})

// POST /api/profit-first — calculate the allocation for an income amount.
// Had no permission check and no schema (a string "income" passed typeof checks badly).
export const POST = withRoute({
  action: 'money.read',
  body: z.object({ income: z.number().positive().max(1_000_000_000) }),
}, async ({ ctx, body }) => {
  const cfg = unwrap(await supabaseAdmin
    .from('profit_first_config')
    .select('*')
    .eq('tenant_id', ctx.tenantId)
    .maybeSingle())

  const profitPct   = Number(cfg?.profit_pct    ?? DEFAULTS.profit_pct)
  const ownerPayPct = Number(cfg?.owner_pay_pct ?? DEFAULTS.owner_pay_pct)
  const taxPct      = Number(cfg?.tax_pct       ?? DEFAULTS.tax_pct)
  const opexPct     = Number(cfg?.opex_pct      ?? Math.max(0, 100 - profitPct - ownerPayPct - taxPct))
  const { income }  = body
  const part = (pct: number) => Math.round(income * pct) / 100

  return {
    income,
    allocations: {
      profit:    { account: cfg?.profit_account    ?? 'PROFIT',    pct: profitPct,   amount: part(profitPct) },
      owner_pay: { account: cfg?.owner_pay_account ?? 'OWNER PAY', pct: ownerPayPct, amount: part(ownerPayPct) },
      tax:       { account: cfg?.tax_account       ?? 'TAX',       pct: taxPct,      amount: part(taxPct) },
      opex:      { account: cfg?.opex_account      ?? 'OPEX',      pct: opexPct,     amount: part(opexPct) },
    },
    next_transfer_days: cfg?.transfer_days ?? DEFAULTS.transfer_days,
  }
})
