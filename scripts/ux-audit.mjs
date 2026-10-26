// Read-only UX audit of production as the demo owner (magic-link session, no passwords).
// Navigation + non-mutating probes only (opens modals / menus, never submits).
//   node scripts/ux-audit.mjs [baseUrl] [--out dir]
// Per page x viewport: status, TTFB/FCP/LCP/CLS, overflow, console errors, axe (wcag2a/aa/22aa),
// touch targets < 44px, unlabelled controls, h1 count, empty/skeleton/error signals, screenshot.
import fs from 'fs'
import path from 'path'
import { chromium } from '@playwright/test'
import { env, SUPABASE_URL, sessionCookies } from './lib/qa.mjs'

const args = process.argv.slice(2)
const BASE = args.find(a => a.startsWith('http')) ?? 'https://www.adminos.co.za'
const OUT = args.includes('--out') ? path.resolve(args[args.indexOf('--out') + 1]) : path.join(process.cwd(), 'scripts', 'audit-out', 'ux')
fs.mkdirSync(OUT, { recursive: true })
const H = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' }
const axeSrc = fs.readFileSync('node_modules/axe-core/axe.min.js', 'utf8')

async function demoSession() {
  const gl = await (await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, { method: 'POST', headers: H, body: JSON.stringify({ type: 'magiclink', email: 'founder@adminos-demo.co.za' }) })).json()
  const v = await (await fetch(`${SUPABASE_URL}/auth/v1/verify`, { method: 'POST', headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'magiclink', token_hash: gl.hashed_token }) })).json()
  return { ...v, expires_at: v.expires_at ?? Math.floor(Date.now() / 1000) + v.expires_in }
}

const PAGES = [
  '/dashboard', '/dashboard/invoices', '/dashboard/contacts', '/dashboard/money', '/dashboard/bank',
  '/dashboard/cashflow', '/dashboard/expenses', '/dashboard/payroll', '/dashboard/staff', '/dashboard/inventory',
  '/dashboard/bookings', '/dashboard/inbox', '/dashboard/tasks', '/dashboard/compliance', '/dashboard/settings',
  '/dashboard/getting-started', '/dashboard/health',
]
const VPS = [{ n: 'm360', width: 360, height: 740, dsf: 2 }, { n: 'tablet', width: 768, height: 1024, dsf: 1 }, { n: 'desk', width: 1440, height: 900, dsf: 1 }]

const probe = () => {
  const vis = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' }
  const name = el => (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.textContent || el.getAttribute('title') || el.getAttribute('placeholder') || '').trim()
  const targets = [...document.querySelectorAll('a[href],button,[role=button],input:not([type=hidden]),select,textarea')].filter(vis)
  const small = targets.filter(el => { const r = el.getBoundingClientRect(); return r.height < 44 || r.width < 44 }).filter(el => { const r = el.getBoundingClientRect(); return r.top < innerHeight * 3 })
  const noName = targets.filter(el => {
    if (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') {
      return !(el.id && document.querySelector(`label[for="${el.id}"]`)) && !el.closest('label') && !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby')
    }
    return !name(el)
  })
  const text = document.body.innerText || ''
  return {
    h1: document.querySelectorAll('h1').length,
    title: document.title,
    targets: targets.length,
    small: small.length,
    smallEx: small.slice(0, 3).map(e => (e.getAttribute('aria-label') || e.textContent || e.tagName).trim().slice(0, 24) + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height)),
    noName: noName.length,
    noNameEx: noName.slice(0, 3).map(e => e.outerHTML.slice(0, 80)),
    overflow: document.documentElement.scrollWidth - innerWidth,
    skeletons: document.querySelectorAll('[class*=skeleton],[class*=animate-pulse]').length,
    emptyState: /no .{1,30} yet|nothing here|get started|add your first|no results/i.test(text),
    errorText: /application error|something went wrong|internal server error|could not load|failed to load|undefined|NaN|\[object/i.test(text),
    imgNoAlt: [...document.images].filter(i => !i.hasAttribute('alt')).length,
    skipLink: !!document.querySelector('a[href="#main"],a[href="#content"],[class*=skip]'),
    lang: document.documentElement.lang,
  }
}

const session = await demoSession()
const browser = await chromium.launch()
const rows = []
for (const vp of VPS) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.dsf })
  await ctx.addInitScript(() => {
    try { localStorage.setItem('adminos_cookie_consent', 'declined') } catch {}
    window.__cls = 0; window.__lcp = 0
    new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value }).observe({ type: 'layout-shift', buffered: true })
    new PerformanceObserver(l => { const e = l.getEntries().at(-1); if (e) window.__lcp = e.startTime }).observe({ type: 'largest-contentful-paint', buffered: true })
  })
  await ctx.addCookies(sessionCookies(session).map(c => ({ ...c, url: BASE })))
  for (const p of PAGES) {
    const page = await ctx.newPage()
    const errs = []
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 140)) })
    page.on('pageerror', e => errs.push('pageerror: ' + e.message.slice(0, 140)))
    let status = 0
    try { status = (await page.goto(BASE + p, { waitUntil: 'networkidle', timeout: 60000 }))?.status() ?? 0 } catch (e) { errs.push('nav: ' + e.message.slice(0, 100)) }
    await page.waitForTimeout(1000)
    const nav = await page.evaluate(() => { const n = performance.getEntriesByType('navigation')[0]; return { ttfb: Math.round(n?.responseStart ?? 0), dcl: Math.round(n?.domContentLoadedEventEnd ?? 0), lcp: Math.round(window.__lcp), cls: +window.__cls.toFixed(3) } }).catch(() => ({}))
    const m = await page.evaluate(probe).catch(() => ({}))
    let axe = []
    if (vp.n !== 'tablet') {
      try {
        await page.evaluate(axeSrc)
        const r = await page.evaluate(() => axe.run({ runOnly: ['wcag2a', 'wcag2aa', 'wcag22aa'] }))
        axe = r.violations.map(v => `${v.id}[${v.impact}]x${v.nodes.length}`)
      } catch { axe = ['axe-failed'] }
    }
    const slug = p.replace('/dashboard', '').replace(/\//g, '') || 'home'
    await page.screenshot({ path: path.join(OUT, `${slug}__${vp.n}.png`) })
    rows.push({ vp: vp.n, p, landed: new URL(page.url()).pathname, status, ...nav, ...m, axe, errs: errs.slice(0, 3) })
    console.log(`${vp.n.padEnd(6)} ${p.padEnd(27)} ${status} ttfb=${nav.ttfb} lcp=${nav.lcp} cls=${nav.cls} ovf=${m.overflow} small=${m.small}/${m.targets} noName=${m.noName} h1=${m.h1} axe=${axe.length} errs=${errs.length}`)
    await page.close()
  }
  await ctx.close()
}

// Interaction probes (non-mutating) on desktop + phone.
const probes = []
for (const vp of [VPS[0], VPS[2]]) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } })
  await ctx.addInitScript(() => { try { localStorage.setItem('adminos_cookie_consent', 'declined') } catch {} })
  await ctx.addCookies(sessionCookies(session).map(c => ({ ...c, url: BASE })))
  const page = await ctx.newPage()
  await page.goto(BASE + '/dashboard/invoices', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
  const btn = page.getByRole('button', { name: /new invoice|create invoice|add invoice/i }).first()
  if (await btn.count()) {
    await btn.click().catch(() => {})
    await page.waitForTimeout(700)
    const dlg = page.locator('[role=dialog],[aria-modal=true]').first()
    const hasDialog = await dlg.count()
    await page.screenshot({ path: path.join(OUT, `modal-new-invoice__${vp.n}.png`) })
    const focusIn = await page.evaluate(() => !!document.activeElement?.closest('[role=dialog],[aria-modal=true]')).catch(() => false)
    await page.keyboard.press('Escape'); await page.waitForTimeout(400)
    const closedOnEsc = hasDialog ? (await dlg.isVisible().catch(() => false)) === false : null
    probes.push({ vp: vp.n, probe: 'new-invoice modal', opened: true, roleDialog: !!hasDialog, focusMovedIn: focusIn, escCloses: closedOnEsc })
  } else probes.push({ vp: vp.n, probe: 'new-invoice modal', opened: false })
  // keyboard: first 8 tab stops on dashboard
  await page.goto(BASE + '/dashboard', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
  const stops = []
  for (let i = 0; i < 8; i++) { await page.keyboard.press('Tab'); stops.push(await page.evaluate(() => { const e = document.activeElement; const r = e?.getBoundingClientRect(); return `${e?.tagName}:${(e?.getAttribute('aria-label') || e?.textContent || '').trim().slice(0, 20)}@${Math.round(r?.left ?? 0)}` })) }
  probes.push({ vp: vp.n, probe: 'tab order', stops })
  // 404 + offline
  const nf = await page.goto(BASE + '/definitely-not-a-page', { waitUntil: 'load' }).catch(() => null)
  probes.push({ vp: vp.n, probe: '404', status: nf?.status(), overflow: await page.evaluate(() => document.documentElement.scrollWidth - innerWidth) })
  await page.goto(BASE + '/dashboard/money', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
  await ctx.setOffline(true)
  const off = await page.reload({ timeout: 8000 }).then(() => 'rendered').catch(e => 'browser error: ' + e.message.slice(0, 50))
  probes.push({ vp: vp.n, probe: 'offline reload /money', result: off })
  await ctx.setOffline(false)
  await ctx.close()
}
await browser.close()
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ rows, probes }, null, 1))
console.log(JSON.stringify(probes, null, 1))
