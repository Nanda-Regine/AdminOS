import { supabaseAdmin } from '@/lib/supabase/admin'
import { sastDate } from '@/lib/time/sast'

export type PaymentSource = 'manual' | 'bank' | 'cash_sale' | 'status_paid' | 'correction' | 'reversal' | 'backfill'

/**
 * Append one row to the invoice payments ledger (migration 20261026). The
 * invoice's own amount_paid stays the source of truth for what is owed, and it
 * has already been written by the time this runs — so a ledger failure is
 * logged, never thrown: the customer's payment must not fail because the
 * history row did. Returns the new row id, or null if it could not be written
 * (including before the migration is applied).
 */
export async function logPayment(args: {
  tenantId: string
  invoiceId: string
  /** Signed rands: positive = received, negative = reversed / corrected down. Zero is ignored. */
  amount: number
  source: PaymentSource
  method?: string | null
  bankTransactionId?: string | null
  reversesId?: string | null
  /** SAST date the money actually arrived (a bank line's date); defaults to today. */
  paidOn?: string
  userId?: string | null
}): Promise<string | null> {
  const amount = Math.round(args.amount * 100) / 100
  if (amount === 0) return null
  const { data, error } = await supabaseAdmin
    .from('invoice_payments')
    .insert({
      tenant_id: args.tenantId,
      invoice_id: args.invoiceId,
      amount,
      paid_on: args.paidOn ?? sastDate(),
      method: args.method ?? null,
      source: args.source,
      bank_transaction_id: args.bankTransactionId ?? null,
      reverses_id: args.reversesId ?? null,
      created_by: args.userId ?? null,
    })
    .select('id')
    .maybeSingle()
  if (error) {
    console.error('[ledger] payment row not written', args.invoiceId, args.source, error.message)
    return null
  }
  return (data?.id as string | undefined) ?? null
}

/** The live (not yet reversed) ledger row a bank line created, if any. */
export async function findBankPayment(tenantId: string, bankTransactionId: string) {
  const { data: rows } = await supabaseAdmin
    .from('invoice_payments')
    .select('id, invoice_id, amount')
    .eq('tenant_id', tenantId)
    .eq('bank_transaction_id', bankTransactionId)
    .eq('source', 'bank')
    .is('reverses_id', null)
    .is('deleted_at', null)
    .maybeSingle()
  if (!rows) return null
  const { data: reversed } = await supabaseAdmin
    .from('invoice_payments')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('reverses_id', rows.id)
    .maybeSingle()
  return reversed ? null : { id: rows.id as string, invoiceId: rows.invoice_id as string, amount: Number(rows.amount) }
}
