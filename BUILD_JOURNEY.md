# AdminOS — Build Journey

**Project:** AI-powered hybrid business operating system
**Creator:** Nandawula Regine · Mirembe Muse (Pty) Ltd
**Market:** South African SMEs, NGOs, schools, clinics, government departments
**Tagline:** *"The OS that runs your business while you sleep"*
**Live:** [adminos.co.za](https://adminos.co.za)
**Repo:** [github.com/Nanda-Regine/AdminOS](https://github.com/Nanda-Regine/AdminOS)

---

## The Vision

Africa's businesses run on WhatsApp. Millions of messages land every day — client queries, invoice follow-ups, leave requests, complaints — and behind each one is a human manually responding, copying, chasing, and repeating.

AdminOS was built to fix that. Not as a chatbot. As an operating system — one that handles the full admin layer of a business automatically, connects every tool a business already uses, and gives managers a world-class dashboard with AI as their chief of staff.

---

## Problem Statement

South African SMEs face a unique set of challenges:

- **WhatsApp is the primary business channel** — but there's no infrastructure to automate it professionally
- **Debt recovery is manual** — business owners personally chase every overdue invoice
- **Staff wellness is invisible** — burnout and HR issues surface too late
- **No daily intelligence** — managers make decisions without data
- **Integrations are fragmented** — Gmail, Xero, Google Drive, PayFast all live in silos
- **Load shedding** — any tool must work offline and retry gracefully
- **Language barriers** — 11 official languages, most business software only speaks English

AdminOS was designed to solve all of these at once.

---

## Stack Decisions

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js 14 App Router + TypeScript | Server components, edge functions, file-based routing |
| Database | Supabase (Postgres + RLS + Realtime) | Row-level security for multi-tenancy, realtime push to dashboard |
| Auth | Supabase Auth (JWT) | Native RLS integration, multi-tenant claims |
| AI | Claude API (claude-sonnet-4-6) | Best reasoning, prompt caching = 85% cost reduction |
| Cache | Upstash Redis | Serverless Redis, global edge, zero cold starts |
| Queue | Inngest | Async job processing with automatic retries |
| WhatsApp | 360dialog | Africa-optimised, lower latency than Twilio |
| Email | Resend | Reliable transactional email, great DX |
| Payments | PayFast + Yoco (SA) + Stripe (international) | Cover the full SA market |
| Invoicing | Xero API | SME standard in South Africa |
| Hosting | Vercel | Edge functions, global CDN, native Next.js support |
| PWA | next-pwa + Web Manifest | Installable, offline-capable, load-shedding resilient |

---

## Architecture

```
                    ┌─────────────────────────────────────┐
                    │           ADMINOS PLATFORM          │
                    └─────────────────────────────────────┘

WhatsApp (360dialog)──► /api/webhook/whatsapp
                              │
                              ▼
                    ┌─── WorkflowEngine ───┐
                    │  loadTenantContext   │
                    │  classifyIntent      │◄── Claude API
                    │  checkFAQCache       │◄── Redis
                    │  generateResponse    │◄── Claude API (cached)
                    │  sendWhatsApp        │──► 360dialog
                    │  logToAudit          │──► Supabase
                    │  updateDashboard     │──► Supabase Realtime
                    └──────────────────────┘

Email (Gmail/Outlook)──► /api/webhook/email ──► WorkflowEngine

n8n (file parsing) ──► /api/workflow/file-received
                              │
                              ▼
                    classifyDocument (Claude)
                    ├── strategy → extractGoals → goals table
                    ├── invoice  → extractData  → invoices table
                    ├── hr       → updateStaff  → staff table
                    └── report   → summarise    → dashboard

Vercel Cron ──► /api/cron/daily-brief   (07:00 SAST, weekdays)
            ──► /api/cron/wellness       (08:00 SAST, weekdays)
            ──► /api/cron/debt-recovery  (09:00 SAST, daily)

Dashboard ──► /dashboard          (main overview)
          ──► /dashboard/inbox    (live conversation inbox)
          ──► /dashboard/staff    (leave + wellness)
          ──► /dashboard/invoices (debt register)
          ──► /dashboard/documents(file intelligence)
          ──► /dashboard/calendar (appointments + leave)
          ──► /dashboard/analytics(BI + trends)
          ──► /dashboard/settings (bot training + integrations)
```

---

## Multi-Tenant Architecture

Every business is a **tenant**. Isolation is enforced at the database level via Supabase Row-Level Security — never in application code. This means:

- A bug in the app cannot leak one business's data to another
- Every table has `tenant_id` as a required column
- RLS policies verify `tenant_id = auth.jwt() ->> 'tenant_id'`
- The audit log is append-only — no UPDATE or DELETE permissions granted
- Middleware injects `x-tenant-id` into every authenticated request header

### Tenant Plans

| Plan | Price | Conversations | WhatsApp Numbers |
|---|---|---|---|
| Starter | R799/mo | 500/mo | 1 |
| Business | R2,499/mo | 5,000/mo | 3 |
| Enterprise | R7,999/mo | Unlimited | Unlimited |
| White Label | R14,999/mo | Unlimited | Unlimited |

---

## AI Strategy — Prompt Caching

The most important cost decision in the build: **Claude's prompt caching**.

Every tenant has a `system_prompt_cache` field — a pre-built context string containing:
- Business name, type, language, tone
- FAQs, staff directory, services, policies
- Extracted company goals from uploaded strategy docs
- Active integrations

This prompt is marked `cache_control: { type: 'ephemeral' }` in every Claude API call. Anthropic caches it server-side, and subsequent calls that hit the cache cost 90% less per token.

Result: **85% reduction in AI operating costs** at scale.

The cache refreshes automatically when:
- The tenant updates their business profile
- Their strategy doc is re-uploaded
- The cached prompt is older than 24 hours

---

## Build Phases

### Phase 1 — Foundation
**Goal:** Get the core infrastructure running end-to-end.

- [x] Next.js 14 project with TypeScript + Tailwind CSS
- [x] Supabase project configured with full schema
- [x] Row-Level Security policies on all tables
- [x] Supabase Auth (JWT) with tenant_id in user metadata
- [x] Supabase client (browser), server (SSR), admin (service role)
- [x] TypeScript types generated from database schema
- [x] `.env.local` template with all required environment variables
- [x] Vercel project connected, cron jobs scheduled
- [x] Git repository initialised and pushed to GitHub

**Key files:**
```
supabase/schema.sql        — Full Postgres schema with RLS
types/database.ts          — TypeScript types for all tables
lib/supabase/client.ts     — Browser client (for 'use client' components)
lib/supabase/server.ts     — Server client (for RSC and API routes)
lib/supabase/admin.ts      — Service role client (bypasses RLS for admin ops)
```

---

### Phase 2 — WhatsApp Engine
**Goal:** Receive, process, and respond to WhatsApp messages automatically.

- [x] 360dialog webhook verified via HMAC-SHA256 signature
- [x] Message deduplication via Redis SET NX (atomic, no race conditions)
- [x] Tenant routing by WhatsApp number (WABA ID)
- [x] WorkflowEngine with 7 steps in sequence
- [x] FAQ cache check before any Claude API call (Redis, 7-day TTL)
- [x] Claude response with prompt caching (85% cost saving)
- [x] 360dialog outbound message delivery
- [x] Conversation + message stored in Supabase
- [x] Supabase Realtime push to dashboard
- [x] Immutable audit log entry for every processed message
- [x] Per-step timeouts (2s cache, 20s Claude, 5s WhatsApp delivery)
- [x] Graceful escalation to human on AI failure
- [x] Exponential backoff retry for transient Anthropic errors

**Key files:**
```
app/api/webhook/whatsapp/route.ts  — 360dialog inbound webhook
lib/workflow/engine.ts             — AdminWorkflowEngine (core IP)
lib/whatsapp/send.ts               — 360dialog outbound + payload parser
lib/cache/faqCache.ts              — Redis FAQ + dedup + session cache
lib/ai/callClaude.ts               — Claude API with retry + caching
```

---

### Phase 3 — Dashboard
**Goal:** Give managers a world-class view of their business in real time.

- [x] Auth-protected dashboard layout with persistent sidebar
- [x] Main overview: open conversations, overdue invoices, debt total, active goals
- [x] Live inbox: real-time conversation list + message thread + AI agent panel
- [x] 5 AI agents per conversation: Draft reply, Summarise, Lookup, Escalation guide, Business advisor
- [x] Staff page: directory, leave balances, wellness scores
- [x] Invoices page: debt register with escalation tier badges
- [x] Documents page: uploaded files, AI summaries, processing status
- [x] Calendar page: appointments + leave calendar view
- [x] Analytics page: conversation trends, AI usage, wellness averages, goal progress
- [x] Settings page: business profile, FAQs, integrations, billing

**Key files:**
```
app/dashboard/page.tsx              — Main overview
app/dashboard/inbox/page.tsx        — Live inbox with AI agent panel
app/dashboard/staff/page.tsx        — Staff + wellness + leave
app/dashboard/invoices/page.tsx     — Debt register
app/dashboard/documents/page.tsx    — File intelligence
app/dashboard/calendar/page.tsx     — Calendar
app/dashboard/analytics/page.tsx    — Business intelligence
app/dashboard/settings/page.tsx     — Settings hub
components/dashboard/Sidebar.tsx    — Nav sidebar
components/dashboard/TopBar.tsx     — Page header with user context
components/dashboard/StatCard.tsx   — KPI stat card
```

---

### Phase 4 — Automated Workflows
**Goal:** The system runs business operations without human input.

- [x] **Debt Recovery Engine**: 5-tier escalation sequence over 30 days
  - Tier 1 (day 1): Friendly WhatsApp reminder
  - Tier 2 (day 3): WhatsApp + email follow-up
  - Tier 3 (day 7): Firm professional notice
  - Tier 4 (day 14): Serious final notice
  - Tier 5 (day 30): Letter of demand via email
  - Claude drafts each message in tenant's voice and tone
  - Runs daily at 09:00 SAST via Vercel Cron
- [x] **Wellness Check-In**: Daily WhatsApp mood check-in to all staff (Mon–Fri 08:00 SAST)
  - Scores stored as JSONB array on staff record
  - Burnout detection: 7-day avg below 2.5 triggers manager alert
  - After-hours messaging pattern detection
- [x] **Daily AI Brief**: Personalised morning business intelligence (Mon–Fri 07:00 SAST)
  - Aggregates: open conversations, overdue invoices, debt total, staff on leave, wellness avg, top goals
  - Claude generates actionable insights connected to company goals
  - Brief stored in audit_log for dashboard display
- [x] **File Intelligence Pipeline**: n8n parses files → AdminOS classifies and routes
  - Strategy docs → goal extraction → goals table
  - Invoices → data extraction → invoices table
  - HR docs → staff record updates
  - Reports → AI summary → dashboard insight

**Key files:**
```
lib/workflows/debtRecovery.ts          — Debt recovery sequence
lib/workflows/wellness.ts              — Wellness check-in + scoring
app/api/cron/daily-brief/route.ts      — Daily brief generation
app/api/cron/debt-recovery/route.ts    — Debt recovery cron trigger
app/api/cron/wellness/route.ts         — Wellness check-in cron trigger
app/api/workflow/file-received/route.ts — n8n file intelligence endpoint
app/api/workflow/trigger/route.ts       — Generic n8n workflow trigger
```

---

### Phase 5 — Security Hardening
**Goal:** Production-grade security, no shortcuts.

- [x] **Middleware** (`middleware.ts`): JWT verification on every request
  - Whitelist public paths (/, /login, /signup, webhooks)
  - Redirect unauthenticated dashboard access to `/login?redirect=...`
  - Inject `x-tenant-id`, `x-user-id`, `x-user-role` headers for all downstream routes
  - Block suspended tenants from dashboard and API
  - Restrict `/api/admin/` to `super_admin` role only
  - Security headers on every response
- [x] **Rate limiting** (Upstash Redis sliding window):
  - WhatsApp webhook: 30 req / 10s per tenant
  - General API: 60 req / 60s per tenant
  - AI agents: 20 req / 60s per tenant (expensive calls)
  - Inbound webhook: 100 req / 1s
  - Onboarding: 10 req / hour (prevent signup abuse)
  - Fail-open on Redis unavailability (log, don't block production)
- [x] **Audit log**: Immutable append-only record of every mutation
- [x] **Webhook signature verification**: HMAC-SHA256 on 360dialog payloads
- [x] **Security headers** (via `next.config.ts`):
  - HSTS (2 years, includeSubDomains, preload)
  - Content-Security-Policy
  - X-Frame-Options: DENY
  - X-Content-Type-Options: nosniff
  - Referrer-Policy: strict-origin-when-cross-origin
  - Permissions-Policy

**Key files:**
```
middleware.ts                    — Central auth + security gateway
lib/security/rateLimit.ts        — Upstash sliding window rate limiter
lib/security/audit.ts            — Immutable audit log writer
next.config.ts                   — Security headers + CSP
```

---

### Phase 6 — Onboarding
**Goal:** Any business is live in 15 minutes, no technical help needed.

- [x] 6-step onboarding wizard at `/dashboard/settings/onboarding`
  - Step 1: Business profile (name, type, country, languages, timezone)
  - Step 2: Team (add staff with name + phone, assign roles)
  - Step 3: Knowledge base (FAQs, business hours, tone preference)
  - Step 4: Upload strategy doc (optional — Claude extracts goals)
  - Step 5: Connect integrations (Gmail, Google Calendar, PayFast, Xero)
  - Step 6: Go live (verify WhatsApp, send test message, view first brief)
- [x] API routes for tenant creation and profile management
- [x] Onboarding API: `POST /api/onboarding/create-tenant`

---

### Phase 7 — SEO & Performance
**Goal:** Rank for South African business software searches, load fast everywhere.

- [x] Full metadata (`metadataBase`, Open Graph, Twitter cards, canonical)
- [x] SA-specific keywords: WhatsApp automation SA, debt recovery SA, POPI compliant, load shedding resilient
- [x] Schema.org JSON-LD `SoftwareApplication` structured data
- [x] `app/sitemap.ts` — Next.js dynamic sitemap
- [x] `public/robots.txt` — Block dashboard + API, allow marketing pages
- [x] Semantic HTML throughout landing page (nav, section, article, footer roles)
- [x] `lang="en-ZA"` and `hreflang` alternates for en-ZA and af-ZA
- [x] Africa-first content: load shedding resilience, 11 languages, POPI Act
- [x] PWA: `manifest.json`, icon-192.png, icon-512.png, apple-touch-icon
- [x] Image optimisation: AVIF + WebP formats, Supabase Storage remote patterns
- [x] Font: `display: swap` for LCP improvement
- [x] Preconnect hints for Google Fonts and Supabase
- [x] `compress: true` and `poweredByHeader: false` in Next.js config
- [x] `optimizePackageImports` for `@anthropic-ai/sdk`, `@supabase/supabase-js`, `@upstash/redis`

---

## Database Schema Summary

| Table | Purpose |
|---|---|
| `tenants` | One row per business. Holds config, system prompt cache, plan, settings JSONB |
| `conversations` | WhatsApp + email threads. Status, intent, sentiment, contact info |
| `messages` | Individual messages. Role (user/assistant/system), token count, cache flag |
| `staff` | Staff records. Leave balance, wellness scores (JSONB array), role |
| `leave_requests` | Leave applications with approval workflow |
| `invoices` | Invoice + debt register. `days_overdue` is a computed column |
| `documents` | Uploaded files. Storage URL, AI summary, extracted goals |
| `goals` | Business goals. `progress_pct` is a computed column |
| `audit_log` | Immutable event log. Actor, action, resource, IP. No UPDATE/DELETE |

All tables have:
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `tenant_id UUID` foreign key with RLS policy
- `created_at TIMESTAMPTZ DEFAULT NOW()`

---

## African Market Design Decisions

### Load Shedding Resilience
- PWA with service worker caches the dashboard shell
- Redis queues retry automatically when connectivity returns
- Upstash Redis is globally distributed — South African edge nodes included
- Vercel edge functions serve from Johannesburg region
- Inngest provides durable job queuing with automatic retries

### 11 Languages
- Claude detects customer language automatically from message content
- System prompt instructs: "Always respond in the customer's language if detectable"
- Primary and secondary language fields on the `tenants` table
- Landing page hreflang tags for en-ZA and af-ZA
- Planned: Zulu, Xhosa, Afrikaans, Setswana, Sesotho, Tsonga, Venda, Swati, Ndebele, Southern Ndebele

### POPI Act Compliance
- Data stored in Supabase (can be configured to South Africa region)
- RLS enforces strict tenant isolation at database level
- Audit log captures who accessed what, when, from which IP
- Signed URLs for file access expire in 1 hour
- No cross-tenant data leakage by design

### ZAR-First
- All pricing in South African Rand
- PayFast + Yoco for local payments (no card-not-present friction)
- Invoice amounts, debt recovery messages all default to R currency

---

## API Resilience Patterns

### Anthropic (Claude API)
- Exponential backoff with jitter on 529/502/503/overloaded errors
- 3 retry attempts, doubling delay: 800ms → 1.6s → 3.2s
- 25-second SDK timeout (within Vercel's 30s function limit)
- Prompt caching on every WhatsApp response call
- History capped at 10 messages to control token cost

### Redis (Upstash)
- Singleton client — created once per cold start, reused across requests
- Singleton Ratelimit instances cached per limiter key
- Fail-open on Redis unavailability: log the error, allow the request through
- `analytics: true` on rate limiters for Upstash dashboard visibility
- Atomic SET NX for deduplication (no GET+SET race condition)

### Supabase
- Admin client (service role) for server-side ops that bypass RLS
- Server client (SSR) for user-scoped operations that respect RLS
- Browser client for realtime subscriptions in dashboard
- `maybeSingle()` instead of `single()` where row may not exist

### Workflow Engine
- Per-step timeouts prevent a single slow step stalling the whole flow
- Escalation fallback: if AI fails with no response, send human escalation message
- Audit + dashboard steps always attempted even after earlier step failures
- Non-blocking workflow execution on WhatsApp webhook (respond to 360dialog in < 1s)

---

## What Comes Next

### Integrations (in progress via n8n)
- [ ] Gmail OAuth sync — read/route inbound emails
- [ ] Google Calendar — leave calendar, appointment booking
- [ ] Google Drive — file sync and document watching
- [ ] Xero — invoice webhook, payment reconciliation
- [ ] PayFast — subscription billing webhooks
- [ ] Google Sheets — two-way data sync

### Features (planned)
- [ ] Multi-language dashboard UI (Afrikaans, Zulu)
- [ ] Voice note transcription (WhatsApp audio → text → AI response)
- [ ] WhatsApp quick-reply buttons and list messages
- [ ] Client portal (WhatsApp-linked self-service for clients)
- [ ] Load shedding schedule integration (Eskom API) — pause wellness check-ins during outages
- [ ] CIPC business registration lookup
- [ ] SARS invoice compliance check
- [ ] Supplier payment scheduling
- [ ] White-label reseller portal

### Infrastructure
- [ ] Playwright E2E tests for critical flows
- [ ] Inngest functions for heavy async jobs (replacing raw fetch calls)
- [ ] OG image generation (dynamic per tenant)
- [ ] Analytics dashboard connected to live Supabase data
- [ ] Admin super-dashboard for managing all tenants

---

## Environment Variables Reference

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=           # Project URL from Supabase dashboard
NEXT_PUBLIC_SUPABASE_ANON_KEY=      # Anon (public) key
SUPABASE_SERVICE_ROLE_KEY=          # Service role key — keep secret

# Anthropic
ANTHROPIC_API_KEY=                  # From console.anthropic.com

# WhatsApp
DIALOG360_API_KEY=                  # From app.360dialog.io
DIALOG360_WEBHOOK_SECRET=           # Webhook signing secret

# Email
RESEND_API_KEY=                     # From resend.com

# Redis
UPSTASH_REDIS_REST_URL=             # From console.upstash.com
UPSTASH_REDIS_REST_TOKEN=           # REST token

# Cron Security
CRON_SECRET=                        # openssl rand -hex 32

# Queue
INNGEST_EVENT_KEY=                  # From app.inngest.com
INNGEST_SIGNING_KEY=                # From app.inngest.com

# Payments
PAYFAST_MERCHANT_ID=
PAYFAST_MERCHANT_KEY=
PAYFAST_PASSPHRASE=

# Xero
XERO_CLIENT_ID=
XERO_CLIENT_SECRET=

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# n8n
N8N_WEBHOOK_SECRET=                 # Shared secret for n8n → AdminOS calls

# Cloudflare
CLOUDFLARE_ZONE_ID=
```

---

## Deployment Checklist

```
VERCEL
□ All environment variables added to Vercel project settings
□ CRON_SECRET added (matches .env.local value)
□ Production domain: adminos.co.za configured
□ Vercel Analytics enabled

SUPABASE
□ schema.sql executed in Supabase SQL editor
□ RLS enabled on all tables
□ Audit log: UPDATE and DELETE privileges revoked
□ Storage bucket created (private, AES-256)
□ Supabase Realtime enabled on conversations + messages tables

SECURITY BATTLETEST
□ JWT verified on every protected route (test with expired token)
□ Tenant isolation: confirm tenant A cannot read tenant B's data
□ Webhook signature: replay attack with wrong secret returns 401
□ Rate limiting: 100 rapid requests → 429 response
□ Suspended tenant: blocked from dashboard and API

AI
□ Prompt cache hit rate > 80% (check Anthropic usage dashboard)
□ WhatsApp response time < 3 seconds end-to-end
□ Responses stay under 300 characters for WhatsApp
□ Multi-language test: send message in Zulu → response in Zulu

SEO
□ Google Search Console: site submitted, sitemap indexed
□ OpenGraph: test at opengraph.xyz
□ Schema.org: validate at schema.org/validator
□ Lighthouse score: Performance > 90, SEO = 100, Accessibility > 90

PWA
□ Chrome DevTools → Application → Manifest: no errors
□ Install prompt appears on mobile Chrome
□ Offline: dashboard shell loads without internet
```

---

## Git Commit History

| Commit | Description |
|---|---|
| `initial` | Next.js scaffold, Supabase schema, TypeScript types |
| `feat: dashboard pages` | All 9 dashboard pages + layout |
| `feat: auth pages` | Login, signup, auth layout |
| `feat: landing page` | Marketing homepage with pricing |
| `feat: WhatsApp webhook` | 360dialog inbound + workflow engine |
| `feat: AI layer` | Claude API, prompt caching, 5 agents |
| `feat: debt recovery` | 5-tier automated recovery sequence |
| `feat: wellness engine` | Daily check-ins, burnout detection |
| `feat: file pipeline` | n8n → classify → route → store |
| `feat: cron routes` | debt-recovery, wellness cron routes |
| `feat: onboarding wizard` | 6-step setup flow |
| `feat: security middleware` | JWT auth, tenant isolation, role guards |
| `feat: daily-brief cron` | Missing cron route for daily AI brief |
| `feat(seo)` | Full SEO pass — OG, Twitter, schema.org, sitemap |
| `perf: API resilience` | Retry logic, timeouts, circuit breaker patterns |
| `perf: Redis cache layer` | Session cache, counters, atomic dedup |
| `fix(cron): vercel.json` | daily-brief added, CORS headers |
| `feat(pwa): icons` | 192px + 512px icons from SVG source |
| `docs: BUILD_JOURNEY.md` | This document |

---

---

## v2 Strategy — Closing Every Loop

*Drafted after the initial build was feature-complete. The insight driving v2:*

> AdminOS v1 captures information. AdminOS v2 **acts on information** — automatically, continuously, in the right language, even during load shedding.

The fundamental problem v2 solves is **broken follow-through**. African SMEs don't fail for lack of tools. They fail because no tool closes the loop from trigger to outcome automatically. v2 is built around five closed loops that handle the most painful daily admin failures.

---

### The 5 Closed Loops

**Loop 1 — The Money Loop**
```
Invoice uploaded → debtor created → WhatsApp reminder scheduled →
payment promised → follow-up sent → payment confirmed → loop closed
```

**Loop 2 — The People Loop**
```
Monday 8am → wellness check-in WhatsApp sent to all staff →
score reply received → recorded in DB → declining trend detected →
manager notified → support message sent to staff → loop closed
```

**Loop 3 — The Conversation Loop**
```
WhatsApp received → AI responds → 48h passes unresolved →
auto-escalation to owner → owner resolves → audit logged → loop closed
```

**Loop 4 — The Document Intelligence Loop**
```
Contract uploaded → AI extracts parties, dates, obligations →
key dates added to calendar → expiry reminder created →
compliance alert 30 days before renewal → loop closed
```

**Loop 5 — The Insight Loop**
```
Daily brief generated → owner reads trend → uploads relevant docs →
AI adjusts next brief based on new context → key insights stored →
future briefs build on business history → loop closed
```

---

### v2 Build Plan

#### Phase 1 — Fix Broken Loops
| Feature | Status | File |
|---|---|---|
| Wellness score recording in workflow | ✅ Built | `lib/workflow/engine.ts` |
| Low wellness score follow-up message | ✅ Built | `lib/workflow/engine.ts` |
| Plan quota enforcement (pre-AI gate) | ✅ Built | `lib/workflow/engine.ts` |
| Multi-language detection (Zulu/Xhosa/Afrikaans) | ✅ Built | `lib/workflow/engine.ts` |
| Language-aware Claude responses | ✅ Built | `lib/workflow/engine.ts` |
| Real-time new conversation subscription | ✅ Built | `app/dashboard/inbox/page.tsx` |
| New conversation indicator (green dot) | ✅ Built | `app/dashboard/inbox/page.tsx` |
| Global error boundary | ✅ Built | `app/error.tsx` |
| Dashboard error boundary | ✅ Built | `app/dashboard/error.tsx` |
| Auto-escalation cron (every 6 hours) | ✅ Built | `app/api/cron/escalate-conversations/route.ts` |
| PWA service worker (offline / load shedding) | ✅ Built | `next.config.ts` |

#### Phase 2 — Core Daily-Use Features (Planned)
| Feature | Purpose |
|---|---|
| Contacts / CRM page | Unified record per contact: balance, history, documents, quick actions |
| Debt recovery automation | Invoice upload → auto-schedule WhatsApp reminder ladder (day 0/3/7/14/30) |
| Real analytics dashboard | Live charts: volume by intent, debt aging, wellness trend, response time |
| Staff wellness heatmap | Team wellness grid by staff × week, auto-flag declining members |

#### Phase 3 — Document Intelligence (Planned)
| Feature | Purpose |
|---|---|
| Contract → Calendar | Extract key dates from contracts, auto-create calendar reminders |
| Invoice → Debtor | Uploaded invoices auto-create debtor records and start reminder sequences |
| Document expiry alerts | Compliance documents get expiry reminders 30 days before renewal |
| HR doc → Staff record | HR documents linked to matching staff profiles |

#### Phase 4 — Differentiators (Planned)
| Feature | Purpose |
|---|---|
| Load shedding widget | EskomSePush API integration — show next outage in dashboard |
| WhatsApp sequence builder | Configure drip sequences: debt reminders, onboarding, wellness |
| AI advisor memory | Store insights per tenant, advisor gets smarter over time |
| POPI compliance center | Data register, right of erasure, consent log, incident log |

#### Phase 5 — Scale Infrastructure (Planned)
| Feature | Purpose |
|---|---|
| PayFast billing | Subscription management, trial enforcement, usage metering |
| Referral system | Unique links, reward tracking, 1-month-free incentive |
| Tenant onboarding automation | Welcome WhatsApp, demo conversation, Day 3 + Day 14 check-ins |

---

### New Database Tables (v2)

```sql
-- Debt recovery
CREATE TABLE debtors (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid REFERENCES tenants NOT NULL,
  contact_identifier  text NOT NULL,
  contact_name        text,
  amount_owed         numeric(12,2) NOT NULL DEFAULT 0,
  amount_paid         numeric(12,2) NOT NULL DEFAULT 0,
  invoice_reference   text,
  due_date            date,
  status              text DEFAULT 'outstanding',
  last_reminder_sent_at timestamptz,
  created_at          timestamptz DEFAULT now()
);

-- WhatsApp automation sequences
CREATE TABLE whatsapp_sequences (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid REFERENCES tenants NOT NULL,
  name         text NOT NULL,
  trigger_type text NOT NULL,
  steps        jsonb NOT NULL DEFAULT '[]',
  is_active    boolean DEFAULT true,
  created_at   timestamptz DEFAULT now()
);

CREATE TABLE sequence_enrollments (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid REFERENCES tenants NOT NULL,
  sequence_id        uuid REFERENCES whatsapp_sequences NOT NULL,
  contact_identifier text NOT NULL,
  current_step       int DEFAULT 0,
  next_step_at       timestamptz NOT NULL,
  status             text DEFAULT 'active',
  created_at         timestamptz DEFAULT now()
);

-- Calendar events from documents, sequences, or manual entry
CREATE TABLE calendar_events (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid REFERENCES tenants NOT NULL,
  title                 text NOT NULL,
  event_date            date NOT NULL,
  event_time            time,
  contact_identifier    text,
  source                text,
  source_id             uuid,
  send_whatsapp_reminder boolean DEFAULT false,
  created_at            timestamptz DEFAULT now()
);

-- AI advisor memory — stored insights that persist across sessions
CREATE TABLE business_insights (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid REFERENCES tenants NOT NULL,
  insight      text NOT NULL,
  category     text,
  extracted_at timestamptz DEFAULT now()
);

-- Subscription and billing
CREATE TABLE subscriptions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid REFERENCES tenants NOT NULL UNIQUE,
  plan                  text DEFAULT 'trial',
  status                text DEFAULT 'active',
  trial_ends_at         timestamptz DEFAULT now() + interval '14 days',
  current_period_end    timestamptz,
  payfast_subscription_id text,
  created_at            timestamptz DEFAULT now()
);
```

---

## Workflow Engine Architecture (v2)

The `whatsapp.inbound` flow now has 9 steps, each with a per-step timeout:

```
WhatsApp message received
        │
        ▼
loadTenantContext    (5s)  — refresh prompt cache if > 24h old
        │
        ▼
classifyIntent      (8s)  — intent + sentiment + language detection (parallel)
        │
        ▼
checkFAQCache       (2s)  — Redis lookup: answer instantly if cached
        │
        ▼
checkPlanLimits     (3s)  — Redis counter: block AI if over monthly quota
        │
        ▼
generateResponse   (20s)  — Claude API with cached system prompt + language instruction
        │
        ▼
sendWhatsApp        (5s)  — 360dialog delivery
        │
        ▼
logToAudit          (3s)  — append-only audit trail
        │
        ▼
updateDashboard     (5s)  — upsert conversation + batch insert messages
        │
        ▼
recordWellness      (6s)  — if intent=wellness_checkin: extract score → update staff DB
                            if score ≤ 2: auto-send warm support message
```

---

---

## Phase 6 — B2B Sales Readiness (March 2026)

*The product was feature-complete. This phase made it sales-ready.*

### What was built in this phase

#### Landing Page → Enterprise Grade
The original landing page was minimal and developer-focused. This phase rebuilt it as a proper B2B SaaS landing page:
- **ROI comparison table** — shows exactly which tools AdminOS replaces (R11,200/mo → R4,500/mo)
- **Named AI agents** — Alex, Chase, Care, Doc, Insight — each with a role, description, and measurable metric
- **Kustom Krafts case study** — real client story, real numbers (40% admin reduction, 14/18 invoices settled)
- **FAQ with native accordion** — 8 B2B-specific objections answered with `<details>` elements (no JS)
- **Updated pricing** — aligned to B2B SaaS pricing (R2,500 / R4,500 / R8,500 / R14,999)
- **Demo booking CTA** — cal.com integration in hero and footer
- **Sticky nav** — with anchor links to Agents, Pricing, FAQ, Contact
- **Industries badge rail** — 8 industries with hover effects

#### Legal Infrastructure
Three legal pages built from scratch, enterprise-quality:
- **Privacy Policy** (`/privacy`) — full POPIA compliance documentation: data retention table, third-party processor inventory, all 6 POPIA rights as cards
- **Terms of Service** (`/terms`) — subscription terms, AI disclaimer, SLA tiers, acceptable use, South African governing law
- **Contact page** (`/contact`) — 4 contact cards (demo, sales, support, legal) with cal.com booking

#### Security Layer
- **`lib/security/sanitize.ts`** — prompt injection protection for all inbound WhatsApp messages
  - `sanitizeForAI()`: 16 regex patterns, 2000-char hard limit
  - `sanitizeSystemPromptValue()`: cleans admin-provided config before system prompt injection
  - `validateTenantId()`: UUID format validation before DB use
- **Middleware updated**: /privacy, /terms, /contact added to public paths

#### SEO & Analytics
- **Vercel Analytics + Speed Insights** added to root layout
- **CookieConsent** component: localStorage-backed, POPIA-aware (strictly necessary vs accept-all)
- **Sitemap** updated with /contact, /privacy, /terms (4 public pages total)
- **robots.txt** updated to allow legal and contact pages for indexing

#### README
Complete rewrite of README.md:
- AI architecture diagram (full request flow from WhatsApp to response)
- Model routing table (Sonnet vs Haiku per agent type)
- Tech stack table (14 rows)
- Cron job schedule table
- POPIA compliance checklist
- Project structure tree
- Roadmap with 7 planned features

### Key technical decisions in this phase

**Why native `<details>` for FAQ:**
FAQ accordion built with HTML `<details>/<summary>` — zero JavaScript, works without hydration, accessible by default. The `+` rotates to `×` via CSS `group-open:rotate-45`.

**Why cal.com for demo booking:**
Free, open-source alternative to Calendly. No vendor lock-in. Self-hostable if needed. The `/nanda/adminos-demo` path is the standard format.

**Why `sanitizeForAI()` at ingestion not at prompt:**
Sanitizing at the ingestion point (webhook handler) rather than just before the Claude call means all data stored in DB is already clean. This prevents injection via replay attacks on stored messages.

**Pricing strategy:**
Moved from R799/R2,499/R7,999 (consumer-friendly) to R2,500/R4,500/R8,500 (B2B SaaS). The ROI story (R11,200 → R4,500) only works at this price point — at R799 it's a commodity, at R4,500 it's a strategic investment that pays for itself month one.

### Content gold for marketing

**LinkedIn post angles:**
1. "I built AdminOS to replace a R11,200/month toolstack for South African SMEs. Here's what I replaced:"
2. "The reason I named our AI agents (Alex, Chase, Care, Doc, Insight) — and why it changes how business owners think about automation"
3. "What Kustom Krafts (Johannesburg carpentry) taught me about building B2B software for Africa"
4. "Building load-shedding resilient SaaS in 2026: the technical decisions that matter"
5. "POPIA vs GDPR — why South African compliance is harder than you think, and how we solved it"

**Twitter/X thread starters:**
1. "Building AI SaaS for Africa is different. Thread on the 5 things that change everything 🧵"
2. "Prompt injection is real and your WhatsApp bot is vulnerable. Here's exactly how we protect AdminOS 🔒"
3. "We route between Claude Sonnet and Haiku based on task type. The cost difference is 40%. Here's the decision matrix:"

**TikTok script outlines:**
1. "Watch me demo what happens when a client sends a WhatsApp message to a business running AdminOS vs one that isn't" [split screen, 60s]
2. "POV: It's 3am, load shedding just ended, and AdminOS is auto-sending debt recovery messages to 47 clients. Here's what that looks like" [screen recording, 45s]

---

## What's next (post-B2B launch)

- [ ] Google Search Console verification token added to layout.tsx
- [ ] OG image tested at opengraph.xyz
- [ ] Kustom Krafts case study as standalone `/case-studies/kustom-krafts` page
- [ ] Voice note processing (Whisper API — very SA behaviour)
- [ ] Sage integration (higher priority than QuickBooks for SA market)
- [ ] WhatsApp sequence builder UI
- [ ] Multi-tenant admin dashboard for White Label clients

---

*Built by Nandawula Regine · Mirembe Muse (Pty) Ltd · adminos.co.za*
*"Build it bulletproof. Build it beautiful. Build it for Africa."*
