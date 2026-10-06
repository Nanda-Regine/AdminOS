// Day-in-the-life walk for the 7 QA personas (Workstream D, BUILD_JOURNEY Session 20).
//
// Signs each persona in (session cookie, scripts/lib/qa.mjs), then opens the
// pages their day needs, at desktop and phone width, and records:
//   - the seeded records they must be able to see (expect)
//   - records they must NOT see (forbid), e.g. the owner-only task for a driver
//   - pages that must be blocked for their role (404 UI)
//   - console errors, failed loads, horizontal overflow on a phone
// Read-only: navigation only, no clicks on anything that writes.
//
//   node scripts/persona-walk.mjs [baseUrl] [--only clinic,logistics]
// Output: scripts/audit-out/persona-walk/<persona>/*.png + report.json
import fs from 'fs'
import path from 'path'
import { chromium } from '@playwright/test'
import { signIn, sessionCookies } from './lib/qa.mjs'

const args = process.argv.slice(2)
const BASE = args.find(a => a.startsWith('http')) ?? 'https://www.adminos.co.za'
const ONLY = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',') : null
const OUT = path.join(process.cwd(), 'scripts', 'audit-out', 'persona-walk')

// Each step: page, text that must show, text that must not, or blocked: true.
const WALKS = {
  salon: [
    { path: '/dashboard', expect: [] },
    { path: '/dashboard/bookings', expect: ['Nosipho Jali', 'Knotless braids'] },
    { path: '/dashboard/sales', expect: [] },
    { path: '/dashboard/inventory', expect: ['Braiding hair'] },
    { path: '/dashboard/staff', expect: ['Ayanda Qwabe'] },
    { path: '/dashboard/payroll', expect: [] },
    { path: '/dashboard/money', expect: [] },
    { path: '/dashboard/inbox', expect: [] },
    { path: '/dashboard/analytics', expect: [] },
    { path: '/dashboard/cashflow', expect: [] },
    { path: '/dashboard/sequences/new', expect: [] },
    { path: '/dashboard/settings', expect: ['Business Details', 'Financial year ends'] },
  ],
  ngo: [
    { path: '/dashboard', expect: [] },
    { path: '/dashboard/expenses', expect: ['Taxi fares'] },
    { path: '/dashboard/payroll', expect: [] },
    { path: '/dashboard/staff', expect: ['Phumeza Ndamase'] },
    { path: '/dashboard/board-pack', expect: [] },
    { path: '/dashboard/compliance', expect: ['EMP201'] },
    { path: '/dashboard/settings/compliance', expect: [] },
    { path: '/dashboard/settings/billing', blocked: true },
  ],
  trades: [
    { path: '/dashboard', expect: [] },
    { path: '/dashboard/tasks', expect: ['Pour slab'] },
    { path: '/dashboard/safety', expect: [] },
    { path: '/dashboard/suppliers', expect: ['Coastal Builders Warehouse'] },
    { path: '/dashboard/inventory', expect: ['Cement 50kg'] },
    { path: '/dashboard/team', expect: ['Bheki Tshabalala'] },
    { path: '/dashboard/invoices', expect: ['INV-1001'] },
    { path: '/dashboard/payroll', blocked: true },
    { path: '/dashboard/staff', blocked: true },
  ],
  clinic: [
    { path: '/dashboard', expect: ['Call back Mrs Ngxola'], forbid: ['Owner-only'] },
    { path: '/dashboard/bookings', expect: ['Nosiphiwo Ngxola'] },
    { path: '/dashboard/contacts', expect: ['Vuyani Mbiko'] },
    { path: '/dashboard/documents', expect: [] },
    { path: '/dashboard/tasks', expect: ['Call back Mrs Ngxola'], forbid: ['Owner-only'] },
    { path: '/dashboard/invoices', blocked: true },
    { path: '/dashboard/payroll', blocked: true },
    { path: '/dashboard/settings', blocked: true },
    { path: '/dashboard/inbox', blocked: true },
  ],
  creative: [
    { path: '/dashboard', expect: [] },
    { path: '/dashboard/invoices', expect: ['Sowetan Wedding Co.'] },
    { path: '/dashboard/contracts', expect: [] },
    { path: '/dashboard/creative-assets', expect: [] },
    { path: '/dashboard/sequences', expect: [] },
    { path: '/dashboard/cashflow', expect: [] },
    { path: '/dashboard/money', expect: [] },
  ],
  logistics: [
    { path: '/dashboard', expect: ['Deliver 6 parcels'], forbid: ['Owner-only', 'Debtors'] },
    { path: '/dashboard/tasks', expect: ['Deliver 6 parcels', 'Collect returns'], forbid: ['Owner-only', 'Mdantsane route'] }, // Mdantsane is the other driver's task
    { path: '/dashboard/contacts', expect: ['Vincent Park Pharmacy'] },
    { path: '/dashboard/invoices', blocked: true },
    { path: '/dashboard/staff', blocked: true },
    { path: '/dashboard/money', blocked: true },
    { path: '/dashboard/documents', blocked: true },
    { path: '/dashboard/reach/new', blocked: true },
    { path: '/dashboard/sequences/new', blocked: true },
    { path: '/dashboard/settings/onboarding', blocked: true },
  ],
  school: [
    { path: '/dashboard', expect: [] },
    { path: '/dashboard/invoices', expect: ['Mr & Mrs Govender'] },
    { path: '/dashboard/expenses', expect: ['Photocopier toner'] },
    { path: '/dashboard/announcements', expect: ['Welcome to AdminOS'] },
    { path: '/dashboard/compliance', expect: ['EMP201'] },
    { path: '/dashboard/payroll', blocked: true },
  ],
}

const VIEWPORTS = [{ name: 'desktop', width: 1440, height: 900 }, { name: 'phone', width: 390, height: 844 }]

const browser = await chromium.launch()
const report = { base: BASE, at: new Date().toISOString(), personas: [] }

for (const [key, steps] of Object.entries(WALKS)) {
  if (ONLY && !ONLY.includes(key)) continue
  const email = `nandaregine+persona-${key}@gmail.com`
  const session = await signIn(email)
  const host = new URL(BASE).hostname
  const cookies = sessionCookies(session).map(c => ({ ...c, domain: host, path: '/', httpOnly: false, secure: true, sameSite: 'Lax' }))
  fs.mkdirSync(path.join(OUT, key), { recursive: true })
  const results = []

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } })
    await context.addCookies(cookies)
    for (const step of steps) {
      const page = await context.newPage()
      const consoleErrors = []
      page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)) })
      page.on('pageerror', e => consoleErrors.push(String(e).slice(0, 200)))
      let status = null, err = null
      try {
        const resp = await page.goto(BASE + step.path, { waitUntil: 'networkidle', timeout: 30000 })
        status = resp?.status() ?? null
      } catch (e) { err = String(e).slice(0, 200) }
      const text = await page.locator('body').innerText().catch(() => '')
      const landed = new URL(page.url()).pathname
      const notFound = /Page Not Found|This page could not be found|page doesn.t exist/i.test(text)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 4).catch(() => null)
      const slug = step.path.replace(/^\/dashboard\/?/, '').replace(/\//g, '_') || 'home'
      await page.screenshot({ path: path.join(OUT, key, `${slug}__${vp.name}.png`) }).catch(() => {})
      const missing = (step.expect ?? []).filter(t => !text.includes(t))
      const leaked = (step.forbid ?? []).filter(t => text.includes(t))
      let verdict = 'ok'
      if (err || (status && status >= 500)) verdict = 'BROKEN'
      else if (step.blocked && !notFound && landed === step.path) verdict = 'NOT_BLOCKED'
      else if (!step.blocked && notFound) verdict = 'WRONGLY_BLOCKED'
      else if (!step.blocked && (missing.length || leaked.length)) verdict = leaked.length ? 'LEAK' : 'MISSING_DATA'
      else if (vp.name === 'phone' && overflow && !step.blocked) verdict = 'PHONE_OVERFLOW'
      results.push({ viewport: vp.name, path: step.path, status, landed, verdict, missing, leaked, consoleErrors: [...new Set(consoleErrors)].slice(0, 5), err })
      await page.close()
    }
    await context.close()
  }
  report.personas.push({ key, email, results })
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2))
  const bad = results.filter(r => r.verdict !== 'ok' || r.consoleErrors.length)
  console.log(`\n── ${key}: ${results.filter(r => r.verdict === 'ok').length}/${results.length} ok`)
  for (const b of bad) console.log(`  ${b.verdict.padEnd(16)} ${b.viewport.padEnd(7)} ${b.path}${b.missing.length ? `  missing: ${b.missing.join(', ')}` : ''}${b.leaked.length ? `  leaked: ${b.leaked.join(', ')}` : ''}${b.consoleErrors.length ? `  console: ${b.consoleErrors[0]}` : ''}${b.err ? `  ${b.err}` : ''}`)
}
await browser.close()
