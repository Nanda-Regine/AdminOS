# AdminOS — Complete To-Do List
> Generated 12 June 2026 · Mirembe Muse (Pty) Ltd
> ✅ = done · ☐ = not done · ⚠️ = partial

---

## 🚨 CRITICAL BLOCKERS (do first)

- ✅ **Insert founder into admins table** — done 2026-06-12 (user_id: 5dcd2b45-4ec4-4f78-b5e0-7fced93e7a09)
- ✅ **Call seed_compliance_calendar()** — done 2026-06-12 for Mirembe Muse tenant (4faeb85f)

---

## PHASE 0 — Infrastructure & Foundations

### Database / Backend
- ✅ AI cost controls tables (`ai_usage_logs`, `ai_cost_budgets`, `rate_limit_overrides`)
- ✅ Priority queue system (`workflow_queue.priority`, plan-based routing)
- ✅ Role & permission system (`roles`, `user_roles` tables + middleware)
- ✅ Solo/Team mode toggle (`tenants.mode`, `/api/settings/mode`)
- ☐ **af-south-1 migration** — create new Supabase project in Cape Town, migrate data, update env vars
- ☐ **Read replica** — for analytics queries
- ☐ **Table partitioning** — `messages`, `conversations`, `workflow_queue` by tenant_id
- ☐ **Composite indexes** — (tenant_id, created_at) on messages, conversations, audit_log
- ☐ **Push tokens table** — `push_tokens (user_id, tenant_id, token, platform)`

### Monitoring & Security
- ☐ **Sentry** — install in Next.js + future Expo app, configure per-tenant error grouping
- ☐ **Super-admin health dashboard** — `/dashboard/admin/health` (queue depth, error rate, AI usage per tenant)
- ☐ **Per-tenant request rate limiting** — all API routes (not just AI)
- ☐ **Document virus scan** — ClamAV or Cloudflare WAF on upload
- ☐ **Signed URL TTL** — reduce document links from 1hr → 15min for sensitive files
- ☐ **Tenant isolation test suite** — automated tests verifying RLS never leaks
- ☐ **Penetration test** — schedule for 1,000-tenant milestone
- ☐ **OWASP headers** — add to all responses
- ☐ **Brute force protection** — on auth endpoints

### Expo App Setup
- ☐ Create `expo-app/` directory at project root
- ☐ Init Expo SDK 52 with Expo Router 4
- ☐ `app.json`: name, bundle IDs (`co.adminos.app`), icons, splash
- ☐ Shared packages: `packages/shared/` (types, supabase client, api utils)
- ☐ Install all Expo dependencies (camera, location, biometric, notifications, file-system, etc.)
- ☐ Configure EAS Build for iOS + Android
- ☐ Expo web output (PWA for employees without the app)
- ☐ Push notification infrastructure (Expo Push + Supabase edge function)
- ☐ Deep linking (`adminos.co.za/app` → opens app if installed)
- ☐ OTA updates (`expo-updates`)

---

## PHASE 1 — Employee OS

### API Routes
- ✅ `GET/POST /api/staff` — staff management
- ✅ `GET/POST /api/staff/clock` — clock in/out with GPS
- ✅ `GET/POST /api/expenses` — expense claims
- ✅ `PATCH /api/expenses/[id]/approve`
- ✅ `GET/POST /api/shifts` — roster management
- ✅ `GET/POST /api/announcements`
- ✅ `POST /api/announcements/[id]/read`
- ✅ `GET/POST /api/disciplinary` — IR log
- ✅ `GET/POST /api/performance-reviews`
- ✅ `POST /api/push/register`
- ✅ `POST /api/push/send`
- ✅ `GET/PATCH /api/staff/my-profile` — staff member's own profile
- ✅ `GET /api/staff/[id]/payslips` — payslips list for a staff member
- ✅ `GET/POST /api/staff/[id]/documents` — personal documents per staff member
- ✅ `POST /api/payroll/[id]/generate-payslips` — batch PDF generation
- ✅ `POST /api/payroll/[id]/distribute` — distribute payslips route

### Dashboard Pages (Next.js)
- ✅ `/dashboard/staff`
- ✅ `/dashboard/team` — team overview (staff + shifts + leave at a glance)
- ✅ `/dashboard/expenses` — expense claim approval queue
- ✅ `/dashboard/announcements` — create and manage announcements
- ✅ `/dashboard/ir-log` — disciplinary records management

### Expo Screens (My Admin)
- ☐ My Admin home screen
- ☐ Clock in/out (GPS map, one big button)
- ☐ My leave (apply, calendar, balance)
- ☐ My tasks
- ☐ My expenses (photo capture → submit)
- ☐ My pay (payslip viewer)
- ☐ My docs
- ☐ My training (lesson player)
- ☐ Company handbook (searchable)
- ☐ Team directory

---

## PHASE 2 — Business Health & Daily Intelligence

### API Routes
- ✅ `GET /api/health-score` — health score endpoint
- ✅ `GET /api/cron/health-score` — weekly recalculation cron
- ✅ `GET /api/cron/calculate-benchmarks`
- ✅ `GET /api/benchmarks/[businessType]`
- ✅ `lib/intelligence/healthScore.ts`

### Dashboard Pages
- ✅ `/dashboard/health` — health score page with dimension drilldowns + benchmark comparison

### Inngest Functions
- ✅ `healthScore.ts` — weekly recalculation

---

## PHASE 3 — Business Academy

### API Routes
- ✅ `POST /api/agents/langa` — streaming Langa chat (model-tiered)
- ✅ Academy API routes (progress, lessons, streaks, achievements, certificates)
- ✅ `lib/academy/knowledgeGraph.ts`
- ✅ `lib/academy/checkAchievements.ts`

### Content (Database seeding)
- ✅ Academy modules table (6 foundation modules seeded)
- ✅ Achievements table (seeded)
- ✅ Contextual triggers: base seed in DB
- ☐ **Foundation Level lesson content** — write actual lesson body (30 lessons across 6 modules)
- ☐ **All 30+ contextual triggers** — verify every event type is wired in `knowledgeGraph.ts`
- ☐ Achievement check: wire to fire after every relevant business event (invoice sent, staff added, etc.)
- ☐ Certificate PDF generation with QR verification code
- ☐ 10% billing discount on Foundation certificate completion

### Dashboard Pages
- ✅ `/dashboard/langa` — dedicated Langa mentor chat page
- ☐ Academy progress page

### Inngest Functions
- ✅ `streakChecker.ts`
- ✅ `contextualTrigger.ts` — route business events to lessons/coaching cards
- ✅ `formalizationNudge.ts` — nudge informal businesses through pathway
- ✅ `achievementChecker.ts` — event-driven (currently only manual calls)

---

## PHASE 4 — Indaba Framework Library

### Content
- ✅ 119 framework entries seeded
- ☐ **~81 more entries** to reach 200+ target (see MASTER_ROADMAP for full book list)
- ☐ **Book in Action: 20 interactive exercises** — E-Myth, Profit First, Five Dysfunctions, etc.
- ☐ **Daily mental model system** — 365 entries (one per day, matched to business events)
- ☐ **Momentum Level Content** — Modules 7–11 (5 modules × lessons)

---

## PHASE 5 — Financial Features

### API Routes
- ✅ `GET/POST /api/payroll/run`
- ✅ `GET /api/payroll/payslip/[id]` — HTML payslip with download option
- ✅ `GET /api/payroll/emp201` — EMP201 pre-population
- ✅ `GET/POST /api/cashflow`
- ✅ `GET/POST /api/nps`
- ✅ `GET/POST /api/profit-first`
- ✅ `GET/POST /api/invoices` + `[id]`
- ✅ `lib/payroll/calculate.ts`
- ✅ `lib/intelligence/cashflowForecast.ts`
- ☐ **Ozow integration** — `lib/payments/ozow.ts` + embedded payment link per invoice
- ☐ **SnapScan integration** — `lib/payments/snapscan.ts`
- ☐ **Payment webhook** — Ozow/SnapScan → auto-mark invoice paid → stop Chase → send receipt
- ✅ `GET/POST /api/loyalty` — loyalty programme endpoints
- ☐ IRP5 tracking endpoint (annual reconciliation data)

### Dashboard Pages
- ✅ `/dashboard/payroll` — payroll management
- ✅ `/dashboard/cashflow` — 90-day forecast chart
- ☐ `/dashboard/settings/profit-first` — guided 5-account setup
- ☐ `/dashboard/nps` — NPS trend line + segmentation
- ☐ `/dashboard/loyalty` — loyalty programme configuration

### Inngest Functions
- ✅ `payrollReminder.ts`
- ✅ `npsReminder.ts`
- ✅ `payslipDistribution.ts`
- ✅ `cashflowForecast.ts` (Inngest version — weekly trigger)
- ✅ `loyaltyExpiry.ts` — points expiry at year end
- ✅ `bookingReminder.ts` — 24-hour booking reminder

---

## PHASE 6 — Operations Suite

### API Routes
- ✅ `GET/POST /api/tasks` + `[id]`
- ✅ `GET/POST /api/sops` + `[id]`
- ✅ `GET/POST /api/inventory` + `/transactions`
- ✅ `GET/POST /api/bookings` + `[id]` + `/services`
- ✅ `GET/POST /api/contracts` + `[id]`
- ✅ `GET/POST /api/suppliers`
- ✅ `GET/POST /api/projects` + `[id]`
- ✅ Task comments API — `GET/POST /api/tasks/[id]/comments`
- ✅ Public booking URL — `/api/book/[slug]` (public, no auth)
- ✅ Contract signature capture — `POST /api/contracts/[id]/sign` (tokenized, no auth)

### Dashboard Pages
- ✅ `/dashboard/tasks` — kanban board + list view
- ✅ `/dashboard/handbook` — SOP management (acknowledgement tracking)
- ✅ `/dashboard/inventory` — product catalogue + stock levels
- ✅ `/dashboard/bookings` — calendar + booking management
- ✅ `/dashboard/contracts` — contract management + eSignature UI
- ☐ Public booking page `/book/[tenant-slug]`
- ☐ eSignature page `/sign/[token]` (mobile-optimised)
- ☐ Client portal: project status view

### Inngest
- ✅ `sopAcknowledgement.ts` — remind unacknowledged staff weekly

---

## PHASE 7 — Ubuntu & Community

### API Routes
- ✅ `GET/POST /api/stokvel` + `[id]`
- ✅ `GET/POST /api/community`
- ✅ `GET/POST /api/mentorship` + `[id]`
- ✅ `GET/POST /api/formalization`

### Dashboard Pages
- ✅ `/dashboard/stokvel` — stokvel group management + member tracking
- ✅ `/dashboard/community` — peer network board (post, reply, supplier reviews)
- ☐ `/dashboard/compliance/bbbbee` — B-BBEE scorecard + gap analysis
- ☐ Informal-to-formal wizard UI (7-step)
- ☐ B-BBEE auto-calculation (from staff demographics + training + supplier data)
- ☐ Stokvel treasurer's monthly PDF report

---

## PHASE 8 — Compliance Automation

### API Routes
- ✅ `GET/POST /api/compliance`
- ✅ `GET/POST /api/licenses`
- ✅ `GET/POST /api/safety`
- ✅ `GET /api/ee/report` — EEA2 HTML report with `?download=true`

### Content & Seeding
- ☐ **Industry-specific compliance seeds** — HPCSA (clinics), DBE (schools), PPRA (property), NPO annual (NGOs)
- ☐ **`seed_compliance_calendar()`** — pre-load full SA compliance calendar for all new tenants on signup
- ☐ EEA4 form generation (we have EEA2 only)
- ☐ Designated employer threshold check UI (50+ employees OR R2M+ turnover)

---

## PHASE 9 — Mastery/Legacy Academy + AI Intelligence

### Content
- ☐ Mastery Level: Module 12 — Strategy Is a Choice
- ☐ Mastery Level: Module 13 — Financial Sophistication
- ☐ Mastery Level: Module 14 — Building the Right Team
- ☐ Mastery Level: Module 15 — Planning Beyond Tomorrow
- ☐ Legacy Level: Module 16 — Ubuntu in Your Business
- ☐ Legacy Level: Module 17 — Giving Back Through the Platform

### API Routes
- ✅ `GET /api/valuation`
- ✅ `lib/intelligence/valuation.ts`
- ✅ `lib/intelligence/coaching.ts`
- ✅ `GET /api/coaching` — contextual pre-action coaching cards

### Dashboard Pages
- ✅ `/dashboard/valuation` — valuation page with 7 value drivers
- ✅ `/dashboard/board-pack` — view generated board packs

### Features
- ☐ Board pack PDF with charts (currently generates JSON data, no PDF render)
- ☐ **Twilio voice intelligence** — call transcription + AI summary + CRM auto-update
- ☐ AI receptionist mode (answers calls, qualifies, routes)
- ☐ ACBO (African Certified Business Operator) certificate flow

### Inngest
- ✅ `valuationSnapshot.ts`
- ✅ `boardPack.ts`

---

## PHASE 10 — Growth & Distribution

### API Routes
- ✅ `GET/POST /api/social` — social accounts management
- ✅ `GET /api/webhook/social` — Facebook/Instagram webhook (verify + receive)
- ✅ `GET/POST /api/widget/[tenantId]/script` — chat widget JS
- ✅ `GET/POST /api/widget/[tenantId]/message` — widget message handler
- ✅ `GET/POST /api/branches`
- ✅ `GET/POST /api/kb` + `[id]`
- ☐ Google My Business reviews polling
- ☐ Reply back to social platforms (Facebook, Instagram) from AdminOS
- ☐ `/api/reseller/*` — reseller provisioning routes
- ☐ Public KB URL — `/kb/[tenant-slug]/[article-slug]` (no auth)

### Dashboard Pages
- ✅ `/dashboard/knowledge-base` — article management
- ☐ `/app/reseller/` — white-label reseller console (separate layout)
- ☐ Multi-entity consolidated analytics rollup (group view)

### Inngest
- ✅ `socialSync.ts` — hourly poll (Facebook, Instagram, Google My Business)
- ✅ `benchmarkCalculate.ts` — weekly anonymous benchmark aggregation

---

## PHASE 11 — Pricing & Monetisation

### API Routes
- ✅ Billing checkout + PayFast ITN
- ✅ Plan gates in `lib/billing/planGates.ts`
- ✅ Add-on system (`addon_subscriptions` table)
- ✅ Special pricing programmes (NGO, women-owned, etc.)
- ✅ `GET /api/admin/impact`
- ☐ **Annual billing option** — 2 months free pricing tier
- ☐ Pro-rated billing on mid-cycle add-on activation
- ☐ Add-on expiry management (auto-deactivate at addon_expires_at)

### Dashboard Pages
- ☐ Special pricing verification UIs (upload NGO cert, women-owned cert, etc.)
- ☐ `/impact` — public impact page (shareable for press/investors)
- ☐ Add-on in-app activation UI (one-click buy in settings/billing)

### Inngest
- ✅ `impactSnapshot.ts`

---

## EXPO APP — All Screens

### Auth Screens
- ☐ Splash screen (animated logo)
- ☐ Login (email/password + biometric after first login)
- ☐ Signup (simplified mobile)
- ☐ Forgot password

### Owner Screens
- ☐ Home — health score ring, today's KPIs, Langa greeting
- ☐ Inbox — conversations (WhatsApp + social)
- ☐ Quick invoice — fast creation
- ☐ Langa — full chat interface

### Employee Screens (My Admin tab)
- ☐ My Admin home
- ☐ Clock in/out (GPS, one big button)
- ☐ My leave
- ☐ My tasks
- ☐ My expenses (photo capture → submit)
- ☐ My pay (payslip viewer)
- ☐ My docs
- ☐ My training (lesson player)
- ☐ Company handbook
- ☐ Team directory

### Shared Screens
- ☐ Notifications centre
- ☐ Profile settings
- ☐ Help / Contact

### Native Features
- ☐ Push notifications (Expo Notifications)
- ☐ Camera (expense receipts, document scan, profile photo)
- ☐ GPS/Location (clock in/out for field agents)
- ☐ Biometric auth (Face ID / fingerprint)
- ☐ File download (payslip PDF)
- ☐ Deep links (notification → specific screen)
- ☐ Offline mode (last data accessible, queue actions for sync)
- ☐ Background sync (process queued actions on reconnect)

---

## REALTIME SUBSCRIPTIONS (Add to Supabase publication)

- ☐ `tasks`
- ☐ `announcements`
- ☐ `bookings`
- ☐ `clock_events`
- ☐ `business_health_snapshots`
- ☐ `academy_progress`
- ☐ `user_achievements`
- ☐ `nps_surveys`
- ☐ `payroll_runs`

---

## SUMMARY COUNTS

| Area | Done | Remaining |
|------|------|-----------|
| API routes | ~95 | ~20 |
| Inngest functions | 16 | 8 |
| lib/ utilities | 10+ | 0 |
| Dashboard pages (Next.js) | ~20 | ~25 |
| DB migrations applied | 29 | 0 |
| Framework library entries | 119 | ~81 |
| Academy lesson content | 0/30 | 30 |
| Mastery/Legacy modules | 0/6 | 6 |
| Expo app | 0% | 100% |
| Sentry | 0% | 100% |
| Ozow/SnapScan | 0% | 100% |
| White-label reseller | 0% | 100% |
| AI Voice (Twilio) | 0% | 100% |

---

*Mirembe Muse (Pty) Ltd · AdminOS · Last updated 2026-06-12*
