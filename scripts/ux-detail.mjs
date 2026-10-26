// Dumps axe node details + unlabelled controls for chosen pages (read-only, demo session).
//   node scripts/ux-detail.mjs /dashboard/settings,/dashboard/contacts [--w 1440]
import fs from 'fs'
import { chromium } from '@playwright/test'
import { env, SUPABASE_URL, sessionCookies } from './lib/qa.mjs'
const args = process.argv.slice(2)
const BASE = 'https://www.adminos.co.za'
const pages = args[0].split(',').map(s => '/dashboard/' + s)
const w = args.includes('--w') ? Number(args[args.indexOf('--w') + 1]) : 1440
const H = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' }
const gl = await (await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, { method: 'POST', headers: H, body: JSON.stringify({ type: 'magiclink', email: 'founder@adminos-demo.co.za' }) })).json()
const v = await (await fetch(`${SUPABASE_URL}/auth/v1/verify`, { method: 'POST', headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'magiclink', token_hash: gl.hashed_token }) })).json()
const session = { ...v, expires_at: v.expires_at ?? Math.floor(Date.now() / 1000) + v.expires_in }
const axe = fs.readFileSync('node_modules/axe-core/axe.min.js', 'utf8')
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: w, height: 900 } })
await ctx.addInitScript(() => { try { localStorage.setItem('adminos_cookie_consent', 'declined') } catch {} })
await ctx.addCookies(sessionCookies(session).map(c => ({ ...c, url: BASE })))
for (const p of pages) {
  const page = await ctx.newPage(); await page.goto(BASE + p, { waitUntil: 'networkidle', timeout: 60000 }); await page.waitForTimeout(800)
  await page.evaluate(axe)
  const r = await page.evaluate(() => axe.run({ runOnly: ['wcag2a', 'wcag2aa', 'wcag22aa'] }))
  console.log('==', p)
  for (const x of r.violations) for (const n of x.nodes.slice(0, 6)) console.log(x.id, '|', n.target.join(' ').slice(0, 70), '|', n.html.slice(0, 120).replace(/\s+/g, ' '), '|', (n.any[0]?.message || n.all[0]?.message || '').slice(0, 90))
  const un = await page.evaluate(() => [...document.querySelectorAll('input:not([type=hidden]),select,textarea,button,a[href]')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 }).filter(e => { const t = e.tagName; if (t === 'INPUT' || t === 'SELECT' || t === 'TEXTAREA') return !(e.id && document.querySelector(`label[for="${e.id}"]`)) && !e.closest('label') && !e.getAttribute('aria-label') && !e.getAttribute('aria-labelledby'); return !(e.getAttribute('aria-label') || e.textContent.trim() || e.title) }).map(e => e.outerHTML.slice(0, 140)))
  console.log('unlabelled:', un.length); un.slice(0, 12).forEach(u => console.log('  ', u))
  await page.close()
}
await b.close()
