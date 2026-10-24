# AdminOS web: world-class user readiness (production, 2026-10-24)

Read-only run against https://www.adminos.co.za as the demo owner (founder@adminos-demo.co.za, magic-link session). Navigation only; no writes. Viewports 360x740, 390x844, 768x1024, 1440x900. Scripts and raw JSON are in `docs/readiness/_run/`; problem screenshots in `docs/readiness/web-shots/`.

Coverage: all 46 nav routes at 390 and (first 6 of them at 1440 plus the 8 key pages at all four sizes); 7 public pages at all four sizes; axe-core on 8 key dashboard pages plus login, signup and landing; Slow 4G + 4x CPU on 8 loads.

## Verdict

Not blocked from launching to real users: every route returns 200, no route has horizontal overflow, no raw `undefined/NaN/null/ISO date` copy, no JS errors, no failed (non-prefetch) requests, and the PWA basics exist. But for the load-shedding / prepaid-data audience, the app is **not yet world-class**: there is no offline experience at all, the landing page ships ~1.4 MB of background JPEGs (LCP 11.5 s on Slow 4G), and first dashboard hits are slow because of serial uncached Supabase auth lookups. Accessibility has fixable gaps (unlabelled controls, contrast, small targets).

## BLOCKERS

None found that stop sign-up or use. The nearest candidates are the HIGH items below (offline, landing weight).

## HIGH

1. **No offline fallback; dashboard offline cache is dead.** Page: any, 390x844. Evidence: with context offline, reload of `/dashboard/money` and `/` shows the browser error page (ERR_INTERNET_DISCONNECTED / ERR_FAILED), screenshots `offline_dashboard_money.png`, `offline_.png`. `/offline` returns 404. In `public/sw.js` the dashboard route regex is `^https://adminos\.co\.za/dashboard.*` but production is `www.adminos.co.za`, so it never matches (also only 1h TTL, GET only). Fix: change the pattern to match `www.` (or use `self.location.origin`), add an `/offline` page precached and used as Workbox `setCatchHandler`/navigation fallback; source config is the next-pwa/workbox config in `next.config.*` (sw.js is generated).
2. **Landing page weight and LCP.** Page `/`, 390x844, Slow 4G: LCP 11.5 s, load 11.2 s, 1.6 MB transferred, of which `/backgrounds/bg-dark-leather-black.jpg` (281 KB), `bg-blue-strata.jpg` (214 KB), `bg-dark.jpg` (138 KB) each took 6-7 s and are fetched at mobile. Landing HTML TTFB 2.2 s. Fix: serve AVIF/WebP via `next/image` or CSS `image-set`, preload only the hero one, lazy-load below-fold backgrounds, skip decorative backgrounds on small screens (`app/page.tsx`, `app/globals.css`).
3. **Slow first dashboard hit (the ~11 s you saw): serial Supabase round trips per request.** Evidence: `/dashboard/invoices` TTFB 6.2 s on a fresh context (response header `cfOrigin;dur=733` so most of it is not raw origin compute; cold edge/function plus queued DB lookups), while `/dashboard`, `/contacts`, `/money`, `/inbox` were 0.64-0.93 s TTFB when warm. Code: `app/dashboard/layout.tsx` is `force-dynamic` and awaits, in sequence, `auth.getUser()` (network call to Supabase), a `tenants` query, then `getContext()` which calls `getUser()` AGAIN, then `checkSuperAdmin` and `getUserPermissions` (`lib/auth/context.ts` lines 76-89); then each page repeats `getUser()` and `checkPermission()` (e.g. `app/dashboard/invoices/page.tsx` 23-29). That is roughly 6-10 sequential DB/auth round trips before any HTML, and the free-plan Supabase (see auto-pause memory) adds cold-start spikes. Fix: wrap `getContext`/`getUser` in React `cache()` so layout and page share one result; run tenants + super-admin + permissions in `Promise.all`; stream with `loading.tsx` per route (only one `loading.tsx` exists, at `app/dashboard/loading.tsx`); keep Supabase on a paid, non-pausing plan in the same region as the origin. Also UNVERIFIED: I could not separate Cloudflare-to-Vercel origin cold start from Supabase latency without server logs.
4. **Unlabelled / unnamed controls (WCAG 1.3.1, 4.1.2, critical in axe).** `/dashboard/settings` (axe: `label` x2, `select-name` x1; 10 unlabelled fields), `/dashboard/invoices` (34 icon buttons with no accessible name, e.g. `min-h-[44px]` buttons with no `aria-label`; 46 unlabelled fields mostly in the always-mounted hidden create-invoice modal), also `/contacts` (6), `/staff` (8), `/inventory` (8), `/tasks` (5), `/signup` (4 inputs use placeholder only), `/login` (axe `label` x1). Fix: add `<label htmlFor>` or `aria-label`; unmount modal contents until opened (`CreateInvoiceModal.tsx`, `InvoicesTable.tsx`).
5. **Closed mobile drawer is keyboard-focusable.** `/dashboard`, 390: the sidebar `aside` sits at left -240 px and the first Tab stops go "Open menu", "Close menu", then every off-screen nav link. Fix: `inert`/`aria-hidden` plus `visibility:hidden` when closed, focus trap and Esc when open (`components/dashboard/Sidebar.tsx`).

## MEDIUM

1. **Touch targets under 44 px on mobile.** Every dashboard page at 360/390/768 has 53-99 interactive elements under 44 px (key pages: invoices 99, settings 78, dashboard 70). Examples: sidebar nav links 215x36; landing nav links ~19 px tall (`AI Agents`, `Pricing`, `Try Demo` footer/menu links), `Add to plan` 30 px, `Free trial` 36 px, `Open menu` 40x40, `Close menu` 32x32; invoices "Mark sent" 52x16 (axe target-size serious). Fix: `min-h-11` on nav links and row actions.
2. **Colour contrast (axe serious).** White on indigo `#6366f1` = 4.46:1 (needs 4.5) on primary buttons in `/contacts` (15 nodes), `/settings` (4), `/tasks` (2); white on pink `#ec4899` avatar initials 3.52:1; login (4), signup (8), landing (37 nodes, not itemised: UNVERIFIED which). Fix: darken button indigo to `#4f46e5`, use dark text on pink.
3. **Light theme not delivered.** With `prefers-color-scheme: light` the app stays dark (body `rgb(10,15,44)`); `<html data-theme="dark">` and one theme toggle button exists in the shell. Light mode itself UNVERIFIED (toggle not clicked: it writes a preference). Screenshot `light_scheme_dashboard.png`.
4. **404 page overflows at 360 px (20 px) and 390 px (5 px).** `docs/readiness/web-shots/404_360.png`. Also its "dashboard" link prefetch hits `/login?redirect=%2Fdashboard` for logged-out visitors. Fix: `app/not-found.tsx` container `max-w-full px-4`, break long text.
5. **`/demo` has no `<h1>`, and `/signup`, `/login`, `/demo` share the generic title/description** ("AdminOS — The OS That Runs Your Business"). Fix: per-route `metadata` with unique titles/h1.
6. **Few loading skeletons.** Only `app/dashboard/loading.tsx` exists; at ~400 ms after DOMContentLoaded 52 of 54 routes showed zero skeleton elements (only `/langa` 1, `/community` 3), i.e. blank-ish shell while the server renders. Pair with HIGH #3 streaming.
7. **Manifest:** the `maskable` icon reuses the plain 512 icon (will be cropped on Android); screenshots only `wide` (no `narrow`, hurts rich install UI); `purpose` split recommended. `public/manifest.json`.

## LOW

1. No skip-to-content link in dashboard (`skiplink` false).
2. Landing: 21-29 elements <44 px; page ships 306 KB JS (gzip) shared across pages, acceptable but loaded on login too (293 KB on `/login`).
3. Third-party Sentry CDN loader (`js.sentry-cdn.com`) took 2.5 s TTFB on invoices; load it async/after idle.
4. Focus rings present (browser default `outline:auto`) but no custom high-contrast ring; fine for AA.
5. Aborted `_rsc` prefetch requests are logged as failed when navigating away (not real failures); the Link prefetch storm (~60 requests on one dashboard load, 650-800 KB) is wasteful on prepaid data: set `prefetch={false}` for sidebar links on mobile.
6. Heavy pages by wall time at 390 (unthrottled, slow laptop, includes prefetch): `/health` 33 s, `/valuation` 30 s, `/calendar` 26 s, `/billing` 26 s, `/team` 25 s. Treat as relative; not isolated individually (UNVERIFIED cause).

## Performance table (390x844, Slow 4G 1.6 Mbps / 150 ms RTT, 4x CPU)

| Page | TTFB | DCL | LCP | CLS | JS KB | Total KB |
|---|---|---|---|---|---|---|
| / | 2178 | 5102 | 11508 | 0 | 306 | 1601 |
| /login | 1532 | 4112 | 2624 | 0 | 293 | 409 |
| /dashboard (1st) | 797 | 3194 | 1548 | 0 | 306 | 665 |
| /dashboard (2nd) | 909 | 3365 | 2104 | 0 | 306 | 650 |
| /dashboard/invoices | 6187 | 9411 | 9720 | 0 | 327 | 670 |
| /dashboard/contacts | 761 | 2709 | 2472 | 0 | 321 | 803 |
| /dashboard/money | 637 | 2122 | 1896 | 0 | 308 | 643 |
| /dashboard/inbox | 642 | 2002 | 1812 | 0 | 315 | 779 |

CLS is 0 everywhere. JS is lean (~300 KB). The 11 s cold case was not reproduced on `/dashboard` (warm today) but was on `/dashboard/invoices` (6.2 s TTFB).

## Public surface findings

- All 7 pages 200 (404 page correctly 404), lang `en-ZA`, one h1 each (except /demo), OG image/title, Twitter card and canonical present, no broken images, no missing alts, 0 broken internal links (12 checked from landing), no horizontal overflow except the 404 page. `robots.txt`, `sitemap.xml`, `favicon.ico`, `manifest.json`, `sw.js` all 200; service worker registers.
- No console errors on public pages besides the intended 404 resource error.
- Privacy/Terms are real content; "load shedding" mention in Terms is legitimate copy (earlier regex hits were false positives).

## What is genuinely excellent

- Zero horizontal overflow on all 46 dashboard routes at 360/390/768/1440 (the earlier `min-w-0` fix held).
- Zero console errors, zero failed requests, zero placeholder/NaN/raw-date copy, zero error screens across the whole dashboard.
- CLS 0 on every page; JS budget ~300 KB; warm dashboard TTFB under 1 s and LCP under 2.5 s even on Slow 4G.
- Complete SEO/meta hygiene (OG, Twitter, canonical, sitemap, robots, lang en-ZA), working manifest with shortcuts, installed service worker with cache-first static assets.
- Visible keyboard focus on all sampled controls; consistent 44 px minimum on the icon buttons that were designed for it.
- Auth/permission gates behave: every route resolves for the demo owner with no redirects.

## Not tested / UNVERIFIED

Light theme via toggle; 360/768 for the 38 non-key routes; axe on non-key pages; modal focus traps (opening modals requires clicks that may write; skipped); landing contrast offender list; true server-side split of cold-start cost.
