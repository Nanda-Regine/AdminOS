// Demo tenant ("Mzansi Test Traders") only: imports one realistic FNB-style statement through the
// real /api/bank/import endpoint, so the Bank page shows categorised lines and invoice matches
// waiting for confirmation. Import only — it never confirms a match, so the demo invoices stay
// open and the presenter gets to click "Confirm payment" live.
// Idempotent: re-running is refused as duplicates (409) and reported, not an error.
//   node scripts/hackathon/seed-demo-bank.mjs [baseUrl]
import { select, env, SUPABASE_URL, cookieHeader } from '../lib/qa.mjs'

const BASE = process.argv[2] ?? 'https://www.adminos.co.za'
const T = 'c1336f9c-0617-46f2-978f-605da9ad2ebc'
const H = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' }

// Same sign-in as walk.mjs: a magic-link token minted by the admin API, no password involved.
const gl = await (await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, { method: 'POST', headers: H, body: JSON.stringify({ type: 'magiclink', email: 'founder@adminos-demo.co.za' }) })).json()
const v = await fetch(`${SUPABASE_URL}/auth/v1/verify`, { method: 'POST', headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'magiclink', token_hash: gl.hashed_token }) })
if (!v.ok) throw new Error(`sign-in failed ${v.status}`)
const s = await v.json()
const cookie = cookieHeader({ ...s, expires_at: s.expires_at ?? Math.floor(Date.now() / 1000) + s.expires_in })

const open = await select('invoices', `tenant_id=eq.${T}&deleted_at=is.null&status=in.(sent,unpaid,overdue,partial)&select=invoice_number,contact_name,amount,amount_paid,status&order=amount.desc`)
const owed = (i) => Math.round((Number(i.amount) - Number(i.amount_paid ?? 0)) * 100) / 100
const by = (name) => open.find((i) => i.contact_name === name)
const nomvula = by('Nomvula Sithole'), karen = by('Karen Fourie'), david = by('David Naidoo'), bulelani = by('Bulelani Gqirana')
if (!nomvula || !karen || !david || !bulelani) throw new Error('expected demo invoices not found — has the demo tenant been reseeded?')

const day = (n) => { const d = new Date(Date.now() - n * 86400e3 + 2 * 3600e3); return `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}` }
const money = (n) => n.toFixed(2)
let bal = 38250.0
const lines = []
const add = (ago, amount, desc) => { bal += amount; lines.push(`${day(ago)},${money(amount)},${money(bal)},"${desc}"`) }

add(9, -185.0, 'FNB App Payment To Eskom Prepaid')
add(8, -65.0, 'Monthly Account Fee')
add(8, owed(nomvula), `FNB App Rtc Credit ${nomvula.contact_name} ${nomvula.invoice_number}`)   // number + exact amount -> high confidence
add(7, -842.4, 'POS Purchase Engen East London 4821')
add(6, owed(karen), `Payment Received K FOURIE`)                                                // name + exact amount -> medium
add(5, -1299.0, 'Debit Order Discovery Insure')
add(5, -349.0, 'Vodacom Business Data Bundle')
add(4, owed(david), `FNB App Rtc Credit D Naidoo ${david.invoice_number}`)                       // number + exact amount -> high confidence
add(3, -6200.0, 'FNB App Payment To Khulani Wholesalers')                                        // supplier: left for the owner to categorise
add(2, 1500.0, 'Cash deposit Shop takings')                                                      // no invoice, no category: needs a human
add(1, -199.0, 'Google Workspace')
add(1, owed(bulelani) - 500, `EFT Bulelani Gqirana ${bulelani.invoice_number}`)                   // part-payment: flagged, never "sure"

const csv = ['Account Number,62012345601', 'Account Name,MZANSI TEST TRADERS', '', 'Date,Amount,Balance,Description', ...lines].join('\n')
const form = new FormData(); form.append('file', new File([csv], 'FNB-statement-demo.csv', { type: 'text/csv' }))
const r = await fetch(`${BASE}/api/bank/import?mode=commit`, { method: 'POST', body: form, headers: { cookie } })
const body = await r.json().catch(() => ({}))
if (r.status === 409) console.log('Already imported — nothing to do.')
else if (!r.ok) { console.error('import failed', r.status, body); process.exit(1) }
else console.log('Imported', JSON.stringify(body))
