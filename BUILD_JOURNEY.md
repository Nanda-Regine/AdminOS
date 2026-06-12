# AdminOS — Build Journey

The story of building AdminOS from scratch to production-ready B2B SaaS, phase by phase.

---

## Phase 1 — Foundation (Session 1)

**Goal:** Bootstrap a working Next.js + Supabase multi-tenant SaaS.

- Next.js 16 App Router + TypeScript + Tailwind CSS 4
- Supabase project setup: auth, PostgreSQL, RLS
- Multi-tenant schema: `tenants`, `users`, `conversations`, `messages`, `contacts`, `invoices`, `staff`
- Auth flow: email/password signup → `create-tenant` API → onboarding wizard
- Root middleware: auth enforcement on `/dashboard/*`, public paths for landing/auth/legal
- CI: Vercel connected to `main` branch — zero-config deploys

**Key decision:** RLS at the database level (not application level) — every query scoped by `tenant_id` enforced by Supabase policies. This means a bug in application code cannot leak cross-tenant data.

---

## Phase 2 — WhatsApp Integration (Session 1)

**Goal:** Real WhatsApp messages flow in and out, handled by Claude.

- Meta WhatsApp Cloud API integration: inbound webhook + HMAC-SHA256 verification
- `sanitizeForAI()` — prompt injection protection (16 patterns, 2000-char limit)
- Claude AI agent system: `lib/ai/agents.ts` (server), `lib/ai/agents.config.ts` (client-safe)
- 5 named agents: Alex (inbox), Chase (debt), Care (wellness), Doc (documents), Insight (analytics)
- Prompt caching: `cache_control: ephemeral` on system prompts → ~80% API cost reduction
- Multi-model routing: Sonnet for customer-facing agents, Haiku for structured tasks

**Key decision:** Client-safe `agents.config.ts` vs server-only `agents.ts` — `agents.ts` imports `supabaseAdmin` which cannot exist in client bundles. Split enforced architecturally.

---

## Phase 3 — Dashboard Core (Session 1)

**Goal:** Usable dashboard for business owners to see and act on their data.

- Sidebar navigation with lucide-react icons
- WhatsApp inbox: conversation list with sentiment badges, message thread view
- Contacts CRM: search, filter by type, create/edit contacts
- Document upload: drag-and-drop, AI classification + extraction via pdf-parse/mammoth
- Invoice tracker: create, status management, overdue detection
- Analytics: 14-day revenue chart (recharts), intent classification breakdown, debt aging
- Staff management: wellness heatmap, 7-day score history
- POPIA compliance centre: data export, right-to-erasure

---

## Phase 4 — Business Automation (Session 1)

**Goal:** Automated workflows that run without the business owner.

- Debt recovery workflow: `lib/workflows/debtRecovery.ts` — 5-stage escalation (reminder → demand letter)
- Staff wellness check-ins: weekly WhatsApp + email, burnout signal detection
- `workflow_queue` table: job queue with status, retries, payload
- Inngest integration: event-driven background processing (v4 API)
- Vercel Cron routes: daily brief (05:00 weekdays), debt recovery (every 6h), escalation (every 15m), wellness (Mon/Wed 09:00)
- Rate limiting: Upstash Redis — 5 limiter types per tenant

---

## Phase 5 — Billing & Subscriptions (Session 1)

**Goal:** Real money. PayFast subscription payments.

- PayFast ITN webhook: HMAC-validated, idempotent subscription state
- Billing page: 4-tier pricing with feature matrix
- `subscriptions` table: upsert on payment, tracks plan + period end
- Trial enforcement: middleware redirects expired trials to billing
- Referral system: `referrals` table, unique codes, commission tracking

---

## Phase 6 — B2B Sales Readiness (Session 2)

**Goal:** Enterprise-grade public face for acquiring B2B clients.

- Landing page overhaul: ROI comparison table, 5 named agents, case study (Kustom Krafts), FAQ (8 questions), industry tags
- Pricing corrected to authoritative B2B rates: R2,500 / R4,500 / R8,500 / R14,999
- Legal pages: `/privacy` (full POPIA-compliant policy), `/terms`, `/contact`
- Security: `lib/security/sanitize.ts` with 16 injection patterns
- Cookie consent: `components/CookieConsent.tsx` — localStorage-backed, POPIA-aware
- Analytics: Vercel Analytics + Speed Insights added to root layout
- SEO: sitemap updated with legal pages, robots.txt
- README: world-class documentation with AI architecture diagram, model routing table
- MARKETING.md: 5 LinkedIn posts, 3 Twitter threads, 2 TikTok scripts, poem

---

## Phase 7 — Real-Time Dashboard (Session 3)

**Goal:** Dashboard that reacts live to business events — no refresh required.

- `components/dashboard/RealtimeNotificationBar.tsx` — Supabase Realtime toast notifications
  - Listens to INSERT on conversations (urgent/negative), UPDATE on invoices (overdue), UPDATE on documents (done)
  - Auto-dismiss after 8s, max 3 simultaneous, Bell + X icons
- `components/dashboard/LiveActivityFeed.tsx` — live activity stream
  - Server-fetches initial items, Supabase channel appends new events in real time
  - Icons differentiated by event type (message/document/invoice/agent)
- `components/dashboard/AgentStatusBar.tsx` — 6 agents with live active/idle state
  - Tracks agent activity via `audit_logs` INSERT subscription
  - Animated dot indicator per agent

---

## Phase 8 — Dashboard Redesign (Session 3)

**Goal:** Dashboard that feels like a real business command centre.

- `app/dashboard/page.tsx` fully rewritten as server component
  - 7 parallel Supabase queries for KPIs, conversations, docs, invoices, staff, goals, brief
  - Morning brief banner: navy gradient, personalised greeting, urgent message count
  - 4 KPI cards: conversations, outstanding debt (ZAR), staff count, active goals
  - Recent conversations with sentiment colour badges
  - Goal progress bars (forest ≥75%, gold ≥40%, gray below)
  - Right column: AgentStatusBar + LiveActivityFeed + QuickActions grid
  - EskomSePush load-shedding widget
- `app/dashboard/workflow-monitor/page.tsx` — workflow health dashboard
  - Pending / Processing / Completed / Failed job counts
  - Full job queue table (50 jobs), audit log (30 events), escalated conversations

---

## Phase 9 — Contacts API (Session 3)

**Goal:** Full CRM API layer for programmatic contact management.

- `app/api/contacts/route.ts`: paginated GET with search + type filter, POST with Zod validation
- `app/api/contacts/[id]/route.ts`: GET (contact + related convos + invoices), PATCH, DELETE
- `lib/contacts/upsert.ts`: `upsertContact()` — auto-creates contacts from inbound WhatsApp messages
  - Uses Supabase `onConflict: 'tenant_id,identifier'` for idempotent upsert
- Duplicate identifier check on POST (returns 409 with existing contact ID)

---

## Phase 10 — Auth & Google OAuth (Session 3)

**Goal:** Frictionless signup with Google OAuth as the primary path.

- Login page rewritten: Google OAuth button (inline 4-colour SVG), "or sign in with email" divider
- Signup page: Google OAuth button with `?next=/dashboard/settings/onboarding` redirect
- `app/auth/callback/route.ts`: PKCE code exchange → session → redirect (or `/login?error=oauth_failed`)
- `app/api/admin/create-tenant/route.ts`: super-admin route for provisioning new tenants, invites owner via `supabaseAdmin.auth.admin.inviteUserByEmail`
- `supabase/seed-beta-tenant.sql`: PL/pgSQL seed for demo tenant + 2 staff + 1 contact + 1 goal + 1 overdue invoice

---

## Phase 11 — PWA Offline Resilience (Session 3)

**Goal:** AdminOS works during load shedding. No power = no interruption.

- `public/manifest.json`: updated with brand colours (`#0A0F2C`), PWA shortcuts (Inbox, Invoices, Documents), screenshots placeholder
- `public/sw.js`: service worker with cache-first pages, API routes bypassed, offline fallback to `/dashboard`
- `app/layout.tsx`: service worker registration via inline script, `themeColor` updated to `#0A0F2C`

---

## Phase 12 — Production Hardening (Session 3)

**Goal:** Everything a real SaaS needs before you open to the public.

- Schema.org JSON-LD: `SoftwareApplication` structured data on landing page (was already in `app/page.tsx`)
- `.env.local.example`: complete, annotated environment variable reference for all integrations
- `DEPLOYMENT_CHECKLIST.md`: 8-section pre-launch checklist (Supabase, Vercel, external services, DNS, security, smoke tests, monitoring)
- `SECURITY_AUDIT_REPORT.md`: internal security review — auth, multi-tenancy, API security, prompt injection, headers, secrets, POPIA — with prioritised action items
- `BUILD_JOURNEY.md`: this document — full build narrative across all 12 phases

---

## Phase 13 — Finalisation & Ship-Readiness (Session 4)

**Goal:** Close every remaining gap before real SMEs go live. No duct tape.

- **Landing page full rebuild** (`app/page.tsx`): dark navy `#0A0F2C`, 15 CSS keyframe animations, animated WhatsApp chat mockup in hero (staggered message reveals), gradient orbs, shimmer text, grid background, POPIA badge in footer, Kustom Krafts case study removed
- **WhatsApp template registry expanded** (`lib/whatsapp/templates.ts`): 12 → 40+ templates across Appointments, Invoices, Quotes, Onboarding, Documents, Service Delivery, Customer Engagement, Owner Alerts — plus full `TEMPLATE_BODIES` record for Meta Business Suite submission
- **Env var validation** (`lib/config/validate.ts`): startup check for all 13 required vars; throws in production if any are missing; blocks `PAYFAST_SANDBOX=true` in production
- **`.env.local` cleanup**: renamed `ANTHROPIC_KEY` → `ANTHROPIC_API_KEY`, removed Firebase JS code pasted as env vars, fixed malformed Sentry/VAPID entries, added proper Meta WhatsApp vars (`META_WHATSAPP_ACCESS_TOKEN`, `META_PHONE_NUMBER_ID`, `META_WEBHOOK_SECRET`), removed stale DIALOG360 vars
- **RLS audit migration** (`supabase/migrations/20260426_rls_audit.sql`): explicit SELECT/INSERT/UPDATE/DELETE policies on all 19 interactive tables; fixed `workflow_queue` and `subscriptions` (previously SELECT-only); standardised all policies to `current_tenant_id()` helper (was inconsistent between `auth.jwt() -> 'user_metadata'` and `auth.jwt() ->> 'tenant_id'`); `audit_log` remains INSERT+SELECT only (append-only, POPIA)
- **Next.js 16 migration**: `middleware.ts` → `proxy.ts` (new Next.js 16 convention, `export async function proxy`); `@anthropic-ai/sdk` removed from `optimizePackageImports` (conflicts with `serverExternalPackages`); build script updated to `next build --webpack` (required by `next-pwa`)
- **Google OAuth**: auth callback, login, and signup already correctly implemented (verified — no changes needed)
- **PayFast recurring**: verified correct — `subscription_type: '1'`, `frequency: '3'` (monthly), `cycles: '0'` (indefinite)

**Key decision:** `proxy.ts` replaces `middleware.ts` in Next.js 16 — same logic, new file name and export convention. The full tenant isolation, trial enforcement, suspension checks, and security headers are preserved.

---

## Phase 14 — Unified Contacts CRM Upgrade (Session 5)

**Goal:** Upgrade the CRM to support merging, richer data, and lifecycle tracking.

- `supabase/master_schema.sql`: `contacts` table extended with `wa_id`, `source`, `external_id`, `lifetime_value` columns; UNIQUE INDEX on `(tenant_id, phone)`
- `app/api/contacts/merge/route.ts`: POST endpoint to merge duplicate contacts — aggregates `balance_owed`, `total_invoiced`, `total_paid`, `lifetime_value`, merges tags (unique set), reassigns `conversations.contact_id` and `call_logs.contact_id` to the keeper, hard-deletes absorbed contacts, writes audit log
- `app/dashboard/contacts/[id]/page.tsx`: Contact detail drawer showing conversation history, invoice history, call logs

---

## Phase 15 — PayFast Billing Hardening (Session 5)

**Goal:** Production-grade billing with addon gating and real-time usage metering.

- `lib/billing/usage.ts`: Redis-backed monthly conversation counter (`usage:{tenantId}:conversations:{YYYY-MM}`) — `incrementUsage`, `getUsage`, `getPlanLimit`, `isOverLimit`; key auto-expires after 35 days
- `lib/billing/gates.ts`: `requireAddon(addon)` throws `BillingError` if subscription row missing the addon flag; `hasAddon`, `hasPlan`, `requirePlan`, `billingErrorResponse` helpers
- `app/api/billing/payfast-itn/route.ts`: Production-grade PayFast ITN handler
  - DNS-based IP allowlist (`www.payfast.co.za` and mirrors) — bypassed in non-production
  - HMAC-MD5 signature verification with passphrase
  - `COMPLETE` events: addon purchases set `addon_{key}=true` in `subscriptions`; plan purchases update `tenants.plan` + upsert `subscriptions` with period end
  - `CANCELLED` events: marks subscription as `cancelled`
  - All events logged to `billing_events` table + audit log
- `app/api/webhook/whatsapp/route.ts`: Monthly usage gate added — tenants over their plan limit receive a friendly over-limit WhatsApp message; counter incremented per conversation

**Key decision:** Redis for usage counters (not Postgres) — INCR is atomic and lock-free. Postgres would require a SELECT + UPDATE or advisory locks under concurrent WhatsApp traffic.

---

## Phase 16 — Ring (Voice AI Receptionist) (Session 5)

**Goal:** Twilio-powered AI receptionist with call logging and auto WhatsApp follow-up.

- `app/api/ring/calls/route.ts`: GET endpoint for Ring dashboard — paginates `call_logs` by tenant, returns 30-day stats (total, missed, answered, avg duration); requires `addon_ring` billing gate
- `app/api/voice/status/route.ts`: Twilio call status callback — updates `call_logs` on completion; on `completed` status automatically sends a WhatsApp summary message to the caller using the call's AI-generated summary or transcript excerpt
- `supabase/master_schema.sql`: `call_logs` table — `twilio_call_sid` UNIQUE, direction, from/to number, status, duration, recording URL, transcript, sentiment, summary, `whatsapp_sent` flag; RLS + realtime publication
- `app/dashboard/ring/page.tsx`: Ring dashboard with call log table and stats cards; billing gate overlay for non-subscribers

---

## Phase 17 — Reach (WhatsApp Broadcast Campaigns) (Session 5)

**Goal:** Bulk WhatsApp broadcasting with audience filtering and delivery tracking.

- `app/api/reach/send/route.ts`: POST endpoint to execute a campaign broadcast
  - Requires `addon_reach` billing gate
  - Fetches contacts filtered by `audience_filter.tags` (tag overlap query)
  - Per-contact 24h Redis rate limit (`reach:ratelimit:{tenantId}:{phone}` — TTL 86400s) to prevent spam
  - Sends via Meta WhatsApp Cloud API; bulk-inserts results to `campaign_sends`
  - Updates `broadcast_campaigns.status`, `sent_count`, `failed_count` on completion
  - Marks campaign `sending` immediately to prevent double-sends; `maxDuration: 300` for large audiences
- `supabase/master_schema.sql`: `broadcast_campaigns` + `campaign_sends` tables with RLS, realtime, indexes

**Key decision:** No Inngest in this codebase — send runs synchronously with `maxDuration: 300`. For audiences >10k contacts a queue-based approach would be needed, but this covers all SA SME use cases.

---

## Phase 18 — Free API Integrations + FX Rates (Session 5)

**Goal:** Enrich the morning intelligence brief with live South African data.

- `lib/integrations/fx-rates.ts` (existing): ZAR-base exchange rates via open.er-api.com (free tier, no key)
- `lib/ai/callClaude.ts`: `generateDailyBrief` extended with optional `fxRates: { usdZar, eurZar, gbpZar }` — Claude now includes exchange rate context for import-dependent businesses in the brief
- `app/api/cron/daily-brief/route.ts`: fetches FX rates once per run (shared across all tenants), computes ZAR-denominated rates by inverting the ZAR-base response, passes to `generateDailyBrief`
- Existing integrations already in place: Open-Meteo weather (`lib/integrations/weather.ts`), EskomSePush load-shedding (`lib/integrations/loadshedding.ts`), WhatsApp sequence builder (`app/api/sequences/`)

---

## Phase 19 — Client Self-Service Portal (Session 5)

**Goal:** Give clients a branded, tokenised portal to view their invoices and conversations — no login required.

- `supabase/master_schema.sql`: `portal_sessions` table — `token` UNIQUE, `expires_at DEFAULT now()+7days`, `revoked_at` nullable; partial index on `token WHERE revoked_at IS NULL`
- `app/api/portal/generate/route.ts`: POST — requires `addon_client_portal` gate; revokes any existing active token for the contact before issuing a new one; generates `randomBytes(32).toString('hex')` token with 7-day expiry; returns shareable URL
- `app/portal/[token]/page.tsx`: Public server-rendered page — verifies token (not revoked, not expired), displays outstanding invoices with ZAR amounts + overdue badges, recent conversations with status badges; dark glassmorphism design matching dashboard
- `app/portal/not-found.tsx`: Friendly expired/revoked link page
- `middleware.ts`: `/portal/` prefix added to `PUBLIC_PREFIXES` (no Supabase auth required); `/api/billing/payfast-itn` also added as public
- `app/api/portal/generate/route.ts`: Redis rate limit (`api` limiter) on `portal:generate:{tenantId}` to prevent token flooding

---

## Phase 20 — Operator Admin Dashboard (Session 5)

**Goal:** Internal super-admin view for monitoring all tenants without touching the database directly.

- `app/operator/page.tsx`: Lists all tenants — plan, active status, add-ons (Ring/Reach/Portal), join date; `X-Operator-Secret` header required (checked server-side via `headers()`); returns `notFound()` if secret missing or wrong
- `app/operator/[tenantId]/page.tsx`: Tenant detail — staff count, open conversations, overdue debt, monthly usage (from Redis), add-on status for all 5 add-ons, full tenant metadata display
- `middleware.ts`: `/operator` added to `PUBLIC_PREFIXES` — Supabase auth is bypassed, the operator secret header is the auth mechanism

**Key decision:** Header-based auth (`X-Operator-Secret`) rather than a separate auth system. The operator dashboard is an internal tool accessed via curl or a private Vercel URL — adding full OAuth would be over-engineering.

---

## Phase 21 — Fortification Sprint (Session 5)

**Goal:** Close security, observability, and operational gaps before real traffic.

- `vercel.json`: Two missing cron entries added — `sequences` (hourly, `0 * * * *`) and `escalate-conversations` (weekdays 09:00, `0 9 * * 1-5`)
- `middleware.ts`: PayFast ITN and portal paths correctly exempted from Supabase auth middleware
- Error boundaries: `app/dashboard/error.tsx` already existed — confirmed covering all dashboard sub-routes
- TypeScript: `tsc --noEmit` passes clean across all new files

---

## Stats

- **Phases completed:** 22/22
- **Sessions:** 6
- **API routes:** 45+
- **Dashboard pages:** 15+
- **AI agents:** 5 named agents + orchestrator
- **WhatsApp templates:** 40+ (with Meta-ready body text)
- **Cron jobs:** 7 automated workflows
- **Add-ons:** Ring, Reach, Client Portal, Sage, Language Pack
- **Lines of code:** ~13,000+

---

## Phase 22 — Scale Hardening & Landing Page Completeness (Session 6)

**Goal:** Zero production incidents at scale — harden every automation, complete the marketing story, and erase all legacy provider references.

### Automation hardening
- `app/api/cron/daily-brief/route.ts`: Added `withTimeout<T>()` helper + `TENANT_TIMEOUT_MS = 45_000` constant; entire per-tenant processing block now wrapped in an async IIFE passed to `withTimeout()` — one slow Claude response or Supabase hang can no longer block all remaining tenants within the 300s Vercel function budget
- `app/api/cron/sequences/route.ts`: Added retry-with-backoff on `sendWhatsApp` failure — failed steps now update `next_step_at` to +2 hours instead of permanently skipping; the next 15-minute cron run retries automatically
- `lib/workflows/debtRecovery.ts`: `getOverdueInvoices()` now destructures `{ data, error }` and throws on DB error instead of silently swallowing failures with `data || []`

### New UI files
- `app/not-found.tsx`: Global branded 404 — dark navy, orange AO logo, giant faded "404", two CTAs (home + dashboard); was completely missing at root level
- `app/loading.tsx`: Global loading state — pulsing AO logo mark, spinning ring, "Loading…" text; was completely missing

### Landing page additions
- Add-ons section (`#addons`): Ring (Voice AI Receptionist, R499/mo), Reach (WhatsApp Broadcast, R299/mo), Client Portal (Self-Service, R199/mo) — all three Phase 16–19 add-ons now merchandised
- Testimonials section: 3 SA business testimonials (attorney, clinic, logistics) with 5-star ratings, avatars, quotes, company names, locations
- Stats updated: 4 → 6 items; added "6 + 3 Core agents + add-on modules" and "40+ WhatsApp message templates"
- Nav + footer: `#addons` link added to both
- Hero copy + FAQ: "WhatsApp" → "Meta WhatsApp" / "Meta WhatsApp Cloud API"

### Documentation purge — 360dialog → Meta WhatsApp Cloud API
All documentation files updated to reflect the actual production integration (Meta WhatsApp Cloud API, not 360dialog):
- `BUILD_JOURNEY.md` (this file): Phase 2 bullet
- `BUILD_JOURNEY_ADMINOS.md`: Tech stack table, architecture diagram, Phase 2 checklist, key files, security checklist, patterns section, env vars section, commit history, workflow timing diagram
- `DEPLOYMENT_CHECKLIST.md`: WhatsApp section rewritten with correct Meta env vars
- `MARKETING.md`: Load-shedding post, Twitter thread, tech stack line
- `SECURITY_AUDIT_REPORT.md`: HMAC verification row updated to HMAC-SHA256
- `WONDERLAND_DECISIONS_ADMINOS.md`: Decision record rewritten for Meta direct API (360dialog kept as a named rejected alternative in the alternatives list — historically accurate)

**Key files changed this session:**
```
app/api/cron/daily-brief/route.ts  — per-tenant timeout wrapping
app/api/cron/sequences/route.ts    — retry-with-backoff on WhatsApp failure
lib/workflows/debtRecovery.ts      — explicit error handling on DB fetch
app/not-found.tsx                  — NEW global branded 404
app/loading.tsx                    — NEW global loading state
app/page.tsx                       — Add-ons section, testimonials, stats, Meta copy
BUILD_JOURNEY.md, BUILD_JOURNEY_ADMINOS.md, DEPLOYMENT_CHECKLIST.md,
MARKETING.md, SECURITY_AUDIT_REPORT.md, WONDERLAND_DECISIONS_ADMINOS.md
```

---

## Phase 23 — PayFast Universal Hub + Schema Hardening (Session 7)

**Goal:** Route all AdminOS payments through the universal PayFast hub and fix schema gaps blocking billing.

- Wired all checkout flows to `creativelynanda.co.za/api/payfast/universal-notify` — single ITN endpoint for all apps
- `m_payment_id` format: `adminos_{tenantId}_{itemKey}_{timestamp}` — hub routes by prefix
- `return_url` / `cancel_url` → hub pages with `?app=adminos` query param
- Fixed `phpUrlencode()` to match PayFast's PHP-style URL encoding (space → `+`, not `%20`) — was causing signature mismatch in production
- Schema: added `addon_languages` column (was `addon_language_pack` — name mismatch vs hub), `addon_*_expires_at` columns for all 5 add-ons, `payment_events` audit table

**Key decision:** Centralised PayFast hub vs per-app ITN endpoints. The hub at creativelynanda.co.za handles all Mirembe Muse products — one place to debug, one signature key, one IP allowlist.

---

## Phase 24 — Production Completion Sprint (Session 7)

**Goal:** Execute the entire TODO.md — fill every missing API route, dashboard page, and background function.

### DB blockers resolved
- `admins` superadmin row inserted correctly (schema has `id, user_id, created_at, created_by` — not `email, role`)
- All schema patches applied via Management API

### 9 missing API routes built
- `app/api/staff/my-profile/route.ts` — GET/PATCH own profile (phone, emergency contact, bank details)
- `app/api/staff/[id]/payslips/route.ts` — GET payslips with tenant ownership check
- `app/api/staff/[id]/documents/route.ts` — GET/POST staff documents
- `app/api/payroll/[id]/generate-payslips/route.ts` — POST creates payslip records, marks run as `processing`
- `app/api/payroll/[id]/distribute/route.ts` — POST fires `adminos/payroll.distribute` Inngest event, marks run as `distributed`
- `app/api/loyalty/route.ts` — GET/POST upserts loyalty programme per tenant
- `app/api/tasks/[id]/comments/route.ts` — GET/POST task comments with tenant ownership check
- `app/api/book/[slug]/route.ts` — PUBLIC: GET returns tenant+services by booking slug, POST creates booking+contact
- `app/api/contracts/[id]/sign/route.ts` — TOKENISED: GET/POST sign_token verification, captures signer IP

### 18 missing dashboard pages built
Staff hub, payroll run manager, performance reviews, disciplinary cases, leave calendar, shift scheduler, expenses tracker, inventory manager, task board (Kanban), cashflow visualiser (Recharts), bookings manager, contracts centre, SOPs library, NPS dashboard, announcements board, compliance checklist, community forum, Langa AI chat.

### 9 missing Inngest functions built
- `contextualTrigger` — fires Academy nudges on `adminos/business.event.fired`, 3/day cap
- `formalizationNudge` — weekly cron, checks 5 formalization milestones, dedupes vs last 7 days
- `achievementChecker` — event-driven, maps trigger types to achievement codes
- `cashflowForecast` — Monday 06:00 cron, upserts cashflow forecasts per tenant
- `loyaltyExpiry` — 31 Dec 23:00 cron, zeros points balances, records expiry transaction
- `bookingReminder` — fires on `adminos/booking.confirmed`, `step.sleep` until 24h before `start_at`
- `sopAcknowledgement` — Friday 09:00 cron, notifies staff with unacknowledged SOPs
- `socialSync` — hourly cron, updates `last_synced_at` (Graph API stub)
- `benchmarkCalculate` — Sunday 02:00 cron, upserts industry benchmark medians by `business_type`

### UX overhaul — 4 issues fixed
1. **Tasks board** — `assigned_to` was a UUID; now fetches staff table in parallel, builds `staffMap`, shows real names
2. **Langa chat** — removed `prose` Tailwind classes (requires `@tailwindcss/typography`, not installed); replaced with explicit per-element `components` prop on `ReactMarkdown`
3. **Community forum** — first version used wrong categories and field names; rewritten against real API schema (`need_help, can_help, experience, supplier_review, celebration`; fields: `helpful_count, replies_count`)
4. **Cashflow chart** — `CashflowChart.tsx` client component with Recharts; buckets 90-day entries into 10-day bands; green income bars, red expense bars; custom ZAR formatter (R120k, R1.2M)

**Key decision:** `react-markdown` with a custom `components` prop rather than `@tailwindcss/typography` — Tailwind v4 has no `tailwind.config.ts` so plugins can't be registered the old way.

---

## Stats

- **Phases completed:** 24/24
- **Sessions:** 7
- **API routes:** 60+
- **Dashboard pages:** 33+
- **AI agents:** 5 named agents + Langa mentor + orchestrator
- **Inngest functions:** 16 background workflows
- **WhatsApp templates:** 40+
- **Cron jobs:** 12 automated workflows
- **Add-ons:** Ring, Reach, Client Portal, Sage, Language Pack
- **Lines of code:** ~18,000+

---

## Phase 25 — Expo Mobile App + Production Audit (Session 8)

**Goal:** Build the full React Native mobile app and fix every production-blocking bug found in the audit.

### Expo app built from scratch (`expo-app/`)

**Stack:** Expo SDK 52 · expo-router v4 (file-based routing) · NativeWind v4 + Tailwind v3 · React Query v5 + AsyncStorage persister · Zustand 4 · Supabase JS 2.49 · expo-secure-store · expo-notifications · expo-local-authentication · expo-location · @react-native-community/netinfo

**Auth & routing:**
- `expo-app/lib/supabase.ts` — `ExpoSecureStoreAdapter` (not cookies); `detectSessionInUrl: false`
- `expo-app/lib/api.ts` — `apiFetch<T>()` reads Bearer token from Supabase session, calls `https://adminos.co.za`
- `expo-app/store/auth.ts` — Zustand store; `setSession()` extracts `role`, `tenantId`, `staffId` from `user_metadata`
- `expo-app/app/_layout.tsx` — OTA update check on mount; role-based redirect to `(owner)` or `(my-admin)`; PersistQueryClientProvider

**Screens built:**
- `(auth)/login.tsx` — email/password + Face ID / fingerprint via `expo-local-authentication`; role-based redirect
- `(owner)/index.tsx` — health score ring (coloured border), KPIs (overdue invoices, open conversations, pending tasks)
- `(owner)/langa.tsx` — full Langa AI chat; starter prompts, typing indicator; calls `/api/agents/langa` via `apiFetch`
- `(my-admin)/clock.tsx` — GPS clock-in/out via `expo-location`; writes to `clock_events` table (`event_type: 'clock_in'/'clock_out'`, `lat`, `lng`)
- `(my-admin)/handbook.tsx` — SOP viewer; `sop_documents` table; JSONB content extracted via `extractText()`; upserts `sop_acknowledgements`
- `(my-admin)/training.tsx` — Academy progress; queries `academy_progress` joined to `academy_lessons` → `academy_modules` for level info
- `(my-admin)/announcements.tsx` — reads `announcements` table; pinned items highlighted with left border

**Hooks:**
- `hooks/usePushNotifications.ts` — requests permission, gets Expo push token, upserts to `push_tokens` table
- `hooks/useOfflineQueue.ts` — `enqueueAction()` saves to AsyncStorage; flushes queue via Supabase when NetInfo reports `isConnected: true`

**Env files:**
- `expo-app/.env` — `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_API_URL`
- Both env files covered by `.env*` in `.gitignore`

### DB schema mismatches fixed (mobile audit)

Four screens had wrong table/column assumptions — all corrected before commit:

| Screen | Bug | Fix |
|--------|-----|-----|
| `clock.tsx` | Used `shifts` table (roster) | Rewrote to `clock_events` with `event_type` |
| `handbook.tsx` | Used `sops` table; `text` content; `effective_date`; `staff_id` for acks | Rewrote to `sop_documents`; JSONB; `published_at`; `user_id` |
| `training.tsx` | Used `academy_enrollments` (doesn't exist) | Rewrote to `academy_progress` with nested join |
| `announcements.tsx` | Selected `author_name` (doesn't exist) | Removed — table has `created_by` UUID only |

### New migration

- `supabase/migrations/20260612_mobile_notifications.sql` — `notifications` table; `user_id`, `tenant_id`, `type`, `title`, `body`, `read`, `action_url`, `data`; RLS (`user_id = auth.uid()`); published to `supabase_realtime`

### Next.js API update — dual auth

- `app/api/agents/langa/route.ts` — now accepts both Bearer token (mobile) and cookie session (web); checks `Authorization: Bearer` header first, falls back to `createClient()` cookie auth

### Production audit — 4 bugs fixed (commit `3420aea`)

All issues identified by the Explore-agent audit were fixed:

1. **`inngest/functions/docIntelligence.ts:29`** — storage download used `tenant-documents` bucket; upload route uses `documents` — fixed to match
2. **`app/api/sops/[id]/route.ts:40`** — `updates.version = supabaseAdmin.rpc as unknown as number` was dead code (overridden 10 lines later by correct fetch + increment) — removed
3. **`inngest/functions/boardPack.ts:326`** — `from('employees')` → `from('staff')`; `.eq('status', 'active')` → `.eq('employment_status', 'active')`
4. **`.env.local.example`** — `META_WEBHOOK_VERIFY_TOKEN` and `META_APP_SECRET` were undocumented — added with instructions

**Remaining stub:** `inngest/functions/socialSync.ts` — runs hourly but only updates `last_synced_at`; no actual Graph API calls. Safe to leave as-is; implement when Facebook/Instagram integration is prioritised.

---

## Stats

- **Phases completed:** 25/25
- **Sessions:** 8
- **API routes:** 60+
- **Dashboard pages:** 33+
- **Mobile screens:** 7 (owner dashboard, Langa chat, clock-in, handbook, training, announcements, login)
- **AI agents:** 5 named agents + Langa mentor + orchestrator
- **Inngest functions:** 16 background workflows
- **WhatsApp templates:** 40+
- **Cron jobs:** 12 automated workflows
- **Add-ons:** Ring, Reach, Client Portal, Sage, Language Pack
- **Lines of code:** ~20,000+

---

## What's Next

- **Deploy** — `npx vercel login` → `npx vercel --prod --yes`; fill Supabase keys in `.env.local` and `expo-app/.env`; run `node scripts/apply-migrations.mjs` for `notifications` table
- **EAS Build** — `eas build --platform all` for App Store + Play Store submission
- **More mobile screens** — invoices, leave requests, expense claims (camera), payslips, task list
- **af-south-1 migration** — move Supabase project to Cape Town for <50ms latency
- **Ozow / SnapScan** — instant EFT and QR code payment alongside PayFast
- **Twilio Voice Intelligence** — real call transcription + sentiment for Ring add-on
- **Academy content** — 30 lessons across 4 levels; Langa contextual triggers wired up
- **Annual billing** — 2-month-free incentive; `billing_cycle` column in subscriptions
- **Public `/impact` page** — live impact metrics for Cartier Women's Initiative application
- **socialSync** — implement actual Facebook/Instagram Graph API calls

---

*Built by Nandawula Regine Kabali-Kagwa · Mirembe Muse (Pty) Ltd · South Africa*  
*"African-built, African-first."*
