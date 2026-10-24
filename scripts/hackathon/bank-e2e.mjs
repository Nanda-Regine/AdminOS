// End-to-end test of the bank loop against PRODUCTION on a QA persona tenant (never a real
// customer, never the demo tenant): import -> dedupe -> categorise -> suggest -> confirm match
// -> invoice paid -> remember-vendor rule. Then restores everything it touched.
//   node scripts/hackathon/bank-e2e.mjs [baseUrl] [persona-slug]
// Fetch only (no supabase-js, no Playwright) so it is light enough for a low-spec laptop.
import { select, update, insert, signIn, cookieHeader, env, SUPABASE_URL } from '../lib/qa.mjs'

const BASE = process.argv[2] ?? 'https://www.adminos.co.za'
const SLUG = process.argv[3] ?? 'qa-persona-clinic'
const results = []
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`) }

const [tenant] = await select('tenants', `slug=eq.${SLUG}&select=id,slug,settings`)
if (!tenant) throw new Error('persona tenant not found')
const ownerEmail = tenant.settings.owner_email
if (tenant.settings.owner_phone || tenant.settings.whatsapp_number) throw new Error('persona has a phone configured — refusing to run (could notify a real number)')

const [inv] = await select('invoices', `tenant_id=eq.${tenant.id}&deleted_at=is.null&status=in.(sent,overdue,unpaid)&amount_paid=eq.0&contact_name=not.is.null&order=amount.desc&limit=1&select=id,invoice_number,reference,contact_name,contact_phone,amount,amount_paid,amount_due,status,paid_at,payment_method`)
if (!inv) throw new Error('no suitable open invoice on this persona')
const original = { amount_paid: inv.amount_paid, amount_due: inv.amount_due, status: inv.status, paid_at: inv.paid_at, payment_method: inv.payment_method, contact_phone: inv.contact_phone }
console.log(`tenant=${SLUG} invoice=${inv.id.slice(0, 8)} ${inv.contact_name} R${inv.amount} (${inv.status})`)

const session = await signIn(ownerEmail)
const cookie = cookieHeader(session)
const call = async (path, init = {}) => {
  const r = await fetch(BASE + path, { ...init, headers: { ...(init.headers ?? {}), cookie } })
  return { status: r.status, body: await r.json().catch(() => ({})) }
}
const upload = (mode, csv, name = 'e2e-statement.csv') => {
  const form = new FormData(); form.append('file', new File([csv], name, { type: 'text/csv' }))
  return call(`/api/bank/import?mode=${mode}`, { method: 'POST', body: form })
}

const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '/')
const csv = [
  'Account Number,62000000000',
  '',
  'Date,Amount,Balance,Description',
  `${stamp},${Number(inv.amount).toFixed(2)},50000.00,"FNB App Rtc Credit ${inv.contact_name} ${inv.invoice_number ?? ''}"`,
  `${stamp},-65.00,49935.00,Monthly Account Fee`,
  `${stamp},-420.50,49514.50,POS Purchase Engen East London 4821`,
  `${stamp},777.77,50292.27,Cash deposit`,
].join('\n')

let importId = null
const createdRuleIds = []
try {
  // The persona's contact phone must not be reachable by the thank-you message.
  await update('invoices', `id=eq.${inv.id}`, { contact_phone: null })

  const pre = await upload('preview', csv)
  check('preview returns 200 with 4 new lines', pre.status === 200 && pre.body.newCount === 4, JSON.stringify({ s: pre.status, n: pre.body.newCount }))
  const prevMatch = pre.body.rows?.find((r) => r.match)
  check('preview suggests the right invoice', prevMatch?.match?.invoiceId === inv.id, prevMatch ? `confidence=${prevMatch.match.confidence}` : 'no match')
  check('preview auto-categorises bank fee and fuel', pre.body.rows?.some((r) => r.category === 'bank_charges') && pre.body.rows?.some((r) => r.category === 'motor_vehicle'))
  const written = await select('bank_transactions', `tenant_id=eq.${tenant.id}&select=id`)
  check('preview wrote nothing', written.length === 0, `${written.length} rows`)

  const commit = await upload('commit', csv)
  importId = commit.body.importId
  check('commit imports 4 lines', commit.status === 200 && commit.body.imported === 4, JSON.stringify(commit.body))

  const again = await upload('commit', csv)
  check('re-uploading the same file is refused as duplicates (409)', again.status === 409, `status ${again.status}`)

  const list = await call('/api/bank/transactions?status=unmatched')
  const credit = list.body.rows?.find((r) => r.suggestion?.invoiceId === inv.id)
  check('list shows the suggestion on the money-in line', !!credit, credit ? `${credit.suggestion.confidence}: ${credit.suggestion.reasons.join(', ')}` : '')
  check('summary counts lines', list.body.summary?.lines === 4, JSON.stringify(list.body.summary))

  const forged = await call('/api/bank/reconcile', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ matches: [{ transactionId: crypto.randomUUID(), invoiceId: inv.id }] }) })
  check('bulk-confirm rejects a pair the matcher does not rate high', forged.body.matched === 0, JSON.stringify(forged.body).slice(0, 120))

  if (inv.invoice_number) check('quoting the invoice number lifts the match to HIGH confidence', credit.suggestion.confidence === 'high', `${credit.suggestion.confidence}; shows ${credit.suggestion.reference}`)
  let paidNow
  if (credit.suggestion.confidence === 'high') {
    const bulk = await call('/api/bank/reconcile', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ matches: [{ transactionId: credit.id, invoiceId: inv.id }] }) })
    paidNow = bulk.body.matched === 1 && bulk.body.results?.[0]?.becamePaid === true
    check('bulk-confirm of a high-confidence match records the payment', paidNow, JSON.stringify(bulk.body).slice(0, 160))
  } else {
    const confirm = await call(`/api/bank/transactions/${credit.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ matchInvoiceId: inv.id }) })
    paidNow = confirm.status === 200 && confirm.body.becamePaid === true
    check('confirming the match records the payment', paidNow, JSON.stringify(confirm.body).slice(0, 160))
  }
  const [after] = await select('invoices', `id=eq.${inv.id}&select=status,amount_paid,amount_due,payment_method,paid_at`)
  check('invoice is paid in full via EFT', after.status === 'paid' && Number(after.amount_paid) === Number(inv.amount) && Number(after.amount_due) === 0 && after.payment_method === 'eft', JSON.stringify(after))

  const twice = await call(`/api/bank/transactions/${credit.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ matchInvoiceId: inv.id }) })
  check('matching the same line twice is refused (409)', twice.status === 409, `status ${twice.status}`)

  const fuel = list.body.rows?.find((r) => /engen/i.test(r.description))
  const cat = await call(`/api/bank/transactions/${fuel.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ category: 'cogs', remember: true }) })
  check('categorising with "remember" saves a vendor rule', cat.status === 200 && cat.body.ruleSaved === true, JSON.stringify(cat.body))
  const wrongKind = await call(`/api/bank/transactions/${fuel.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ category: 'sales' }) })
  check('an income category on a debit is refused (400)', wrongKind.status === 400, `status ${wrongKind.status}`)

  const noFile = await call('/api/bank/import?mode=preview', { method: 'POST', body: new FormData() })
  check('upload with no file is a friendly 400', noFile.status === 400, noFile.body.error)
  const bad = await upload('preview', 'hello,world\n1,2')
  check('an unrecognisable file is a friendly 400', bad.status === 400, bad.body.error?.slice(0, 60))
} finally {
  // Restore everything this run touched.
  await update('invoices', `id=eq.${inv.id}`, original).catch((e) => console.error('RESTORE invoice failed', e.message))
  const now = new Date().toISOString()
  await update('bank_transactions', `tenant_id=eq.${tenant.id}`, { deleted_at: now, match_status: 'ignored', matched_invoice_id: null }).catch((e) => console.error('cleanup tx', e.message))
  if (importId) await update('bank_statement_imports', `id=eq.${importId}`, { deleted_at: now }).catch(() => {})
  await update('bank_category_rules', `tenant_id=eq.${tenant.id}`, { deleted_at: now }).catch(() => {})
  const [restored] = await select('invoices', `id=eq.${inv.id}&select=status,amount_paid`)
  check('cleanup: invoice restored to its original state', restored.status === original.status && Number(restored.amount_paid) === Number(original.amount_paid), JSON.stringify(restored))
}

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
