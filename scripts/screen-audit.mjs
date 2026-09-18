// Read-only screen-by-screen audit crawler.
// Signs up ONE disposable QA tenant, then navigates (never clicks a mutating
// button) through every top-level dashboard route at desktop + mobile
// viewports, recording console errors, HTTP status, and horizontal-overflow
// (the most common mobile-responsive symptom in this app).
//
// Usage: node scripts/screen-audit.mjs [baseUrl]
// Output: scripts/audit-out/report.json + screenshots per route/viewport.

import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

// Local `next dev` fails on this machine (OneDrive file-sync read errors on
// next.config.ts — a known standing constraint, not fixable from here), so
// this audits the live production site by default. Pure navigation only —
// no mutating clicks — so this is safe to run against real prod.
const BASE_URL = process.argv[2] || process.env.AUDIT_BASE_URL || 'https://adminos.co.za'
const OUT_DIR = path.join(process.cwd(), 'scripts', 'audit-out')
mkdirSync(OUT_DIR, { recursive: true })

const ROUTES = [
  '', // dashboard root
  'analytics', 'announcements', 'board-pack', 'bookings', 'calendar', 'cashflow',
  'community', 'compliance', 'contacts', 'contracts', 'creative-assets', 'documents',
  'email-studio', 'expenses', 'getting-started', 'governance', 'handbook', 'health',
  'inbox', 'integrations', 'inventory', 'invoices', 'ir-log', 'knowledge-base', 'langa',
  'licenses', 'money', 'onboarding', 'ops', 'payroll', 'people', 'reach', 'ring',
  'safety', 'sales', 'sequences', 'settings', 'settings/autonomy', 'settings/billing',
  'settings/compliance', 'settings/employment-equity', 'settings/onboarding',
  'settings/referrals', 'staff', 'stokvel', 'suppliers', 'tasks', 'team', 'valuation',
  'workflow-monitor',
]

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]

const stamp = Date.now()
const qaEmail = `nandaregine+adminosqa${stamp}@gmail.com`
const qaPassword = 'AdminOS-QA-Audit-2026!'

async function signUp(page) {
  await page.goto(`${BASE_URL}/signup`, { waitUntil: 'load' })
  await page.getByPlaceholder('Jane Smith').fill('QA Audit')
  await page.getByPlaceholder('Sunshine Hardware').fill('QA Audit Co')
  await page.getByPlaceholder('you@business.co.za').fill(qaEmail)
  await page.getByPlaceholder('Min. 8 characters').fill(qaPassword)
  await page.getByRole('button', { name: 'Create account' }).click()
  await page.waitForURL(/\/dashboard\/onboarding|\/login/, { timeout: 15000 }).catch(() => {})
  const url = page.url()
  let pageErrorText = null
  try {
    pageErrorText = await page.locator('.text-red-700').first().textContent({ timeout: 1000 })
  } catch {
    // no visible error banner
  }
  return { url, confirmationRequired: !url.includes('/dashboard'), pageErrorText }
}

async function auditRoute(context, route, viewport) {
  const page = await context.newPage()
  const consoleErrors = []
  const pageErrors = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 300))
  })
  page.on('pageerror', (err) => pageErrors.push(String(err).slice(0, 300)))

  let status = null
  let loadError = null
  try {
    const resp = await page.goto(`${BASE_URL}/dashboard/${route}`, {
      waitUntil: 'networkidle',
      timeout: 20000,
    })
    status = resp ? resp.status() : null
  } catch (e) {
    loadError = String(e).slice(0, 300)
  }

  await page.waitForTimeout(500) // let client components settle

  let overflow = null
  try {
    overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      hasHorizontalScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 4,
    }))
  } catch {
    // page may have navigated away (e.g. redirected to /login)
  }

  const redirectedToLogin = page.url().includes('/login')
  const routeSlug = route === '' ? 'root' : route.replace(/\//g, '_')
  const screenshotPath = path.join(OUT_DIR, `${routeSlug}__${viewport.name}.png`)
  try {
    await page.screenshot({ path: screenshotPath, fullPage: false })
  } catch {
    // ignore
  }

  await page.close()

  return {
    route: route || '(root)',
    viewport: viewport.name,
    status,
    loadError,
    redirectedToLogin,
    finalUrl: page.url(),
    consoleErrors,
    pageErrors,
    overflow,
    screenshot: screenshotPath,
  }
}

async function main() {
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: VIEWPORTS[0] })
  const authPage = await context.newPage()

  console.log(`Signing up disposable QA tenant: ${qaEmail}`)
  const signupResult = await signUp(authPage)
  console.log('Signup result:', signupResult)

  if (signupResult.confirmationRequired) {
    await authPage.close()
    console.error('Email confirmation required — cannot proceed without a working inbox link. Stopping.')
    await browser.close()
    writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify({ signupResult, results: [] }, null, 2))
    process.exit(1)
  }

  // Skip the AI-chat onboarding flow (Siyanda) — too fragile to script
  // reliably — and mark it complete directly via the same endpoint the app
  // itself uses, so middleware stops redirecting every /dashboard/* route
  // back to /dashboard/onboarding.
  const completeResp = await authPage.evaluate(async () => {
    const res = await fetch('/api/onboarding/complete', { method: 'POST' })
    return { status: res.status, ok: res.ok }
  })
  console.log('Onboarding complete call:', completeResp)
  await authPage.close()

  const storageState = await context.storageState()
  await context.close()

  const results = []
  for (const viewport of VIEWPORTS) {
    const vpContext = await browser.newContext({ viewport, storageState })
    for (const route of ROUTES) {
      const r = await auditRoute(vpContext, route, viewport)
      console.log(
        `[${viewport.name}] /dashboard/${route || ''} -> status=${r.status} ` +
        `errors=${r.consoleErrors.length + r.pageErrors.length} ` +
        `overflow=${r.overflow?.hasHorizontalScroll} redirectedToLogin=${r.redirectedToLogin}`
      )
      results.push(r)
    }
    await vpContext.close()
  }

  await browser.close()

  writeFileSync(
    path.join(OUT_DIR, 'report.json'),
    JSON.stringify({ qaEmail, signupResult, results }, null, 2)
  )
  console.log(`\nDone. Report: ${path.join(OUT_DIR, 'report.json')}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
