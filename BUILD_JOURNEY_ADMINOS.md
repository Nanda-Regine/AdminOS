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
| WhatsApp | Meta WhatsApp Cloud API | Official first-party API, direct Meta integration, no BSP markup |
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

WhatsApp (Meta Cloud API)──► /api/webhook/whatsapp
                              │
                              ▼
                    ┌─── WorkflowEngine ───┐
                    │  loadTenantContext   │
                    │  classifyIntent      │◄── Claude API
                    │  checkFAQCache       │◄── Redis
                    │  generateResponse    │◄── Claude API (cached)
                    │  sendWhatsApp        │──► Meta Cloud API
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

- [x] Meta WhatsApp Cloud API webhook verified via HMAC-SHA256 signature
- [x] Message deduplication via Redis SET NX (atomic, no race conditions)
- [x] Tenant routing by WhatsApp number (WABA ID)
- [x] WorkflowEngine with 7 steps in sequence
- [x] FAQ cache check before any Claude API call (Redis, 7-day TTL)
- [x] Claude response with prompt caching (85% cost saving)
- [x] Meta WhatsApp Cloud API outbound message delivery
- [x] Conversation + message stored in Supabase
- [x] Supabase Realtime push to dashboard
- [x] Immutable audit log entry for every processed message
- [x] Per-step timeouts (2s cache, 20s Claude, 5s WhatsApp delivery)
- [x] Graceful escalation to human on AI failure
- [x] Exponential backoff retry for transient Anthropic errors

**Key files:**
```
app/api/webhook/whatsapp/route.ts  — Meta WhatsApp Cloud API inbound webhook
lib/workflow/engine.ts             — AdminWorkflowEngine (core IP)
lib/whatsapp/send.ts               — Meta Cloud API outbound + payload parser
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
- [x] **Webhook signature verification**: HMAC-SHA256 on Meta WhatsApp Cloud API payloads
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
- Non-blocking workflow execution on WhatsApp webhook (respond to Meta Cloud API in < 1s)

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

# WhatsApp (Meta WhatsApp Cloud API)
META_WHATSAPP_ACCESS_TOKEN=         # From Meta Business Suite → WhatsApp → API Setup
META_PHONE_NUMBER_ID=               # Phone number ID from Meta App Dashboard
META_WEBHOOK_VERIFY_TOKEN=          # Custom verify token for webhook subscription
META_WEBHOOK_SECRET=                # Webhook signing secret (HMAC-SHA256)

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
| `feat: WhatsApp webhook` | Meta WhatsApp Cloud API inbound + workflow engine |
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
sendWhatsApp        (5s)  — Meta Cloud API delivery
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

## Session 5 — Production Bug Fix + Landing Page Overhaul + /demo (April 2026)

### Sign-in crash — root cause & fix

Production users hit a Server Components render error immediately after sign-in. Root cause: `validateEnv()` was called at the top level of `app/layout.tsx`. The dashboard uses `force-dynamic`, so every SSR render triggered the function — and when `META_WHATSAPP_ACCESS_TOKEN`, `META_PHONE_NUMBER_ID`, `META_WEBHOOK_SECRET`, and `CRON_SECRET` were unset (which they are in the real deployment), it threw.

**Fix (3 parts):**
1. `lib/config/validate.ts` — split into CRITICAL (Supabase + Anthropic — throw) vs RECOMMENDED (META, CRON, etc. — warn only). Unset optional vars no longer crash the server.
2. `app/layout.tsx` — removed `validateEnv()` call and its import entirely.
3. `instrumentation.ts` (new file at project root) — uses Next.js startup hook to call `validateEnv()` once at server boot, not on every request.

### Landing page — full redesign

**Before:** WhatsApp green palette, 5 agents, no mobile responsiveness, 941 lines.

**After:**
- New palette: orange `#F97316`, turquoise `#06B6D4`, near-black `#050B1A` / navy `#0A0F2C`
- 6th agent **Pen** (Content) added throughout
- Each agent gets a unique **CSS-only animated mini mockup**:
  - Alex → WhatsApp chat with message appear + typing dots
  - Chase → Invoice with progress bar fill animation
  - Care → Staff list with wellness pulse + alert fadeIn
  - Doc → Document scan line + extracted fields sequence
  - Insight → Bar chart with `barGrow` keyframe per column
  - Pen → Typing lines + blinking cursor
- **Mobile responsive** — 2-col at 900px, 1-col at 560px
- Diagonal section dividers via `clip-path: polygon(...)`
- ROI table updated: Pen copywriting R3,500 → total R14,700/mo
- "Try demo" CTAs throughout → `/demo`
- All animations are server-safe (no React hooks needed)

### /demo interactive prototype

New route `app/demo/page.tsx` — fully client-side, no real API calls:

- **Fake tenant:** Thabo Dlamini Attorneys (SA law firm)
- **6 agent tabs**, each fully interactive:
  - **Alex** — WhatsApp inbox with 4 fake contacts, scripted chat replies, quick-reply buttons
  - **Chase** — Overdue invoice table with individual + bulk "Send reminder" actions
  - **Care** — Staff wellness scores (4 staff), wellness check + pulse survey buttons, scripted Care response
  - **Doc** — Fake PDF upload → scan animation → extracted clauses + risk flag for non-compete
  - **Insight** — KPI metrics grid, revenue bar chart, "Generate daily AI brief" with scripted brief text
  - **Pen** — 5 content templates (WhatsApp, LinkedIn, Invoice email, Reminder, Proposal), topic input, copy button
- Orange `DEMO MODE` banner + sign-up CTA at top
- Mobile responsive (sidebar collapses to horizontal tab bar on small screens)

### Commit
`feat: fix sign-in crash + landing page overhaul + /demo prototype`
5 files changed, 1579 insertions, 599 deletions

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

---

## Session 6 — Conference Readiness Sprint (16 August 2026)

**Deadline:** conference on 18 August 2026 — hundreds of SA SMEs and EMEs.
**Mandate:** make AdminOS read as a "Super Tool" that could genuinely run a business —
enterprise-grade UI, clean premium UX across mobile/tablet/desktop, solid cybersecurity,
demonstrable SA compliance, and a proper home for every business stakeholder.

**Full plan: [`CONFERENCE_READINESS_PLAN.md`](./CONFERENCE_READINESS_PLAN.md)** — written
before building, per the project golden rule.

### Golden rule established

Every plan is committed to memory **and** this build journey *before* any building starts,
so a mid-build crash never loses the thread.

### Reuse strategy — work smarter, not harder

Rather than re-deriving solved problems, three mature codebases are mined for portable
patterns: **BB MotherShip Deluxe** (`OneDrive/BBOpsOS`) for operational categorisation,
stakeholder modelling and colour-coded data presentation; **JarvisOS** for its finance,
marketing, CEO and Sanyu wing frameworks; and the **industry OS demos**
(`Transport-shuttle-os`, `carpentary-os-demo`, `StokvelOS`, `campus-compass`) for
sector-specific data models.

### Bugs found and fixed

| Bug | Root cause | Fix |
|---|---|---|
| Login/signup inputs unreadable | App defaults to the **dark** theme, but `.auth-shell` forces a light background. Inputs set no colour, so they inherited the near-white `--foreground` — white on white | Explicit `text-gray-900 bg-white placeholder:text-gray-400` on all six inputs |
| Landing mobile menu see-through and clipped | Overlay is `position:fixed; inset:0` but sits inside `<header class="glass-nav">`, which sets `backdrop-filter`. Any value other than `none` makes that element the **containing block for fixed descendants**, so `inset:0` resolved against the ~60px nav bar, not the viewport | Portal to `document.body`; fully opaque background; Escape-to-close |
| Onboarding WhatsApp previews unreadable | Same dark-theme inheritance: chat bubbles set a pale background but no text colour | Explicit `#111B21` on bubbles; solid white typing indicator; WhatsApp-grey timestamp |
| Feedback widget covering onboarding CTA | `position:fixed; right:18px; bottom:18px; z-index:2147483000` — sat on top of the bottom-right primary action | Added `data-hide-on` route gating (SPA-aware via patched `history.pushState`); icon-only 44px button below 640px with safe-area inset |
| Admin-generated auth links could never work | `app/auth/callback/route.ts` requires `?code=` (PKCE). Links from `/auth/v1/admin/generate_link` carry no PKCE verifier and return tokens in the URL **fragment**, which a server route cannot read and middleware bounces first | Added `app/auth/confirm/route.ts` — server-side `verifyOtp` on `token_hash`, sets session cookies |

**Systemic finding:** the dark-theme-inheritance contrast bug is a *class*, not an incident —
three separate instances in one session. Any light-background surface in this app must set an
explicit text colour. A full sweep is in flight.

### Infrastructure fixes

- Supabase `mailer_otp_exp` raised **3600 → 86400** — auth links were expiring in one hour.
- `uri_allow_list` gained `https://adminos.co.za/**` and both `www` variants. Without a path
  wildcard, GoTrue silently collapses any `redirect_to` back to `site_url`.
- **Found: the `RESEND_API_KEY` is revoked** — verified invalid on `/domains`, `/api-keys` and a
  real send. The identical key is in `JarvisOS/.env.local`, so JarvisOS email is broken too.
  Combined with Supabase having no custom SMTP, **no AdminOS email reaches external users.**
  This is why the first beta user never received her invite.

### Discovery in flight

Six parallel read-only audits: page inventory & completeness · responsive/premium UX ·
SA compliance & security · BBOpsOS pattern mining · JarvisOS wing mining · six-industry fit.
Building resumes once they land and the plan is updated with their findings.


### Session 6 continued — security, compliance calendar, mobile

**CRITICAL security fix (applied to production).** Phase 0 and both August
follow-ups fixed *which tenant* a caller can reach — verified still holding, 0
policies read `user_metadata`. Neither constrained *what a caller may do inside
their tenant*. Every sensitive table carried
`FOR ALL USING (tenant_id = current_tenant_id())` with a **NULL `with_check`**,
and Supabase grants `ALL` to `authenticated` by default. Any staff user could
POST directly to PostgREST with the public anon key and set their own `role_id`
to owner, read every payslip in the company, or upgrade their own subscription.
Revoked `INSERT/UPDATE/DELETE` from `authenticated` and `anon` on `roles`,
`user_roles`, `payslips`, `payroll_runs`, `staff`, `subscriptions`,
`disciplinary_records`, `performance_reviews`. Safe because all 131 API routes
write through the service role and no client component writes these tables.
`SELECT` left intact. Verified post-apply: zero write grants remain.

**Compliance calendar activated.** `seed_compliance_calendar()` had shipped in
Phase 8 — correct, carrying EMP201/IRP6/ITR14/CIPC/COIDA/EMP501 with real
penalty text — and was called by nothing. No tenant hook, no POST, no page.
Every tenant's calendar was empty while the homepage sold it as "pre-seeded".
Now: unique index so the seed is genuinely idempotent (its `ON CONFLICT DO
NOTHING` had no constraint to catch on, so re-running duplicated everything);
status computed by a `BEFORE` trigger from `due_date` (ported from BB MotherShip
Deluxe `010_world_class.sql`) so it can never go stale; `recurrence` finally
acted on, so completing a monthly item schedules the next; every active tenant
backfilled; new tenants seeded from `create-tenant`. New `/dashboard/compliance`
page on the shared `DataTable`, leading with the next deadline and its penalty.
Result: 19 seeded items per tenant, statuses computing correctly.

**Mobile / contrast.** Added `.on-light`, the mirror of the existing `.on-dark`
helper — the root cause of a bug class that shipped at least six times. The
default theme is dark, so any surface forcing a light background inherited
near-white text. Rebinding the text tokens locally fixes every descendant at
once, no per-element edits, no `!important`. Applied to 24 pastel panels.
Button min-heights floored at 40/44/48px (md was ~36px, under the touch
minimum, app-wide from one file). Feedback widget also hidden on `/demo`; cookie
banner reserves a right gutter on mobile so its buttons clear the widget.

**Still open (not built):** the "models paperwork, not work" gap — job costing
(`time_entries`), asset/vehicle register, purchase orders, and deposits on
bookings. Also: `business_type` steers exactly one file, so an attendee picking
"Construction" gets the identical product to one picking "Retail".

---

## Roadmap after the conference — what to build, and what to copy

Written 16 Aug 2026 from six parallel audits (page inventory, responsive UX, SA
compliance + security, BBOpsOS mining, JarvisOS mining, six-industry fit).
Full working plan: `CONFERENCE_READINESS_PLAN.md`.

### The one-sentence diagnosis

**AdminOS models a business's *paperwork* superbly and its *work* barely at all.**
Compliance, payroll, AR chasing, governance, the signal bus and the autonomy
governor are genuinely strong. But `projects` has a `budget` column with nothing
costing against it, `bookings` carry no money, and there is no vehicle, no
billable hour, no quote. Every operator's first question is about *their* core
object — vehicle, site, patient, matter, room, edit — and none of them exist.
That is the whole of the "too basic" feeling, and it is four builds wide.

### Correction to a standing assumption

BBOpsOS is **not** the richer system. It is a 42-file single-tenant mobile staff
portal with no tables, no suppliers, no inventory and no equipment. AdminOS is
far larger (~180 API routes, 55 pages, 46 migrations) and ahead on information
architecture, data presentation and design tokens. `lib/nav/features.ts:2` claims
it was "Ported from BB-MotherShip-Deluxe" — **that file does not exist there**;
the comment is stale. Do not port BBOpsOS's nav, badge or card patterns backwards.
What BBOpsOS genuinely has is *discipline*: closed operational loops and status
rigour. Take those, not its surface.

### Highest-value builds, in order

| # | Build | Why | Effort |
|---|---|---|---|
| 1 | **Deposits + payment links on bookings/invoices** | Both PayFast and Paystack are already wired for AdminOS's *own* billing; nothing exposes them to the tenant's customers. No invoice PDF, no "Pay now". Turns AdminOS from a record of money into a mover of money. Hits hospitality, creative, trades and events at once. | ~5 d |
| 2 | **Job costing: `time_entries` + rollup into `projects.budget`** | One build serves billable hours, site labour cost, driver hours and edit time — and answers "which jobs actually made money", which no segment can currently answer. | ~8 d |
| 3 | **Polymorphic asset register** | Vehicles (logistics), plant (construction), kit (creative), devices (clinics). Reuse the proven `professional_licenses` + `licenseRemindersCron` expiry pattern. Makes logistics demoable at all — "where do I add my vehicles?" is asked in the first 30 seconds. | ~7 d |
| 4 | **Transactional client portal** | `app/portal/[token]/page.tsx` is read-only. Needs document exchange, versioned deliverables with timestamped comments, a client Approve button writing to `audit_log`, e-sign entry and Pay Now. The difference between "a tool I log into" and "the system my clients and I both work in". | ~6 d |
| 5 | **Proper tax invoice** | No invoice renderer exists at all. Needs "TAX INVOICE" wording, supplier VAT + CIPC number, recipient details at or above R5,000, VAT shown separately — and `COUNT(*)+1` numbering replaced with a per-tenant Postgres sequence (it is non-atomic *and* reuses numbers after a delete; both are VAT Act violations an accountant will spot). | ~5 h |
| 6 | **EME B-BBEE sworn affidavit generator** | Zero hits for "affidavit"/"EME" in the codebase. Most SA SMEs are EMEs (turnover under R10m) and this single document is the whole of their B-BBEE obligation. Render through the same HTML-to-print path as `lib/payroll/payslipTemplate.ts`. | ~4 h |
| 7 | **Purchase orders + reorder loop** | `ops/page.tsx:30-31` detects low stock and stops at a sentence. Close it: low stock, draft PO to preferred supplier, approve, receipt posts a `receive` transaction. The only cycle in the product that would touch the physical world. | ~4 d |

### Known dead ends and broken leaves (cheap, do first)

- `/dashboard/valuation` "Recalculate" is a `GET` form to a route returning
  `NextResponse.json` — it navigates the browser to **raw JSON**.
- `/dashboard/settings` "Connect" buttons have no `onClick` in a server component.
- `/dashboard/contacts/[id]` "+ New Invoice" points at `/dashboard/invoices/new`,
  which **404s**; its Edit and overflow buttons are also dead.
- `/dashboard/health` renders empty with no manual generate button — and
  `/dashboard/governance`'s happy-path CTA points straight at it.
- `/dashboard/calendar` is three stacked lists, not a calendar. Rename or rebuild.
- `/demo` is 884 lines with **zero API calls** and faked latency; the landing page
  links to it six times. Label it "sample data" or it reads as dishonest.
- `/contact` has no form — only `mailto:` links. No lead capture.
- Referrals never attribute: `signup?ref=` is never read.

### Compliance and security debt

- **POPIA consent is never written.** Columns and the display badge exist; no
  route sets them. Every contact reads "no consent" forever.
- **Global rule #3 ("soft delete only, `deleted_at`") is not implemented anywhere** —
  zero `deleted_at` columns; every delete is hard. That is *good* for POPIA
  erasure but contradicts the stated rule. Pick one story and write it down.
- Retention periods are displayed but no job enforces them.
- Migration files still carry the old `user_metadata` RLS shape even though live
  policies are fixed — **any new table copy-pasted from them reintroduces a
  spoofable policy.** Fix the templates.
- `checkPermission` is called by only 12 of 131 service-role routes.
- CSP ships `'unsafe-eval' 'unsafe-inline'`, so it provides little XSS protection.

### Port list — proven code from the other repos

**From JarvisOS** (`OneDrive/JarvisOS`) — near-verbatim, mostly needs
`user_id` to `tenant_id`:

| Source | What it gives |
|---|---|
| `src/app/api/finance/import/bank-statement/route.ts:16-158` | SA bank CSV parser (TymeBank, ABSA, Bidvest, FNB, Capitec) — separator auto-detect, four date formats, single-signed or debit/credit columns. **The demo moment: upload a Capitec CSV, watch 200 lines categorise themselves.** Pure, zero coupling. |
| `src/app/api/finance/tax/route.ts:8-83` | Provisional tax / IRP6 estimator — SARS brackets, rebate, tax-year resolver, IRP6-1/IRP6-2 split with statutory dates. Answers the question SA owners lose sleep over. AdminOS has VAT201 but not income tax. |
| `src/lib/finance/ledger.ts:75-148` | `buildIncomeStatement` / `buildBalanceSheet` / `buildTrialBalance` — pure functions over `BalanceRow[]`, with a balance check. |
| `src/lib/finance/ledger.ts:152-262` | `renderStatementHtml` — branded print-to-PDF statement pack. Swap `BRAND` for tenant branding. |
| `src/inngest/finance/alert-scan.ts:22-95` | Revenue-dip / expense-spike anomaly cron. Keep its two design calls: rolling 30-day windows (not calendar months) and reporting only the single worst category, to avoid alert storms. **Makes the software speak first.** |
| `src/app/api/ceo/daily-queue/route.ts:8-64` | A *persisted, resolvable* decision queue any worker can write into. AdminOS recomputes "Needs You Now" inline, so it cannot be dismissed or routed to. Keep the empty-state celebration. |
| `src/inngest/ceo/morning-brief.ts:12-22` | The second Haiku pass that parses a prose brief into a structured execution queue. One extra cheap call turns a paragraph into a checklist. |
| `src/inngest/ceo/board-deliberation.ts:15-70` | Multi-persona board deliberation. Four SA-SME personas (Accountant, Labour Lawyer, Operator, Banker) in parallel, then synthesis. Feed each the tenant's real signals so advice cites actual numbers. |
| `src/lib/finance/waterfall.ts` (whole file) + `waterfall-apply.ts` | Closes the Profit-First loop. `app/api/profit-first/route.ts:98-134` calculates allocations and nothing ever applies them. |
| `src/lib/sanyu/supply-chain.ts:125-355` | Yield-from-stock, limiting input, shopping list, **reorder schedule with projected stockout date and urgency banding**. Directly upgrades AdminOS's low-stock flag into "order from Makro by Thursday or you run out on the 14th". |
| `src/lib/sanyu/supply-chain.ts:438-490` | WhatsApp-ready supplier-grouped message builders. AdminOS already owns the channel. |
| `src/lib/marketing/banned-claims.ts:52-67` | Brand-safety gate, written as laws not examples, consumed by both the prompt and a regex test. **AdminOS drafts customer-facing messages on a business's behalf — this is a liability control, not a nicety.** |
| `src/app/finance/page.tsx:19-120` | `ProgressRing`, `DSOWidget`, `JoyAccountCard` — self-contained SVG components. |
| `.claude/memory/feedback-empire-standard.md:13` | Adopt as the build gate: *"Does this free the owner from machine work, or does it just store data? If it's just storage, it's not done."* |

**From BBOpsOS** (`OneDrive/BBOpsOS`) — patterns, not files:

| Source | What it gives |
|---|---|
| `011_checklists.sql:9-60` + `checklists/actions.ts:49-57,93-99` | Template to dated run to **item snapshot** to gated sign-off. Two non-obvious bits worth keeping: snapshot the template items into the run so editing the template never rewrites history, and refuse sign-off while items remain so the audit record cannot be falsified. The daily-ritual layer AdminOS has no answer for. |
| `010_world_class.sql:73-90` | Auto-enrol every training module on staff insert. Creating a user *is* onboarding them. |
| `compliance-item-card.tsx:21-26` | `Record<Union, {label, cls, Icon}>` status config. **Use `Record<Union,...>` not `Record<string,...>`** so adding a status breaks the build instead of silently falling through to grey. |
| `drill/actions.ts:173-257` | The full auto-remediation loop: score, assign a fix, notify managers, award XP. One user action, five system consequences, zero manager input. |

**Already done from this list:** the compliance status trigger
(`010_world_class.sql:95-114`) and the recurrence roll-forward shipped 16 Aug.

### Still-unbuilt UI for tables that already exist

The backend is repeatedly ahead of the front door — these are hours, not days:

- **`suppliers`** — full table with `bbbee_level`, `women_owned`, `youth_owned`,
  `is_community_verified`, plus a working filtered API at
  `app/api/suppliers/route.ts:30-43`. **No page, no nav entry.** The single most
  South-African differentiator in the product is invisible. ~2 h.
- **`/dashboard/staff/[id]`** — `api/staff/[id]/documents` and `/payslips` both
  exist with no page to reach them. ~half a day.
- **`/dashboard/inventory/[id]`** — `inventory_transactions` records every
  movement and nothing displays it.
- **`professional_licenses`, `safety_incidents`, `employment_equity_data`** — API
  routes, no UI at all.

### Design-system debt

Five competing colour systems (landing orange/cyan, auth navy+gold, login forest
green, signup emerald, dashboard indigo+gold), six border-radii in live use, five
shadow levels over 35 uses, and no spacing scale — 42 dashboard pages open with a
bare `p-6` and exactly one file in the repo uses a responsive padding pair. Status
colour maps are duplicated in ~10 places with raw hex bypassing the tokens in all
five cockpits. A `lib/status.ts` plus a `--space-*` token set would collapse most
of it.

---

## Session 7 — Conference prep continued (17 August 2026)

Conference confirmed for **19 August (Wednesday)** — corrected from an earlier
"tomorrow" assumption; two working days, not one.

### `/demo` re-skinned: law firm → creative/media studio

`/demo` (the flagship interactive prototype, linked 6× from the landing page)
role-played "Thabo Dlamini Attorneys." `app/page.tsx:139-143` deliberately
excludes legal (and clinic) from the industries AdminOS markets itself to —
Section 86 trust accounting is a regulatory disqualifier, not a feature gap.
The demo was contradicting that decision in the most-clicked leave-behind on
the site. Re-skinned every scripted block to **Khumalo Motion Studio** (Naledi
Khumalo, video production) — WhatsApp/LinkedIn/invoice/proposal copy, Alex's
conversations, Care's staff roles, Insight's briefs, Langa's cash-flow and
valuation answers, and the Doc agent's scanned document (now a client
production agreement flagging a footage-ownership clause conflict — an
authentic production-studio risk, not a generic reskin).

### Independent code review of session 6's diff — one real regression caught

Ran `/code-review` on `46c1f60..HEAD` rather than trusting the prior session's
self-review. Top finding was worse than it read at first: the health-page
dimension-key fix from session 6 corrected the JSON key *names* to match what
`saveHealthSnapshot` writes, but never checked what's stored *at* those keys —
`dimension_details` holds each dimension's `details` object
(`{totalGoals, futureGoals, ...}`), not its 0–100 score. With the old, wrong
keys the page silently rendered 0 (annoying, not fatal); with the corrected
keys it would have rendered an object as a React child and **crashed the page
outright** the next time someone opened it. Fixed properly this time — the
page now reads the six real numeric columns (`financial_health`,
`legal_compliance`, `people_management`, `customer_relations`,
`operational_maturity`, `strategic_readiness`) instead of `dimension_details`.

Also fixed from the same review: inventory's "stocktake adjustment" could only
ever increase stock (the API bucketed `adjust` with `receive`/`return` and
always `Math.abs()`'d the quantity) — a stocktake finding *less* stock than
the system thinks could never correct down. API now takes `adjust` as a signed
delta; the modal gained an increase/decrease toggle. `RecalculateButton` and
`GenerateHealthScoreButton` silently swallowed fetch failures — consolidated
into one `components/ui/RefreshButton.tsx` that surfaces the error instead of
fixing the same bug twice in two near-duplicate files. `EditContactModal`
never reset its form on reopen (edit, Cancel, reopen showed the abandoned
edit). `CreateInvoiceModal`'s contact deep-link could silently show a blank
dropdown for a contact outside the first 100 (alphabetical) fetched on
`/dashboard/invoices` — the contact's name now travels through the URL so the
modal can render it either way. `avatarColor()` was triplicated verbatim
across three files; extracted to `lib/ui/avatarColor.ts`.

### Bigger finding: `tenants.business_type` was never persisted by real signups

Tracing the /demo fix into the onboarding flow surfaced something larger than
a copy problem. The 16 Aug "business_type now scopes the sidebar" feature
(`e6f7740`) has likely **never actually activated for a single real tenant**.

The primary onboarding flow (Siyanda's AI chat, `app/dashboard/onboarding/
page.tsx`) asks "what type of business are you?" and uses the answer to
customise its own example content — but the answer only ever reaches
`/api/onboarding/progress`, which stores it in Supabase Auth `user_metadata`
(decorative, chat-only). `/api/onboarding/complete` doesn't touch
`tenants.business_type` either, and `/api/onboarding/create-tenant` (the
route that actually inserts the tenant row, called before Siyanda ever
greets the user) never sets it. Since `isFeatureVisible()` fails open only on
a NULL `business_type`, and every real tenant's stays NULL forever, the
industry-scoped sidebar is a silent no-op — the same "backend ahead of the
front door" class of bug as Suppliers/Licences/the health-score keys, just one
layer further upstream, and self-inflicted by session 6 shipping the
*consumer* of a field nothing ever *produces*.

Fixed: `complete()` now POSTs the mapped `business_type` to `/api/settings/
profile`. That surfaced a second bug in the process — the route
unconditionally defaulted any omitted `faqs`/`policies`/`tone`/`services`
field to `''`, so a partial-body caller (like this new one) would have
silently wiped previously-configured bot training content. Fixed to only
overwrite fields actually sent, not blank the rest.

Also discovered while fixing this: **three independent, disagreeing lists**
of "what industries does AdminOS serve" existed simultaneously —
`app/page.tsx`'s marketed 12, `lib/nav/features.ts`'s 9-value DB enum, and
`lib/onboarding/examples.ts`'s 13 human-readable labels (which included
"Legal Services" and "Healthcare / Medical Practice" — directly contradicting
`app/page.tsx`'s decision) — plus a **fourth**, `/dashboard/settings/
onboarding`'s hardcoded `<select>`, which offered **"Government /
Municipality," never a valid value of the `business_type` Postgres enum at
all.** Selecting it would fail that form with a raw Postgres error on save —
a confirmed crash bug, not a hypothetical. Fixed: removed Legal/Healthcare
from the Siyanda picker and Government (+ Legal/Clinic for consistency) from
the settings dropdown; added Creative & Media to the Siyanda picker with real
example content (production agreement, footage-ownership FAQ — the same
vertical /demo was just re-skinned to) and Logistics/Trades to the settings
dropdown, both previously missing despite being marketed.

Six labels (Cleaning, Consulting, Accounting, Creative & Media, Events,
Salons) had no dedicated `business_type` enum value and mapped to `'other'`
as a safe fallback. Nanda approved applying the migration this session —
`supabase/migrations/20260817_business_type_extend.sql` was run directly
against production via the Supabase Management API (`SUPABASE_ACCESS_TOKEN`
from `.env.local`, same mechanism as the 14 Aug Phase 0 followup migrations),
verified before (9 values) and after (15 values) with a read-only enum-range
query. Then wired through: `mapBusinessTypeToEnum()` now maps all six to
their real values; added 'Events & Hospitality' and 'Salons & Wellness' to
Siyanda's picker with real example content (previously missing from the
picker entirely, not just mismapped); extended `lib/nav/features.ts`'s
`BusinessType` type; extended the settings dropdown to match. Caught one
regression before it shipped: Creative Assets was gated on
`industries: ['other', ...]`, which is exactly what Creative & Media used to
map to — with a real `'creative'` value now in play, that gate would have
made Creative Assets *invisible* to creative/media tenants specifically, the
one segment it exists for. Fixed to `['creative', 'other', ...]`. Also added
Inventory for `cleaning`/`salons` (both manage physical consumable stock —
genuine product fit, not just consistency).

**Still open:** `safety_incidents` and `employment_equity_data` still have
APIs with no UI (same pattern, smaller scale); RESEND_API_KEY still dead
(deprioritized for the conference).

## Session 8 (2026-08-18) — Safety Incidents & Employment Equity pages

Closed the last two items on the "backend exists, no UI" punch list —
`safety_incidents` and `employment_equity_data`, both flagged since Session 7.

**Safety Incidents** (`app/dashboard/safety/page.tsx` +
`app/dashboard/safety/SafetyClient.tsx`): server component fetches
`safety_incidents` joined to `staff(full_name)` plus the tenant's staff list,
same shape as `app/dashboard/licenses/page.tsx`. Client mirrors
`LicensesClient`/`AddSupplierModal`'s structure — `DataTable` with a
colour-coded incident-type badge (near_miss/minor_injury → amber, major_injury
/fatality → red, property_damage/environmental → neutral), a type filter, and
a client-side date-range filter (two date inputs narrowing the row set before
`DataTable`'s own search/filter run — matches the GET route's `from`/`to`
params without a second round trip, same call as Licences' fully-client-side
filtering). "Report incident" modal covers the full POST schema: staff select,
date, type, description, location, comma-separated witnesses, immediate
action, root cause, corrective action, and an IOD-reported checkbox that
reveals a reference-number field. Major injury/fatality already
auto-raises a COIDA compliance item server-side (`app/api/safety/route.ts`)
— nothing to add there.

One correction made versus the pattern doc's literal suggestion: the API
embeds `staff:staff(full_name, role)` and `app/dashboard/staff/page.tsx`
selects `full_name` — but `app/dashboard/licenses/page.tsx`'s own staff query
selects a `name` column that **does not exist** on `staff`
(`supabase/schema.sql` only has `full_name`). That looks like a live bug in
the shipped Licences page, pre-existing and out of scope here — flagging it
rather than copying it forward. The new Safety page selects `id, full_name`
throughout.

**Employment Equity** (`app/dashboard/settings/employment-equity/page.tsx` +
`EmploymentEquityClient.tsx`): placed under `settings/` alongside
`settings/compliance` (POPIA) since it's the same "internal compliance data
collection" shape, not an operational list page. Server component fetches the
current year's `employment_equity_data` row (or a template if none exists
yet, mirroring `app/api/ee/route.ts`'s own GET fallback). Client has a year
selector (fetches `/api/ee?year=` on change), a 10-field race×gender
demographics grid (African/Coloured/Indian/White/Foreign × Male/Female) plus
disabled count and total workforce, a live demographics-total vs
total-workforce mismatch hint, PATCH-backed save, and a "Download EEA2
Report" button linking straight to `/api/ee/report?year=&download=true`
(new tab). Explanatory copy states plainly this is internal data collection
only — the real EEA2/EEA4 submission still goes through the DoEL's own
system.

Both wired into `lib/nav/features.ts` under **Govern**, no `industries`
restriction (universal OHS/labour-law compliance, same spine as Licences):
`Safety Incidents` (`ShieldAlert`) and `Employment Equity` (`PieChart`) —
both icons confirmed present in the installed `lucide-react` before use.
`tsc --noEmit` clean, pushed to `main`.

## Session 8 continued — tester tenant fully seeded

Wrote `scripts/seed-demo-tenant.mjs`, an idempotent (check-then-insert per
table) seed script for the QA tenant "Mzansi Test Traders"
(`c1336f9c-0617-46f2-978f-605da9ad2ebc`) — a general dealer/hardware persona
in East London. Seeded staff (9, varied job level/gender/race for EE),
contacts (14), suppliers (9, with B-BBEE levels), products (14, some below
reorder level) + inventory_transactions (16), invoices (14, all 7 live
`invoice_status` values incl. the undocumented `draft`/`sent`/`overdue`/
`cancelled` the enum actually carries in prod beyond schema.sql's four),
expenses (10), contracts (7), booking_services (3) + bookings (10), tasks
(13), goals (7), professional_licenses (6, incl. one expired, one expiring
soon), safety_incidents (6, mixed non-fatal types), employment_equity_data
(2026, demographics reconciled to the seeded staff), and two
business_health_snapshots (trend). Every row carries the tenant's UUID;
`compliance_items` untouched (already the standard 19 from
`seed_compliance_calendar`). Discovered `@supabase/supabase-js`'s import
hangs indefinitely in this shell — rewrote the script on plain `fetch()`
against PostgREST with the service-role key instead.

**Real bug found, not fixed in that session (flagged for Nanda):** `documents`
INSERT is broken for every tenant, always — the `trg_document_processing`
trigger's `fn_trigger_doc_pipeline()` reads `NEW.status`, a column that does
not exist on `documents` (the real column is `processing_status`), so
Postgres throws `42703` on any insert regardless of values. Seed script
caught this and logged the table as skipped rather than crashing the whole
run. `tsc --noEmit` clean, pushed to `main`.

### Session 9 — fixed the documents-insert trigger bug

Nanda approved the fix immediately. The corrected function already existed
*on paper* in `supabase/master_schema.sql` (commented `-- FIX: was using
NEW.status (wrong)...`) — it had just never been applied to production, and
also fixed a second latent bug in the same function nobody had hit yet:
`NEW.storage_path` (doesn't exist) → `NEW.storage_url` (the real column).
Applied that exact corrected `fn_trigger_doc_pipeline()` + trigger directly
to production via the Supabase Management API, then verified live: inserted
5 realistic documents into Mzansi Test Traders (mixed `processing_status`
values including `'processing'`, which is what fires the trigger) — the
insert that used to throw `42703` now succeeds, and `workflow_queue` shows
the correct `document_uploaded` payload with `storage_url` populated.
Codified as `supabase/migrations/20260819_fix_doc_pipeline_trigger.sql` so
it's reproducible for local dev / any future environment, not just a live
prod patch. `documents` for Mzansi Test Traders: 0 → 5.
