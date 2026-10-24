// Read-only: print what key screens SHOW next to what the database HOLDS for the demo tenant.
//   node scripts/hackathon/screen-vs-db.mjs [baseUrl]
import { chromium } from '@playwright/test'
import { env, SUPABASE_URL, sessionCookies } from '../lib/qa.mjs'
const BASE = process.argv.find(a => a.startsWith('http')) ?? 'https://www.adminos.co.za'
const KEY = env.SUPABASE_SERVICE_ROLE_KEY
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }
const gl = await (await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, { method: 'POST', headers: H, body: JSON.stringify({ type: 'magiclink', email: 'founder@adminos-demo.co.za' }) })).json()
const v = await fetch(`${SUPABASE_URL}/auth/v1/verify`, { method: 'POST', headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'magiclink', token_hash: gl.hashed_token }) })
const s = await v.json(); const session = { ...s, expires_at: s.expires_at ?? Math.floor(Date.now() / 1000) + s.expires_in }
const T = s.user.app_metadata.tenant_id
const q = async (path) => (await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: H })).json()

const tasks = await q(`tasks?tenant_id=eq.${T}&deleted_at=is.null&select=status,priority,due_date`)
const byStatus = tasks.reduce((m, t) => (m[t.status] = (m[t.status] ?? 0) + 1, m), {})
const products = await q(`products?tenant_id=eq.${T}&deleted_at=is.null&select=name,current_stock,reorder_level,active`)
const low = products.filter(p => p.active !== false && Number(p.reorder_level) > 0 && Number(p.current_stock) <= Number(p.reorder_level))
const invs = await q(`invoices?tenant_id=eq.${T}&deleted_at=is.null&select=status,amount,amount_paid,due_date`)
const OPEN = ['sent', 'unpaid', 'partial', 'overdue']
const owed = invs.filter(i => OPEN.includes(i.status)).reduce((n, i) => n + Number(i.amount) - Number(i.amount_paid ?? 0), 0)
console.log('DB tasks by status:', JSON.stringify(byStatus), '| open =', (byStatus.todo ?? 0) + (byStatus.in_progress ?? 0) + (byStatus.review ?? 0))
console.log('DB low stock:', low.length, low.map(p => p.name).join(', '))
console.log('DB invoices:', invs.length, 'open owed R', owed.toFixed(2), '| statuses', JSON.stringify(invs.reduce((m, i) => (m[i.status] = (m[i.status] ?? 0) + 1, m), {})))

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
await ctx.addInitScript(() => { try { localStorage.setItem('adminos_cookie_consent', 'declined') } catch {} })
await ctx.addCookies(sessionCookies(session).map(c => ({ ...c, url: BASE })))
const PEEK = process.argv.includes('--peek') ? process.argv[process.argv.indexOf('--peek')+1] : null
if (PEEK) { const pg = await ctx.newPage(); await pg.goto(BASE + '/' + PEEK, { waitUntil: 'domcontentloaded', timeout: 60000 }); await pg.waitForTimeout(3500); console.log((await pg.locator('body').innerText()).slice(0, 3500)); await pg.screenshot({ path: 'scripts/audit-out/session23/peek.png', fullPage: true }); await browser.close(); process.exit(0) }
for (const [p, re] of [
  ['/dashboard/tasks', /\d+ total · \d+ open|To Do|In Progress|In Review|Done/g],
  ['/dashboard/ops', /low[- ]stock[^\n]*\n?[^\n]*|\d+ (product|item)s?[^\n]*/gi],
  ['/dashboard/inventory', /low[- ]stock[^\n]*\n?[^\n]*/gi],
  ['/dashboard/money', /R\s?[\d\s,]+(\.\d\d)?/g],
  ['/dashboard/invoices', /R\s?[\d\s,]+(\.\d\d)?/g],
]) {
  const page = await ctx.newPage()
  await page.goto(BASE + p, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(3500)
  const text = await page.locator('body').innerText()
  console.log('\nSCREEN', p, '->', JSON.stringify([...new Set((text.match(re) ?? []).map(x => x.replace(/\s+/g, ' ').trim()))].slice(0, 14)))
  await page.close()
}
await browser.close()
