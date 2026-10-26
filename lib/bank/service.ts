import { createHash } from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { unwrap, conflict, badRequest } from '@/lib/api/withRoute'
import { OWED_INVOICE_STATUSES, outstanding, paymentState } from '@/lib/invoices/status'
import { logPayment, findBankPayment } from '@/lib/invoices/ledger'
import { recordInvoicePayment, type RecordedPayment } from '@/lib/invoices/recordPayment'
import { parseBankStatement, type ParsedBankRow } from '@/lib/bank/parseStatement'
import { suggestCategory, vendorKey, type TenantRule, type BankDirection } from '@/lib/bank/categorise'
import { suggestMatches, payerNameInDescription, type OpenInvoice, type PayerAlias, type Suggestion } from '@/lib/bank/reconcile'
import { isValidKey } from '@/lib/finance/chartOfAccounts'
import { getTenantAutonomy } from '@/lib/autonomy/config'
import { resolveTier, type Tier } from '@/lib/autonomy/tiers'
import { notifyTenant } from '@/lib/notifications/notify'
import { sastDate } from '@/lib/time/sast'

export const MAX_STATEMENT_BYTES = 2 * 1024 * 1024
export const MAX_STATEMENT_ROWS = 5000

// ── helpers ────────────────────────────────────────────────────────────────
const directionOf = (amount: number): BankDirection => (amount > 0 ? 'in' : 'out')

/** Stable per-line fingerprint; `occurrence` separates genuinely identical lines in one file. */
export function fingerprint(tenantId: string, row: ParsedBankRow, occurrence: number): string {
  const desc = row.description.toLowerCase().replace(/\s+/g, ' ').trim()
  return createHash('sha256')
    .update([tenantId, row.date, row.amount.toFixed(2), row.balance === null ? '' : row.balance.toFixed(2), desc, occurrence].join('|'))
    .digest('hex')
}

function withFingerprints(tenantId: string, rows: ParsedBankRow[]) {
  const seen = new Map<string, number>()
  return rows.map((row) => {
    const base = `${row.date}|${row.amount}|${row.balance}|${row.description.toLowerCase()}`
    const n = seen.get(base) ?? 0
    seen.set(base, n + 1)
    return { row, hash: fingerprint(tenantId, row, n) }
  })
}

async function existingHashes(tenantId: string, hashes: string[]): Promise<Set<string>> {
  const found = new Set<string>()
  for (let i = 0; i < hashes.length; i += 100) {
    const chunk = hashes.slice(i, i + 100)
    const data = unwrap(await supabaseAdmin
      .from('bank_transactions')
      .select('dedupe_hash')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .in('dedupe_hash', chunk)) ?? []
    for (const r of data) found.add(r.dedupe_hash as string)
  }
  return found
}

async function tenantRules(tenantId: string): Promise<TenantRule[]> {
  const data = unwrap(await supabaseAdmin
    .from('bank_category_rules')
    .select('match_text, category, direction')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .limit(2000)) ?? []
  return data as TenantRule[]
}

/** Payers the owner has taught us ("this account is that customer"). Empty if unreadable — suggestions just lose the boost. */
async function tenantAliases(tenantId: string): Promise<PayerAlias[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('bank_payer_aliases')
      .select('match_text, contact_name')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .limit(2000)
    if (error) throw error
    return (data ?? []).map((r) => ({ key: r.match_text as string, contactName: r.contact_name as string }))
  } catch {
    return []
  }
}

/** After a hand-match where the bank showed a different name, remember the payer so the next payment is suggested. */
async function learnPayer(tenantId: string, userId: string, txId: string, description: string, contactName: string | null) {
  try {
    const key = vendorKey(description)
    if (!contactName || key.length < 4 || payerNameInDescription(description, contactName)) return
    const existing = unwrap(await supabaseAdmin
      .from('bank_payer_aliases').select('id')
      .eq('tenant_id', tenantId).eq('match_text', key).is('deleted_at', null).maybeSingle())
    if (existing) {
      unwrap(await supabaseAdmin.from('bank_payer_aliases').update({ contact_name: contactName, bank_transaction_id: txId }).eq('id', existing.id).eq('tenant_id', tenantId))
    } else {
      unwrap(await supabaseAdmin.from('bank_payer_aliases').insert({ tenant_id: tenantId, match_text: key, contact_name: contactName.slice(0, 200), bank_transaction_id: txId, created_by: userId }))
    }
  } catch (err) {
    console.error('[bank] could not remember payer', tenantId, err instanceof Error ? err.message : err)
  }
}

async function openInvoices(tenantId: string): Promise<(OpenInvoice & { due_date: string | null })[]> {
  const data = unwrap(await supabaseAdmin
    .from('invoices')
    .select('id, invoice_number, reference, contact_name, amount, amount_paid, due_date, status')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .in('status', [...OWED_INVOICE_STATUSES])
    .limit(2000)) ?? []
  return data
    .map((i) => ({
      id: i.id as string,
      // invoice_number is what is printed on the invoice and quoted by customers; `reference` is empty on real rows.
      reference: (i.invoice_number as string | null) ?? (i.reference as string | null) ?? null,
      contact_name: (i.contact_name as string | null) ?? null,
      amount: Number(i.amount ?? 0),
      amount_paid: Number(i.amount_paid ?? 0),
      due_date: (i.due_date as string | null) ?? null,
    }))
    .filter((i) => outstanding(i) > 0)
}

// ── preview (writes nothing) ───────────────────────────────────────────────
export interface PreviewRow {
  index: number
  date: string
  description: string
  amount: number
  balance: number | null
  duplicate: boolean
  category: string | null
  categorySource: 'builtin' | 'tenant_rule' | null
  match: { invoiceId: string; reference: string | null; contactName: string | null; confidence: 'high' | 'medium'; partial: boolean } | null
}

export interface StatementPreview {
  rows: PreviewRow[]
  skipped: number
  warnings: string[]
  newCount: number
  duplicateCount: number
  moneyIn: number
  moneyOut: number
  periodStart: string | null
  periodEnd: string | null
}

export function parseOrThrow(text: string) {
  const parsed = parseBankStatement(text)
  if (parsed.error) throw badRequest(parsed.error)
  if (parsed.rows.length > MAX_STATEMENT_ROWS) {
    throw badRequest(`That statement has ${parsed.rows.length} lines. Please upload it in parts of up to ${MAX_STATEMENT_ROWS}.`)
  }
  return parsed
}

export async function previewStatement(tenantId: string, text: string): Promise<StatementPreview> {
  const parsed = parseOrThrow(text)
  const keyed = withFingerprints(tenantId, parsed.rows)
  const [dupes, rules, invoices, aliases] = await Promise.all([
    existingHashes(tenantId, keyed.map((k) => k.hash)),
    tenantRules(tenantId),
    openInvoices(tenantId),
    tenantAliases(tenantId),
  ])

  const credits = keyed
    .map((k, index) => ({ id: String(index), description: k.row.description, amount: k.row.amount, dup: dupes.has(k.hash) }))
    .filter((c) => c.amount > 0 && !c.dup)
  const matches = new Map(suggestMatches(credits, invoices, aliases).map((s) => [Number(s.transactionId), s]))
  const invById = new Map(invoices.map((i) => [i.id, i]))

  const rows: PreviewRow[] = keyed.map((k, index) => {
    const cat = suggestCategory(k.row.description, directionOf(k.row.amount), rules)
    const m = matches.get(index)
    const inv = m ? invById.get(m.invoiceId) : undefined
    return {
      index,
      date: k.row.date,
      description: k.row.description,
      amount: k.row.amount,
      balance: k.row.balance,
      duplicate: dupes.has(k.hash),
      category: cat?.key ?? null,
      categorySource: cat?.source ?? null,
      match: m && inv ? { invoiceId: m.invoiceId, reference: inv.reference, contactName: inv.contact_name, confidence: m.confidence, partial: m.partial } : null,
    }
  })

  const fresh = rows.filter((r) => !r.duplicate)
  const dates = rows.map((r) => r.date).sort()
  return {
    rows,
    skipped: parsed.skipped,
    warnings: parsed.warnings,
    newCount: fresh.length,
    duplicateCount: rows.length - fresh.length,
    moneyIn: Math.round(fresh.filter((r) => r.amount > 0).reduce((s, r) => s + r.amount, 0) * 100) / 100,
    moneyOut: Math.round(Math.abs(fresh.filter((r) => r.amount < 0).reduce((s, r) => s + r.amount, 0)) * 100) / 100,
    periodStart: dates[0] ?? null,
    periodEnd: dates[dates.length - 1] ?? null,
  }
}

// ── commit ─────────────────────────────────────────────────────────────────
export async function commitStatement(tenantId: string, userId: string, filename: string, text: string) {
  const parsed = parseOrThrow(text)
  const keyed = withFingerprints(tenantId, parsed.rows)
  const [dupes, rules] = await Promise.all([existingHashes(tenantId, keyed.map((k) => k.hash)), tenantRules(tenantId)])
  const fresh = keyed.filter((k) => !dupes.has(k.hash))
  if (fresh.length === 0) {
    throw conflict('Every line in that statement has already been imported. Nothing new was added.')
  }

  const dates = parsed.rows.map((r) => r.date).sort()
  const batch = unwrap(await supabaseAdmin
    .from('bank_statement_imports')
    .insert({
      tenant_id: tenantId,
      filename: filename.slice(0, 200),
      row_count: parsed.rows.length,
      imported_count: fresh.length,
      duplicate_count: parsed.rows.length - fresh.length,
      skipped_count: parsed.skipped,
      period_start: dates[0] ?? null,
      period_end: dates[dates.length - 1] ?? null,
      imported_by: userId,
    })
    .select('id')
    .single(), { required: true })

  const records = fresh.map(({ row, hash }) => {
    const cat = suggestCategory(row.description, directionOf(row.amount), rules)
    return {
      tenant_id: tenantId,
      import_id: batch.id,
      occurred_on: row.date,
      description: row.description.slice(0, 500),
      amount: row.amount,
      balance: row.balance,
      category: cat?.key ?? null,
      category_source: cat?.source ?? null,
      dedupe_hash: hash,
    }
  })
  for (let i = 0; i < records.length; i += 500) {
    // A concurrent upload of the same file loses on the unique dedupe index — surface it, don't half-import silently.
    unwrap(await supabaseAdmin.from('bank_transactions').insert(records.slice(i, i + 500)))
  }

  return {
    importId: batch.id as string,
    imported: fresh.length,
    duplicates: parsed.rows.length - fresh.length,
    skipped: parsed.skipped,
    categorised: records.filter((r) => r.category).length,
  }
}

// ── read ───────────────────────────────────────────────────────────────────
export interface BankTxView {
  id: string
  occurred_on: string
  description: string
  amount: number
  balance: number | null
  category: string | null
  category_source: string | null
  match_status: 'unmatched' | 'matched' | 'ignored'
  matched_invoice_id: string | null
  suggestion: (Suggestion & { reference: string | null; contactName: string | null; outstanding: number }) | null
}

export async function listTransactions(tenantId: string, opts: { status?: string; limit: number; offset: number }) {
  let q = supabaseAdmin
    .from('bank_transactions')
    .select('id, occurred_on, description, amount, balance, category, category_source, match_status, matched_invoice_id', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('occurred_on', { ascending: false })
    .order('created_at', { ascending: false })
    .range(opts.offset, opts.offset + opts.limit - 1)
  if (opts.status && opts.status !== 'all') q = q.eq('match_status', opts.status)
  const res = await q
  const rows = (unwrap(res) ?? []) as Omit<BankTxView, 'suggestion'>[]

  // Suggestions are computed fresh on every read from the invoices still owed today — never stored,
  // so a payment recorded elsewhere removes the suggestion instead of leaving a stale one.
  const credits = rows.filter((r) => r.match_status === 'unmatched' && Number(r.amount) > 0)
  let suggestions = new Map<string, BankTxView['suggestion']>()
  if (credits.length) {
    const [invoices, aliases] = await Promise.all([openInvoices(tenantId), tenantAliases(tenantId)])
    const byId = new Map(invoices.map((i) => [i.id, i]))
    suggestions = new Map(
      suggestMatches(credits.map((c) => ({ id: c.id, description: c.description, amount: Number(c.amount) })), invoices, aliases).map((s) => {
        const inv = byId.get(s.invoiceId)!
        return [s.transactionId, { ...s, reference: inv.reference, contactName: inv.contact_name, outstanding: outstanding(inv) }]
      }),
    )
  }

  return {
    total: res.count ?? rows.length,
    rows: rows.map((r) => ({ ...r, amount: Number(r.amount), balance: r.balance === null ? null : Number(r.balance), suggestion: suggestions.get(r.id) ?? null })) as BankTxView[],
  }
}

export async function bankSummary(tenantId: string) {
  const rows = unwrap(await supabaseAdmin
    .from('bank_transactions')
    .select('amount, match_status, category')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .limit(20000)) ?? []
  let moneyIn = 0, moneyOut = 0, unmatchedCredits = 0, unmatchedCreditValue = 0, uncategorisedDebits = 0
  for (const r of rows) {
    const a = Number(r.amount)
    if (a > 0) moneyIn += a; else moneyOut += -a
    if (r.match_status === 'unmatched' && a > 0) { unmatchedCredits++; unmatchedCreditValue += a }
    if (r.match_status !== 'ignored' && a < 0 && !r.category) uncategorisedDebits++
  }
  const r2 = (n: number) => Math.round(n * 100) / 100
  return { lines: rows.length, moneyIn: r2(moneyIn), moneyOut: r2(moneyOut), unmatchedCredits, unmatchedCreditValue: r2(unmatchedCreditValue), uncategorisedDebits }
}

// ── write: categorise / ignore / match ─────────────────────────────────────
async function loadTx(tenantId: string, id: string) {
  return unwrap(await supabaseAdmin
    .from('bank_transactions')
    .select('id, description, amount, match_status, category, occurred_on')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .maybeSingle(), { required: true, what: 'Bank line not found' })
}

export async function setCategory(tenantId: string, userId: string, id: string, category: string, remember: boolean) {
  const tx = await loadTx(tenantId, id)
  if (tx.match_status === 'matched') throw conflict('This line is matched to an invoice, so its category comes from the invoice.')
  const direction = directionOf(Number(tx.amount))
  if (!isValidKey(direction === 'in' ? 'income' : 'expense', category)) {
    throw badRequest(direction === 'in' ? 'Choose an income category for money received.' : 'Choose an expense category for money paid out.')
  }
  unwrap(await supabaseAdmin
    .from('bank_transactions')
    .update({ category, category_source: 'manual' })
    .eq('id', id)
    .eq('tenant_id', tenantId))

  let ruleSaved = false
  const vk = vendorKey(tx.description as string)
  if (remember && vk.length >= 2) {
    const existing = unwrap(await supabaseAdmin
      .from('bank_category_rules').select('id')
      .eq('tenant_id', tenantId).eq('direction', direction).eq('match_text', vk).is('deleted_at', null).maybeSingle())
    if (existing) {
      unwrap(await supabaseAdmin.from('bank_category_rules').update({ category, updated_at: new Date().toISOString() }).eq('id', existing.id).eq('tenant_id', tenantId))
    } else {
      unwrap(await supabaseAdmin.from('bank_category_rules').insert({ tenant_id: tenantId, match_text: vk, direction, category, created_by: userId }))
    }
    // Close the loop on the spot: the same vendor, still uncategorised → categorised now.
    const sameVendor = unwrap(await supabaseAdmin
      .from('bank_transactions').select('id, description, amount')
      .eq('tenant_id', tenantId).is('deleted_at', null).is('category', null).neq('match_status', 'matched').limit(2000)) ?? []
    const ids = sameVendor.filter((t) => directionOf(Number(t.amount)) === direction && vendorKey(t.description as string) === vk).map((t) => t.id as string)
    if (ids.length) {
      unwrap(await supabaseAdmin.from('bank_transactions').update({ category, category_source: 'tenant_rule' }).eq('tenant_id', tenantId).in('id', ids))
    }
    ruleSaved = true
  }
  return { id, category, ruleSaved }
}

export async function setIgnored(tenantId: string, id: string, ignored: boolean) {
  const tx = await loadTx(tenantId, id)
  if (tx.match_status === 'matched') throw conflict('This line is matched to an invoice and can’t be ignored.')
  unwrap(await supabaseAdmin
    .from('bank_transactions')
    .update({ match_status: ignored ? 'ignored' : 'unmatched' })
    .eq('id', id)
    .eq('tenant_id', tenantId))
  return { id, match_status: ignored ? 'ignored' : 'unmatched' }
}

/**
 * Confirm "this bank line paid that invoice". Claims the line first (a conditional
 * update, so a double-click or a second person can't apply it twice), then records
 * the payment through the same rules as the invoice screen, and releases the claim
 * if the payment is refused.
 */
export async function confirmMatch(tenantId: string, userId: string, id: string, invoiceId: string): Promise<RecordedPayment> {
  const tx = await loadTx(tenantId, id)
  const amount = Number(tx.amount)
  if (amount <= 0) throw badRequest('Only money received can be matched to an invoice.')
  if (tx.match_status !== 'unmatched') throw conflict(tx.match_status === 'matched' ? 'This line is already matched.' : 'Un-ignore this line before matching it.')

  const claimed = unwrap(await supabaseAdmin
    .from('bank_transactions')
    .update({ match_status: 'matched', matched_invoice_id: invoiceId, matched_at: new Date().toISOString(), matched_by: userId })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .eq('match_status', 'unmatched')
    .select('id')
    .maybeSingle())
  if (!claimed) throw conflict('Someone else just matched this line — refresh and check.')

  try {
    const paid = await recordInvoicePayment(tenantId, userId, invoiceId, amount, 'eft', { source: 'bank', bankTransactionId: id, paidOn: tx.occurred_on as string })
    await learnPayer(tenantId, userId, id, tx.description as string, paid.contactName)
    return paid
  } catch (err) {
    await supabaseAdmin
      .from('bank_transactions')
      .update({ match_status: 'unmatched', matched_invoice_id: null, matched_at: null, matched_by: null })
      .eq('id', id)
      .eq('tenant_id', tenantId)
    throw err
  }
}

/**
 * Undo a confirmed match: the bank line goes back to unmatched and the money is
 * taken off the invoice again (a negative ledger row pointing at the original —
 * the history is kept). Guarded on amount_paid like every other payment write.
 * What it cannot take back: the owner alert and the customer's thank-you message
 * that went out when the invoice first became paid.
 */
export async function undoMatch(tenantId: string, userId: string, id: string) {
  const tx = await loadTx(tenantId, id)
  if (tx.match_status !== 'matched') throw conflict('This line is not matched to an invoice.')
  const full = unwrap(await supabaseAdmin
    .from('bank_transactions').select('matched_invoice_id').eq('id', id).eq('tenant_id', tenantId).maybeSingle(), { required: true })
  const invoiceId = full.matched_invoice_id as string | null
  if (!invoiceId) throw conflict('This line has no invoice to undo.')

  // Matches made before the ledger existed have no ledger row: the bank line's own amount is what was applied.
  const original = await findBankPayment(tenantId, id)
  const amount = original ? original.amount : Number(tx.amount)

  const inv = unwrap(await supabaseAdmin
    .from('invoices')
    .select('id, status, amount, amount_paid')
    .eq('id', invoiceId).eq('tenant_id', tenantId).is('deleted_at', null).maybeSingle(), { required: true, what: 'Invoice not found' })
  if (inv.status === 'cancelled') throw conflict('That invoice has been cancelled, so the payment can’t be undone from here.')

  const paidBefore = Number(inv.amount_paid ?? 0)
  const newPaid = Math.round((paidBefore - amount) * 100) / 100
  if (newPaid < -0.005) throw conflict('The invoice has less paid on it than this line — it was changed since. Check the invoice.')
  const state = paymentState(Number(inv.amount ?? 0), Math.max(0, newPaid))
  const nextStatus = inv.status === 'in_collections' ? 'in_collections' : (state.status ?? 'unpaid')

  const updated = unwrap(await supabaseAdmin
    .from('invoices')
    .update({
      amount_paid: state.amount_paid,
      amount_due: state.amount_due,
      status: nextStatus,
      ...(state.status === 'paid' ? {} : { paid_at: null }),
    })
    .eq('id', invoiceId).eq('tenant_id', tenantId).eq('amount_paid', paidBefore)
    .select('id, status, amount_paid')
    .maybeSingle())
  if (!updated) throw conflict('This invoice was just changed by someone else — refresh and try again.')

  await logPayment({ tenantId, invoiceId, userId, amount: -amount, source: 'reversal', reversesId: original?.id ?? null, bankTransactionId: null })
  unwrap(await supabaseAdmin
    .from('bank_transactions')
    .update({ match_status: 'unmatched', matched_invoice_id: null, matched_at: null, matched_by: null })
    .eq('id', id).eq('tenant_id', tenantId))
  // A match the owner took back must not keep teaching.
  await supabaseAdmin.from('bank_payer_aliases').update({ deleted_at: new Date().toISOString() })
    .eq('tenant_id', tenantId).eq('bank_transaction_id', id).is('deleted_at', null)

  return { id, invoiceId, status: updated.status as string, amountPaid: Number(updated.amount_paid) }
}

/** Bulk-confirm: only pairs the matcher itself rates 'high' right now are accepted — the client can't force others. */
export async function confirmHighConfidence(tenantId: string, userId: string, pairs: { transactionId: string; invoiceId: string }[]) {
  const ids = pairs.map((p) => p.transactionId)
  const txs = unwrap(await supabaseAdmin
    .from('bank_transactions').select('id, description, amount, match_status')
    .eq('tenant_id', tenantId).is('deleted_at', null).in('id', ids)) ?? []
  const credits = txs.filter((t) => t.match_status === 'unmatched' && Number(t.amount) > 0)
    .map((t) => ({ id: t.id as string, description: t.description as string, amount: Number(t.amount) }))
  const high = new Map(suggestMatches(credits, await openInvoices(tenantId)).filter((s) => s.confidence === 'high').map((s) => [s.transactionId, s.invoiceId]))

  const results: { transactionId: string; ok: boolean; error?: string; becamePaid?: boolean }[] = []
  for (const p of pairs) {
    if (high.get(p.transactionId) !== p.invoiceId) { results.push({ transactionId: p.transactionId, ok: false, error: 'No longer a high-confidence match' }); continue }
    try {
      const r = await confirmMatch(tenantId, userId, p.transactionId, p.invoiceId)
      results.push({ transactionId: p.transactionId, ok: true, becamePaid: r.becamePaid })
    } catch (e) {
      results.push({ transactionId: p.transactionId, ok: false, error: e instanceof Error ? e.message : 'Failed' })
    }
  }
  return results
}

// ── closed loop: statement in → sure matches settled ───────────────────────
async function highConfidencePairs(tenantId: string) {
  const rows = unwrap(await supabaseAdmin
    .from('bank_transactions')
    .select('id, description, amount')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .eq('match_status', 'unmatched')
    .gt('amount', 0)
    .order('occurred_on', { ascending: false })
    .limit(500)) ?? []
  const credits = rows.map((r) => ({ id: r.id as string, description: r.description as string, amount: Number(r.amount) }))
  if (!credits.length) return []
  return suggestMatches(credits, await openInvoices(tenantId))
    .filter((s) => s.confidence === 'high')
    .map((s) => ({ transactionId: s.transactionId, invoiceId: s.invoiceId }))
}

export interface SettleResult { tier: Tier; applied: number; ready: number }

/**
 * After a statement is imported, act on the matches the matcher is sure of
 * (money/bank_auto_match): A settles them now (each one can be undone from the
 * Bank page), B tells the owner they are ready to confirm in one tap, C does
 * nothing extra. Default B — AdminOS proposes, it doesn't silently settle
 * invoices until the owner turns A on. Never throws: the import already
 * succeeded and must report that.
 */
export async function settleAfterImport(tenantId: string, userId: string): Promise<SettleResult> {
  let tier: Tier = 'C'
  try {
    tier = resolveTier(await getTenantAutonomy(tenantId), 'money', 'bank_auto_match')
    if (tier === 'C') return { tier, applied: 0, ready: 0 }
    const pairs = (await highConfidencePairs(tenantId)).slice(0, 100)
    if (!pairs.length) return { tier, applied: 0, ready: 0 }

    if (tier === 'B') {
      await notifyTenant(tenantId, {
        type: 'bank.matches_ready',
        title: `${pairs.length} bank payment${pairs.length === 1 ? '' : 's'} ready to confirm`,
        body: 'These lines clearly match open invoices. Confirm them in one tap on the Bank page.',
        actionUrl: '/dashboard/bank',
        dedupeKey: `bank-ready-${tenantId}-${sastDate()}`,
      })
      return { tier, applied: 0, ready: pairs.length }
    }

    const results = await confirmHighConfidence(tenantId, userId, pairs)
    const applied = results.filter((r) => r.ok).length
    if (applied > 0) {
      await notifyTenant(tenantId, {
        type: 'bank.auto_matched',
        title: `${applied} bank payment${applied === 1 ? '' : 's'} matched to invoices`,
        body: 'Settled automatically from your statement. Open Bank → Matched to review; any of them can be undone.',
        actionUrl: '/dashboard/bank',
      })
    }
    return { tier, applied, ready: 0 }
  } catch (err) {
    console.error('[bank] settleAfterImport failed', tenantId, err instanceof Error ? err.message : err)
    return { tier, applied: 0, ready: 0 }
  }
}
