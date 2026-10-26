import { supabaseAdmin } from '@/lib/supabase/admin'
import { allRows } from '@/lib/supabase/fetchAll'
import { sastDate } from '@/lib/time/sast'
import { buildBehaviour, contactKey, type BehaviourModel, type PaidSample } from '@/lib/invoices/paymentBehaviour'

/**
 * Each customer's payment pattern for one business, from invoices that have
 * been paid in full (due date known). The date the money arrived comes from the
 * payments ledger when a bank line paid it (the statement date, not the day the
 * owner got round to confirming the match), else from the invoice's paid_at.
 * No ledger yet / no history → an empty model, and the forecast keeps its
 * default curve.
 */
export async function loadBehaviour(tenantId: string): Promise<BehaviourModel> {
  try {
    const paid = await allRows((lo, hi) => supabaseAdmin
      .from('invoices')
      .select('id, contact_id, contact_name, due_date, paid_at')
      .eq('tenant_id', tenantId)
      .eq('status', 'paid')
      .is('deleted_at', null)
      .not('due_date', 'is', null)
      .not('paid_at', 'is', null)
      .order('paid_at', { ascending: false })
      .range(lo, hi)).then((r) => (r.data ?? []).slice(0, 3000))

    const bankDates = new Map<string, string>()
    const ledger = await supabaseAdmin
      .from('invoice_payments')
      .select('invoice_id, paid_on')
      .eq('tenant_id', tenantId)
      .eq('source', 'bank')
      .gt('amount', 0)
      .is('deleted_at', null)
      .limit(5000)
    for (const r of ledger.data ?? []) {
      const prev = bankDates.get(r.invoice_id as string)
      if (!prev || (r.paid_on as string) > prev) bankDates.set(r.invoice_id as string, r.paid_on as string)
    }

    const samples: PaidSample[] = []
    for (const inv of paid) {
      const key = contactKey(inv.contact_id as string | null, inv.contact_name as string | null)
      if (!key) continue
      samples.push({
        key,
        dueDate: String(inv.due_date).slice(0, 10),
        paidOn: bankDates.get(inv.id as string) ?? sastDate(new Date(inv.paid_at as string)),
      })
    }
    return buildBehaviour(samples)
  } catch (err) {
    console.error('[behaviour] could not load payment history', tenantId, err instanceof Error ? err.message : err)
    return { byKey: new Map(), tenant: null }
  }
}
