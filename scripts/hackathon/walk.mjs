// Read-only Playwright walk of the demo tenant on prod: screenshots for the pitch deck
// + console errors / failed loads / mobile overflow. Navigation only, no mutating clicks.
//   node scripts/hackathon/walk.mjs [baseUrl] [--only a,b] [--out dir] [--viewports desktop,mobile]
import fs from 'fs'
import path from 'path'
import { chromium } from '@playwright/test'
import { env, SUPABASE_URL, sessionCookies } from '../lib/qa.mjs'

const args = process.argv.slice(2)
const opt = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : null)
const BASE = args.find(a => a.startsWith('http')) ?? 'https://www.adminos.co.za'
const ONLY = opt('--only')?.split(',') ?? null
const VP_ONLY = opt('--viewports')?.split(',') ?? null
const OUT = opt('--out') ? path.resolve(opt('--out')) : path.join(process.cwd(), 'scripts', 'audit-out', 'hackathon')
fs.mkdirSync(OUT, { recursive: true })
const H = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' }

async function demoSession() {
  const gl = await (await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, { method: 'POST', headers: H, body: JSON.stringify({ type: 'magiclink', email: 'founder@adminos-demo.co.za' }) })).json()
  const v = await fetch(`${SUPABASE_URL}/auth/v1/verify`, { method: 'POST', headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'magiclink', token_hash: gl.hashed_token }) })
  if (!v.ok) throw new Error(`verify ${v.status}`)
  const s = await v.json()
  return { ...s, expires_at: s.expires_at ?? Math.floor(Date.now() / 1000) + s.expires_in }
}

const STEPS = [
  ['dashboard', '/dashboard'], ['contacts', '/dashboard/contacts'], ['invoices', '/dashboard/invoices'],
  ['money', '/dashboard/money'], ['cashflow', '/dashboard/cashflow'], ['compliance', '/dashboard/compliance'],
  ['suppliers', '/dashboard/suppliers'], ['bookings', '/dashboard/bookings'], ['inventory', '/dashboard/inventory'],
  ['staff', '/dashboard/staff'], ['tasks', '/dashboard/tasks'], ['contracts', '/dashboard/contracts'],
  ['goals', '/dashboard/getting-started'], ['health', '/dashboard/health'], ['inbox', '/dashboard/inbox'],
  ['expenses', '/dashboard/expenses'], ['analytics', '/dashboard/analytics'], ['calendar', '/dashboard/calendar'],
  ['settings', '/dashboard/settings'],
]
const VPS = [{ n: 'desktop', width: 1440, height: 900 }, { n: 'mobile', width: 390, height: 844 }].filter(v => !VP_ONLY || VP_ONLY.includes(v.n))

const session = await demoSession()
const browser = await chromium.launch()
const report = []
for (const vp of VPS) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.n === 'mobile' ? 2 : 1 })
  await ctx.addInitScript(() => { try { localStorage.setItem('adminos_cookie_consent', 'declined') } catch {} })
  await ctx.addCookies(sessionCookies(session).map(c => ({ ...c, url: BASE })))
  for (const [name, p] of STEPS.filter(([n]) => !ONLY || ONLY.includes(n))) {
    const page = await ctx.newPage()
    const errs = []
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)) })
    page.on('pageerror', e => errs.push('pageerror: ' + e.message.slice(0, 160)))
    let status = 0, ms = 0
    const t0 = Date.now()
    try {
      const r = await page.goto(BASE + p, { waitUntil: 'networkidle', timeout: 45000 }); status = r?.status() ?? 0
    } catch (e) { errs.push('nav: ' + e.message.slice(0, 120)) }
    await page.waitForTimeout(1200); ms = Date.now() - t0
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth).catch(() => -1)
    const landed = new URL(page.url()).pathname
    const text = (await page.locator('body').innerText().catch(() => '')).slice(0, 4000)
    const bad = /application error|something went wrong|internal server error|404|could not load/i.test(text)
    await page.screenshot({ path: path.join(OUT, `${name}__${vp.n}.png`) })
    report.push({ vp: vp.n, name, status, landed, ms, overflow, errs: errs.slice(0, 3), errorText: bad })
    await page.close()
  }
  await ctx.close()
}
await browser.close()
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 1))
for (const r of report) console.log(`${r.vp.padEnd(8)} ${r.name.padEnd(11)} ${r.status} ${r.landed !== '/dashboard' && !r.landed.includes(r.name) ? '→' + r.landed : ''} ${r.ms}ms ovf=${r.overflow} errs=${r.errs.length}${r.errorText ? ' ERRTEXT' : ''}`)
