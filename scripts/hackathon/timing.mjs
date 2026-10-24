// Read-only: server response time (TTFB) and DOMContentLoaded for a few dashboard pages, repeated.
//   node scripts/hackathon/timing.mjs [baseUrl] [--runs 3]
import { chromium } from '@playwright/test'
import { env, SUPABASE_URL, sessionCookies } from '../lib/qa.mjs'
const args = process.argv.slice(2)
const BASE = args.find(a => a.startsWith('http')) ?? 'https://www.adminos.co.za'
const RUNS = Number(args.includes('--runs') ? args[args.indexOf('--runs') + 1] : 3)
const H = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' }
const gl = await (await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, { method: 'POST', headers: H, body: JSON.stringify({ type: 'magiclink', email: 'founder@adminos-demo.co.za' }) })).json()
const v = await fetch(`${SUPABASE_URL}/auth/v1/verify`, { method: 'POST', headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'magiclink', token_hash: gl.hashed_token }) })
const s = await v.json(); const session = { ...s, expires_at: s.expires_at ?? Math.floor(Date.now() / 1000) + s.expires_in }
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
await ctx.addInitScript(() => { try { localStorage.setItem('adminos_cookie_consent', 'declined') } catch {} })
await ctx.addCookies(sessionCookies(session).map(c => ({ ...c, url: BASE })))
for (const p of ['/dashboard', '/dashboard/tasks', '/dashboard/invoices']) {
  const rows = []
  for (let i = 0; i < RUNS; i++) {
    const page = await ctx.newPage()
    const t0 = Date.now()
    const r = await page.goto(BASE + p, { waitUntil: 'domcontentloaded', timeout: 60000 })
    const dcl = Date.now() - t0
    const ttfb = await page.evaluate(() => Math.round(performance.getEntriesByType('navigation')[0].responseStart))
    rows.push(`${r?.status()} ttfb=${ttfb}ms dcl=${dcl}ms`)
    await page.close()
  }
  console.log(p.padEnd(22), rows.join(' | '))
}
await browser.close()
