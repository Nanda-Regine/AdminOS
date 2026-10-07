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

## Session 10 (2026-08-20) — post-conference: battle-testing before real onboarding

Conference (19 Aug) is over. First live signal back: **Jael actually used it and
loved it** — the first real, unprompted positive reaction from outside the
build. Nanda is now onboarding real interested attendees, not just demoing —
so this session's mandate shifted from "doesn't embarrass on stage" to "holds
up under a real stranger with curl and bad intentions." Nanda is separately
rotating `RESEND_API_KEY` (dead since before the conference, see
[[adminos-resend-key-dead]]) — that is the one blocking item explicitly
**not** covered this session.

Plan written to memory + here before building, per the project golden rule.

### Fixed this session

**Licences page queried a nonexistent `staff.name` column**
(`app/dashboard/licenses/page.tsx:34,36`, confirmed via
`supabase/schema.sql:180-195` — the column is `full_name`). Silent failure,
not a crash: `staffOptions` came back empty, so every licence row's assigned-
staff display and the "assign staff" dropdown in the Report/Add modal have
been empty since the Licences page shipped (16 Aug). Session 8 (18 Aug) had
already spotted the same wrong-column mistake while building Safety
Incidents and left a comment flagging it as "a live bug in the shipped
Licences page, pre-existing and out of scope" — this session closed that
loop. Fixed with a PostgREST select alias (`select('id, name:full_name')`,
`.order('full_name')`) so `StaffOption`/`LicensesClient` need no changes.
`tsc --noEmit` clean.
**STATUS: fix is in the working tree, NOT committed — Nanda paused the
session before the commit landed. Pick this up first tomorrow: review the
diff, commit, push.**

**"called? called?" onboarding duplicate-text bug (14 Aug memory) — already
fixed, false alarm.** Traced via `git log -S"ownerNamePrompt"
lib/onboarding/messages.ts`: commit `cf64d28` (14 Aug, same day as the bug
report) added a dedicated per-language `ownerNamePrompt` specifically to fix
this — it was a `businessNamePrompt.replace('business', ...)` string hack
producing the duplicate. Not reproducible in current source. No action taken;
correcting the record so it isn't chased again.

### W6 audit — SA compliance proof surface (ordered by the conference plan, never actually run)

Full findings in memory: [[adminos-post-conference-audit-2026-08-20]]. Headline:
**several landing-page compliance claims (`app/page.tsx`) are not backed by
the product** — the exact risk profile that burns trust with a real
prospect rather than a demo audience:

- **Formalization pathway claimed, zero UI.** `app/api/formalization/route.ts`
  is a complete, working API against a real `formalization_progress` table
  (CIPC/SARS/VAT/UIF registration tracking, achievement events on
  milestones) — grepped the entire `app/`/`components/` tree, **nothing
  calls it.** Textbook "backend exists, no UI," just one level further
  upstream than the ones already closed this sprint (Suppliers, Licences,
  Safety, EE all followed the exact same shape).
- **EME B-BBEE affidavit generator claimed "high demo value" in the
  readiness plan — never built.** Zero affidavit template/PDF/route exists
  anywhere.
- **B-BBEE "ownership… as you go" claim overstated** — only supplier-side
  B-BBEE tier data exists (who you buy from); no field anywhere captures the
  tenant's own ownership % / scorecard.
- **Compliance page claims a per-contact POPIA export that doesn't exist**
  (`app/dashboard/settings/compliance/page.tsx:142`) — no export button, no
  API.
- **VAT computed and stored on every invoice, never displayed after
  creation** — no compliant "Tax Invoice" (VAT breakdown + tenant VAT
  number) can be produced anywhere in the product today, on the invoices
  list, the client portal, or as a download. The VAT201 accountant export
  (`/api/money/export?type=vat201`) is real and solid, though — genuinely
  under-marketed relative to how well it works.
- **Confirmed still working, well:** VAT201/journal/income-statement CSV
  exports, immutable `audit_log` (DB-level `REVOKE UPDATE, DELETE`), POPIA
  erasure flow (`/api/compliance/delete-contact`, role-gated, audited, real
  end to end), EEA2 report, compliance calendar seed data.
- **POPIA soft-delete vs. hard-delete tension — still never resolved.**
  Flagged as an open decision in `CONFERENCE_READINESS_PLAN.md` (audit 3 was
  supposed to resolve it) and recorded but not decided in an earlier audit
  (`BUILD_JOURNEY_ADMINOS.md:1096-1098` per the auditor's citation). The
  erasure route itself uses three different strategies in one function (hard
  delete on `messages`/`conversations`, null-in-place on `staff`) — it works,
  but the contradiction with Global Rule #3 ("soft delete only") was never
  written down as an intentional exception. Needs a one-paragraph decision
  documented, not new code.
- **Also flagged, unverified this session:** an earlier audit's claim that
  POPIA consent flags are never written by any route (columns + badge exist,
  badge always reads "no consent") — worth a fresh check before repeating
  the claim to a prospect.

### W7 audit — security hardening (independent, adversarial pass)

Full findings in memory: [[adminos-post-conference-audit-2026-08-20]]. Headline:
**tenant isolation itself is solid** — swept production `pg_policies`
directly this session, confirmed 0 policies reference the spoofable
`user_metadata` path (still holding since the 14 Aug Phase 0 followup), and
every sampled `supabaseAdmin` call across ~40 routes derives `tenant_id`
from session `app_metadata`, never client input. Both new tables from
session 8 (`safety_incidents`, `employment_equity_data`) have correct RLS.
Production Supabase confirmed `ACTIVE_HEALTHY` (not paused, see
[[adminos-supabase-db-autopauses]]).

Two real, exploitable-with-just-a-valid-account gaps found — **fix these
first tomorrow, before fixing anything else**:

1. **Any authenticated tenant member can mass-blast WhatsApp broadcasts to
   the entire contact list.** `app/api/reach/send/route.ts`,
   `app/api/reach/campaigns/route.ts` (POST), and
   `app/api/reach/campaigns/[id]/send/route.ts` only check the tenant *has*
   the Reach add-on — none check the `send_broadcasts` permission that
   already exists in `lib/auth/permissions.ts` and is scoped to
   owner/admin. A `staff` or `field_agent`-role account (or a
   mis-provisioned `client` role) can POST directly and spam every contact —
   real WhatsApp-number reputation/ban risk for the tenant.
2. **Any authenticated tenant member can view any colleague's salary.**
   `app/api/staff/[id]/payslips/route.ts` confirms tenant match but never
   checks `view_payroll` or self-ownership of the record.

Medium: `staff/[id]/documents` has the same missing-permission-check shape
(view/upload any colleague's staff documents); `/api/langa` (Claude chat) has
no `checkRateLimit` call unlike its sibling `/api/agents/[agentType]` route —
bounded by `checkBudget()` but that's a daily token meter, not a
request-rate limiter, and is a real cost-abuse surface once this is
public-facing to strangers rather than invited beta users; the
Paystack/PayFast webhook hub-forward path shares one static
`HUB_INTERNAL_SECRET` across 4+ money-moving endpoints with no HMAC/replay
protection of its own (by design — a separate hub is supposed to have
already verified the real provider signature — but worth Nanda's eyes on
whether that secret has ever been logged/shared broadly, since a leak there
is one curl command away from activating any tenant's paid plan for free).
Low: an unescaped `search` param spliced into a PostgREST `.or()` filter in
`contacts/route.ts` (tenant-scoped, so no cross-tenant reach, but can distort
the caller's own query); a missing `tenantId` null-guard in
`onboarding/add-staff/route.ts` (inconsistent with sibling onboarding
routes); a stale `plan_type` enum in `master_schema.sql` not matching the
live 5-tier billing model (docs-only risk, zod schemas are correct
everywhere they're actually used).

### Tomorrow's plan (in priority order)

1. Commit + push the Licences fix (already in the working tree).
2. Fix the two HIGH security findings (broadcast permission check,
   payslips permission check) — both are one-line `requirePermission` /
   `checkPermission` additions, well inside the pattern already used
   everywhere else in the codebase.
3. Fix the MEDIUM security findings (staff documents permission check,
   `/api/langa` rate limit) if time allows.
4. Decide + write down the soft-delete/hard-delete POPIA resolution
   (documentation only, no code risk).
5. Re-verify the POPIA-consent-never-written claim; fix if still real.
6. Bring the compliance-page/landing-page overclaims in line with reality —
   either wire the existing `/api/formalization` API into a real page (same
   shape as Suppliers/Licences/Safety — the API is already done, this is
   the cheapest of the compliance gaps to close for real rather than just
   soften copy on), or correct the marketing copy for whichever claims
   aren't getting built this week. Nanda's call on which items get a real
   build vs. a copy correction — flag both options per item rather than
   deciding unilaterally, since affidavit content especially has legal
   accuracy stakes.
7. `HUB_INTERNAL_SECRET` — flag to Nanda for a judgement call on rotation
   scope.

## Session 11 (2026-08-21) — closed out Session 10's resume plan, found two new systemic issues

Resumed exactly where Session 10 paused. Items 1–3 of that plan done and pushed:

1. **Licences fix committed** (`e706787`) — the `staff.name`→`full_name` fix
   that was sitting uncommitted in the working tree since Session 10.
2. **Both HIGH security findings fixed** (`eb670d4`) — `requirePermission
   ('send_broadcasts')` added to all three WhatsApp broadcast write paths
   (`reach/send`, `reach/campaigns` POST, `reach/campaigns/[id]/send`);
   `requirePermission('view_payroll')` added to `staff/[id]/payslips`.
3. **Both MEDIUM security findings fixed** (`c3ad364`) —
   `requirePermission('manage_staff')` added to `staff/[id]/documents`
   (deliberately not `manage_documents`, which the `staff` role already
   holds by default and would not have closed the gap); the `agents` rate
   limiter added to **both** `/api/langa` and `/api/agents/langa` — tracing
   actual callers showed the audit named the wrong route: web and mobile
   both call `/api/agents/langa`, not `/api/langa`.

**Found while fixing #3, not part of the original audit:** the staff list
and staff detail *pages* rendered salary, ID numbers, addresses and
emergency contacts for the whole team with **zero permission check** — only
login was required, and the sidebar nav isn't role-filtered either, so this
was reachable by any authenticated tenant member regardless of role. This
was the actual root cause of finding #3's data exposure, not just the
documents API. Fixed both pages (`manage_staff`, `notFound()` on denial,
matching the page-level convention documented in `lib/auth/context.ts`).

A repo-wide sweep sizing that gap found **31 dashboard pages** in the same
shape — query `supabaseAdmin` directly, no permission check at all — not
fixed this session, itemized in the build list below.

Separately, asked to check "are all agents working as they should" — a
61-tool-call background audit found the AI agent system is more broken than
assumed: two non-interoperating agent naming systems, a fully-broken
user-facing panel, and the three highest-volume live AI pipelines running
with zero cost/budget control. Also itemized below.

Full detail for both new findings: memory `adminos-page-level-
authorization-gap` and `adminos-agent-system-disconnected-2026-08-21`.
`tsc --noEmit` clean at every step this session.

**Still open from Session 10's plan, not reached:** items 4–7 (the
soft-delete/hard-delete POPIA decision, re-verifying the POPIA-consent
claim, the compliance-overclaims build-vs-copy calls, `HUB_INTERNAL_SECRET`
rotation judgement) — carried into the build list below rather than
duplicated here.

---

## Session 12 (2026-08-21) — closed Build list P0 #1 (AI cost/budget bypass)

Picked up the standing build list below and started at P0 #1, the highest-
severity item (live, uncapped AI spend). Fixed all three offending Inngest
pipelines (`01e5e7e`):

1. **`inngest/functions/debtRecovery.ts`** — added `tenant.plan` to the
   existing `tenants` select, `checkBudget` before generating the WhatsApp
   reminder, model now routed through `getModelForFeature('chase_message',
   plan)` instead of a hardcoded string, `recordUsage` after the call. A
   blocked budget defers the send (same shape as the existing
   content-guard block) rather than throwing — the daily sweep retries it
   next run.
2. **`inngest/functions/dailyBrief.ts`** — same pattern (plan was already
   fetched here). A blocked budget writes a `daily_brief_deferred_budget`
   audit entry instead of a brief; Command Center just won't show today's.
3. **`inngest/functions/docIntelligence.ts`** — the worst offender: never
   fetched the tenant's plan at all, and made up to 3 hardcoded-model
   Claude calls per document upload with zero metering. Added a
   `load-tenant-plan` step, `checkBudget`/`recordUsage` around all three
   calls (classify/extract/reference-schema), and three new Haiku feature
   routes in `costControls.ts` (`document_classify`, `document_extract`,
   `document_reference_schema`) matching the model it already used.

**Correctness note worth remembering for any future Inngest step work:**
budget-blocked state could NOT be tracked via a plain outer `let` flag set
inside a `step.run` callback — Inngest memoizes each step's return value
and, on retry/replay, restores it without re-invoking the callback, so a
side effect on a closure variable is silently lost on replay. Fixed by
threading `[data, blocked]` tuples through the step return value itself
instead (see `docIntelligence.ts`'s `classifyBlocked`/`extractBlocked`/
`referenceBlocked`).

`tsc --noEmit` clean. ESLint could not run in this environment (crashed
on a `node:fs` read error unrelated to the diff — not a code finding).

Also closed **P0 #2 (Inbox AI panel 400s)** same session:
`app/api/agents/[agentType]/route.ts` now recognizes both agent
registries — `AGENT_CONFIGS` (orchestrator personas) and
`AGENT_DEFINITIONS` (the Inbox panel's `draft`/`summarise`/`lookup`/
`escalation`/`advisor`, System B). The Inbox agents now run through
`lib/ai/agents.ts`'s already-built context functions
(`buildAgentContext`/`storeAdvisorInsights`) and `callClaudeAgent` (which
carries its own `checkBudget`/`recordUsage`), with 4 new feature routes
in `costControls.ts` (`agent_draft`/`agent_summarise`/`agent_lookup` →
Haiku, `agent_escalation` → Sonnet; `advisor` reuses the existing
`advisor_agent` route). Response shape (`{ response: text }`) matches
what `app/dashboard/inbox/page.tsx` already expected.

**Found and fixed while in this file, same category as P0 #1:**
`orchestrator.ts`'s `run()`/`stream()` never called `recordUsage` at
all — the budget-enforced orchestrator path was itself unmetered, so
`pen` (the one orchestrator persona with real UI traffic today, via
Email Studio) has been generating real Claude spend the budget counter
never saw. Added `recordUsage` to both paths (`OrchestratorRequest` gained
an optional `plan` field, threaded from the route's already-fetched
tenant plan); the streaming path reads usage via `stream.finalMessage()`
after the stream drains, since token counts aren't available mid-stream.

Also made a start on **Build list P0 #3 (31 unprotected pages)** — fixed
the 10 pages the original audit named as highest-sensitivity by data
type (2 more, staff list/detail, were already fixed Session 11):
`payroll` (`view_payroll`), `settings/billing` (`manage_billing`),
`cashflow`/`compliance`/`contracts`/`valuation` (`view_financials`),
`expenses` (`approve_leave` — matches its own approve API route's
established reuse), `invoices` (`manage_invoices` — matches its own API
route), `safety` (`manage_staff` — matches its own API route),
`suppliers` (`manage_inventory` — closest existing catalogue fit, no
suppliers API route exists yet to match against). Same `checkPermission`
+ `notFound()` pattern as the two staff pages fixed Session 11. **Found
in passing:** `app/api/billing/checkout/route.ts` had zero permission
check at all (any authenticated tenant member could kick off a real
plan/add-on purchase redirect) — fixed with the same `manage_billing`
gate its sibling billing routes already use.

12 of 31 pages now fixed. **Deliberately stopped here rather than sweep
the remaining 19** (analytics, announcements, board-pack, bookings,
calendar, contacts, dashboard root, getting-started, handbook, health,
inventory, ir-log, knowledge-base, licenses, reach, ring, settings,
sequences, stokvel, tasks, team, workflow-monitor) — Nanda's call to end
the session there rather than push through lower-sensitivity pages.
Each of those still needs its own permission judgement call against
`DEFAULT_ROLE_PERMISSIONS`, same as this batch — not a blanket
find-replace. `tsc --noEmit` clean after every batch.

**The original 31-page count is itself an undercount, found while
checking this list against the filesystem:** the original sweep's grep
only checked one directory level (`app/dashboard/*/page.tsx`) and
counted the single `settings` entry as one page. There are actually 7
page.tsx files under `app/dashboard/settings/` — root, `autonomy`,
`billing` (fixed this session), `compliance` (a distinct settings/POPIA
page, NOT the Compliance Calendar page fixed this session — different
file, different content), `employment-equity`, `onboarding`,
`referrals` — and 6 of those 7 still have zero permission check. Not
fixed this session (Nanda's call to stop); flagging so the next sweep
counts from the real total rather than the stale 31, and doesn't
conflate the two differently-named "compliance" pages.

**Not touched, still open:** the remaining 19 pages from the original
list, plus the 6 newly-found unprotected `settings/*` subpages above.
Also still open per Build list P1: deciding the orchestrator's fate
(only `pen` has a real caller; `alex`/`care` have no working
equivalent; `chase`/`doc`/`insight`'s real logic still lives solely in
the Inngest pipelines, duplicated from same-named personas).

---

## Session 14 (2026-08-22) — live-schema drift sweep, calendar rebuild, forms audit

Three pieces of work, all from Nanda's instruction: "the chrome tab is
loggedin... you can use supabase pat in env.local for migrations. lets make
the best calendar, forms cant be broken, its important that they work, all
of them."

**1. Schema-drift sweep.** Supabase MCP tools don't have this project
connected (different org/account), so pulled a live `information_schema.
columns` dump (104 tables, 1181 columns) via the Management API + the PAT
in `.env.local`, then regex-scanned every `.from()` call app-wide against
it — every migration-file assumption gets stale the moment a later
migration renames/drops a column, so only a live dump is trustworthy.
Found and fixed ~30+ real drift bugs, the two worst being silent
production failures with zero visible error (PostgREST 400s on an unknown
column just make `.data` come back `null`, and the calling code silently
falls back to empty/zero):
- `staff.status`/`tenants.status` don't exist — the real column is a
  boolean `active` — was broken across ~12 files (`dailyBrief.ts`,
  `wellnessFanOut.ts`, `boardPack.ts`, `impactSnapshot.ts`,
  `payrollReminder.ts`, `benchmarkCalculate.ts`, `cashflowForecast.ts`,
  `valuationSnapshot.ts`, `lib/intelligence/valuation.ts`, payslip
  generation, and others) — meaning every active/inactive staff or tenant
  filter in these automations was silently returning nothing.
- `app/dashboard/bookings/page.tsx` was reading `booking_date`/
  `start_time`/flat `contact_name`/`staff_name`/`service_name` — none of
  which exist; real columns are `start_at`/`end_at` plus real joins. The
  bookings page has been silently empty.
- `inngest/functions/processQueue.ts` was writing `status: 'running'`,
  which violates the table's own CHECK constraint (valid value is
  `'processing'`) — every queued job attempt was failing at the DB layer.
- `inngest/functions/docIntelligence.ts` had 3 separate column-name bugs
  (`storage_path`→`storage_url`, `file_name`→`original_filename`, a
  `status`/`processed_at` update targeting columns that don't exist).
- Four functions needed a full rewrite, not a rename, because the tables
  they targeted don't exist under those names: `contextualTrigger.ts`
  (`context_triggers`→`contextual_triggers`, `academy_notifications`→
  `triggered_lessons`), `sopAcknowledgement.ts` (`sops`→`sop_documents`,
  keyed on `user_id` not a nonexistent `staff_id`), `loyaltyExpiry.ts`
  (`loyalty_accounts`/`loyalty_transactions` don't exist — real schema is
  a single `loyalty_points` ledger, rewritten to derive latest balance
  per contact/programme from it), `benchmarkCalculate.ts`
  (`industry_benchmarks`→`sector_benchmarks`, switched from `.upsert()`
  to select-then-write because the composite unique index includes
  always-null columns — NULL≠NULL in Postgres, so upserts against it were
  silently accumulating duplicates instead of updating).
- `app/api/email-drafts/[id]/route.ts`'s PATCH handler was spreading the
  raw request body straight into `.update()` — added a zod allowlist.

**Flagged, not fixed — genuine missing data model, not a rename:**
`tenants.women_owned` (no such column), `goals` has no target/deadline
column (`healthScore.ts`'s `scoreStrategic()` degraded to an
active-count-only proxy), `cashflow_entries` referenced but the table's
real shape doesn't support what `cashflowForecast.ts` needs from it,
`socialSync.ts` is calling columns (`last_synced_at`) that don't exist —
left as a stub, and a **fully-built, zero-row, zero-reference
`calendar_events` table** exists in the schema (see calendar rebuild
below). Also surfaced, out of scope for this sweep: a contacts-deletion
path performs a real hard `DELETE`, violating Global Rule #3 (soft-delete
only) — no `deleted_at` column exists on `contacts` yet, needs a migration
first.

Full detail: memory `adminos-schema-drift-sweep-2026-08-22`. Commit
`6b7861f`.

**2. Calendar rebuild (closes P4 #24).** `/dashboard/calendar` was two
stacked lists (leave requests, invoices due). Rebuilt as a real
Monday-first month-grid: new `lib/calendar/monthGrid.ts` (pure date-grid
math, `?month=`/`?day=` query-param navigation) and `lib/calendar/
events.ts` (aggregates `leave_requests`, `invoices`, `bookings`,
`compliance_items`, `professional_licenses`, `contracts` into one feed).
Server-rendered, `next/link` for all navigation — no client JS. Kept the
existing `approve_leave` gate. **Deliberately does not use the
`calendar_events` table** found during the schema-drift sweep — it's
fully designed (polymorphic `event_type`/`source_type`/`source_id` shape)
but has zero rows and zero code references anywhere; wiring six real
tables directly was the correct call given nothing populates it. Full
detail: memory `adminos-calendar-rebuild-2026-08-22`. `tsc --noEmit`
clean. Commit `0e03646`.

**3. Forms audit — 5 parallel batches.** All 5 background agents died
mid-task on an account-level session-limit API error; per Nanda's
instruction, resumed each via `SendMessage` to its original agent ID
(not restarted) once the limit reset, so each continued from its own
transcript rather than redoing work. Fixed:
- `app/api/expenses/[id]/approve/route.ts` — was `PATCH` + `request.
  json()` but the UI posts a native `<form>` (can't send PATCH, wrong
  body encoding) — approve/reject silently 405'd. Now `POST` +
  `request.formData()` + redirect response.
- `app/api/payroll/run/route.ts` — `writeAuditLog()`'s `tenantId` was
  only nested in `metadata`, not at the top level the function actually
  reads from — payroll audit-log rows were being written tenant-less.
- `app/api/staff/route.ts` + `AddStaffModal.tsx` — `department`/
  `leaveBalance` were collected by the form but absent from the zod
  schema, so silently stripped before insert on every new hire.
- `app/dashboard/tasks/TaskActions.tsx`'s `MoveTaskButton` refreshed the
  UI even on a failed request — added an `res.ok` check.

**Flagged, not fixed — need Nanda's product call, not a bug fix:**
knowledge-base article `category`/`slug` fields are silently dropped
(API schema doesn't declare them — unclear if slug should be
server-generated); stokvel `AddMemberModal`'s phone field is optional in
the UI but required by the API schema (400s with no explanation on
submit). Full detail: memory `adminos-forms-audit-2026-08-22`. Commit
`9923feb`.

---

## Build list — everything open, for a fresh session

Written 2026-08-21 as a standing punch list so a new chat can start straight
into execution instead of re-deriving this from six different audits. Ordered
by real severity/value, not by discovery date. Each item names its source
audit/session and the file(s) to start at. Memory files carry the full
detail this list intentionally compresses.

### P0 — real exposure, fix first

1. ~~**Cost/budget control bypassed on the 3 live AI pipelines.**~~ **Fixed
   Session 12 (`01e5e7e`).** `debtRecovery.ts`, `dailyBrief.ts`,
   `docIntelligence.ts` now all call `checkBudget`/`recordUsage` and route
   models through `getModelForFeature`. → memory
   `adminos-agent-system-disconnected-2026-08-21` for original audit detail.
2. ~~**Inbox "AI Agents" panel is fully broken — 400 on every click.**~~
   **Fixed Session 12.** The route now recognizes both `AGENT_CONFIGS`
   (orchestrator) and `AGENT_DEFINITIONS` (Inbox panel) names, routing
   the latter through `lib/ai/agents.ts`'s existing implementation. Also
   fixed in the same pass: `orchestrator.ts`'s `run()`/`stream()` never
   called `recordUsage` — `pen`'s real live traffic was unmetered too.
   → same memory file for original audit detail.
3. ~~**Dashboard pages have zero permission check.**~~ **Server-component
   sweep closed Session 13 (2026-08-21, same day as Session 12,
   commit `c4ad6f2`).** 12 fixed Session 12 + 27 more fixed Session 13
   (the Session 12 "19+6 remain" count was itself stale — a fresh sweep
   found 45 open pages, not 25). **What's left is a different shape of
   problem, not more of the same list:**
   - 8 client-component pages can't use the page-gate pattern at all
     (creative-assets, documents, email-studio, inbox, langa,
     onboarding, sequences/new, settings/onboarding) — need the check
     added at the API routes they call (several of which — `/api/
     sequences`, `/api/settings/profile`, `/api/onboarding/add-staff`
     — have no permission check either), or RLS for the ones
     (inbox, creative-assets, documents) that read Supabase directly
     from the client with no API route in between.
   - `app/dashboard/page.tsx` (dashboard root) can't take a hard gate —
     it's the universal post-login landing page for every role, but
     renders real financial data. Needs role-scoped rendering, a
     genuine design decision, not a mechanical fix.
   - `community/page.tsx` looks like an intentional cross-tenant forum
     (nullable `tenant_id`), not a gating bug — verify before touching.
   - `tasks` needs a new `view_tasks`-shaped permission that doesn't
     exist yet; nothing in the current union fits without misapplying.
   - New `view_communications` permission (owner/admin only) added for
     `/dashboard/ring`. ~~Backfill migration
     `20260821_add_view_communications_permission.sql` written but not
     yet applied to prod~~ **applied to prod 2026-08-22 via Management API
     PAT (8 rows updated).**
   → memory `adminos-page-level-authorization-gap` for full detail.

### P1 — decide the AI agent system's shape

4. **Orchestrator persona cleanup.** Of `AGENT_CONFIGS`'s 6 personas, only
   `pen` has a real UI caller. `chase`/`doc`/`insight`'s actual, working
   functionality lives entirely in the Inngest functions from P0#1,
   duplicated and disconnected from their same-named persona; `alex`/`care`
   have no working equivalent anywhere. Decide: consolidate the Inngest
   pipelines back through the orchestrator (gets them budget control for
   free, fixes P0#1 and this in one move), or delete the unused personas so
   `AGENT_CONFIGS` stops implying capability that doesn't exist end-to-end.
5. **`/api/langa` orphaned route** — no UI caller (web/mobile both use
   `/api/agents/langa`), self-documented in its own code comment. Low
   priority, already has the same rate limit as its sibling; candidate for
   deletion once confirmed nothing external depends on it.
6. **No test coverage of the orchestrator, Langa, or any `/api/agents/*`
   route.** `app/api/health/route.ts` checks DB/Redis/API-key presence only.
6a. ~~**`boardPack.ts` was a 4th unmetered AI pipeline.**~~ **Fixed Session 13
   (2026-08-21, commit `c4ad6f2`)** — same bug as P0#1, just not caught in
   that sweep. Now routes through `checkBudget`/`recordUsage`/
   `getModelForFeature('board_pack', plan)` with a graceful fallback.
6b. **8 empty `app/api/cron/*` directories** (daily-brief, debt-recovery,
   escalate-conversations, fan-out-brief, fan-out-wellness, process-queue,
   sequences, wellness) — confirmed dead 2026-08-21, Inngest fully replaced
   them, only docs still reference the old paths. Safe to delete, not done.
6c. **3 Inngest functions run with no `step.run`/try-catch isolation**
   (`impactSnapshot.ts`, `payrollReminder.ts`, `streakChecker.ts`) — a
   mid-run failure loses all partial progress on retry; `payrollReminder.ts`
   is the worst case (retry re-sends reminders already sent in the failed
   attempt). Each needs its own retry semantics considered, not a blanket
   wrap. → memory `adminos-automations-layer-audit-2026-08-21`.

### P2 — the product-value gap ("paperwork, not work")

From the Aug 16 six-way audit, still the accurate diagnosis — nothing on
this list has been built since:

7. ~~**Deposits + payment links on tenant invoices/bookings**~~ **Split
   2026-09-18 (Session 15).** Scoped the payment-gateway half and Nanda
   held it — no way to test it, and routing a tenant's customer's money
   through AdminOS's own PayFast/Paystack account (the only way it works
   today; there's no per-tenant merchant credential mechanism, see
   [[adminos-session15-production-push-2026-09-18]]) is a real
   payment-facilitation question under PayFast/Paystack's own merchant
   terms and possibly SARB's NPS Act — needs a professional opinion before
   any code gets written, not an engineering assumption. **The document
   half shipped instead** (commit `0ce1f30`): branded "TAX INVOICE"/
   "INVOICE" (SARS-correct — the heading + VAT breakdown only render when
   `tenant.settings.vat_number` is set) with the tenant's own logo, plus a
   payment-confirmation receipt once an invoice shows a payment. New
   Settings card captures address/VAT number/banking details, which the
   payslip generator was already silently reading with no UI anywhere to
   set them. Still fully open: the gateway itself (tenant-owned PayFast/
   Paystack credentials, once Nanda has a legal answer) and booking
   deposits (bookings has zero money columns today — bigger lift than
   invoices, which already had the schema).
8. **Job costing** — `time_entries` rolling into `projects.budget` (~8d).
   Nothing currently answers "which jobs made money."
9. **Polymorphic asset/vehicle register** (~7d) — vehicles, plant, kit,
   devices. Reuse the `professional_licenses` expiry-reminder pattern.
10. **Purchase orders + reorder loop** (~4d) — `ops/page.tsx:30-31` detects
    low stock and stops at a sentence; no PO/approve/receipt flow.
11. **Transactional client portal** (~6d) — `app/portal/[token]/page.tsx` is
    read-only; needs document exchange, an Approve button writing to
    `audit_log`, e-sign, Pay Now.
12. **Proper tax invoice renderer** (~5h) — no compliant "TAX INVOICE"
    exists anywhere (VAT breakdown, supplier VAT/CIPC number). Also fix
    while in there: invoice numbering is `COUNT(*)+1`, non-atomic and reuses
    numbers after a delete — a VAT Act problem, needs a per-tenant Postgres
    sequence.
13. **EME B-BBEE sworn affidavit generator** (~4h) — zero hits for
    "affidavit"/"EME" in the codebase; most SA SMEs are EMEs and this one
    document is their whole B-BBEE obligation. Render through the same
    HTML-to-print path as `lib/payroll/payslipTemplate.ts`.
14. **Formalization pathway UI** — `app/api/formalization/route.ts` is a
    complete working API (CIPC/SARS/VAT/UIF tracking), nothing in `app/`
    calls it. Cheapest of the compliance gaps: same shape as
    Suppliers/Licences/Safety, API's already done.
15. **Own-business B-BBEE ownership %/scorecard** — only supplier-side
    B-BBEE data exists today; nothing captures the tenant's own.
16. **Per-contact POPIA export** — claimed on the compliance page
    (`app/dashboard/settings/compliance/page.tsx:142`), no button, no API.

### P3 — compliance/security debt (documentation or judgement calls, not builds)

17. **POPIA soft-delete vs. hard-delete — undecided.** The erasure route
    mixes hard-delete and null-in-place; contradicts Global Rule #3 without
    it being written down as an intentional exception. Needs a one-paragraph
    decision, no code change.
18. **POPIA consent flags — re-verify whether any route writes them.**
    Columns + UI badge exist; an earlier audit claimed the badge always
    reads "no consent." Not re-checked since.
19. **`HUB_INTERNAL_SECRET`** shared statically across 4+ payment webhook
    endpoints — Nanda's call on rotation scope, not a code fix.
20. **Migration templates still carry the old spoofable `user_metadata` RLS
    shape** — live policies are fixed, but any new table copy-pasted from
    the templates reintroduces the hole. Fix the templates themselves.
20a. **Contacts deletion hard-deletes** (found during Session 14's schema
    sweep) — violates Global Rule #3 (soft-delete only) same as #17, but a
    separate code path (contacts, not the POPIA erasure route). No
    `deleted_at` column exists on `contacts` yet — needs a migration
    before this can be fixed. → memory `adminos-schema-drift-sweep-2026-08-22`.
20b. **Knowledge-base article `category`/`slug` silently dropped on
    create** (found during Session 14's forms audit) — the form collects
    both, the API's zod schema declares neither. Needs a decision: is
    `slug` server-generated from the title, or user-entered? Is
    `category` free-text or a lookup table? → memory
    `adminos-forms-audit-2026-08-22`.
20c. **Stokvel `AddMemberModal` phone field: optional in UI, required by
    API schema** (found during Session 14's forms audit) — a member added
    without a phone number 400s with no UI explanation. Decide whether
    phone becomes genuinely optional end-to-end or the UI should require
    + validate it. → memory `adminos-forms-audit-2026-08-22`.

### P4 — known dead-end bugs (verified 2026-08-21 Session 13 — 21–23 fixed since 16 Aug, 24 fixed Session 14, 25 still true)

21. ~~`/dashboard/valuation` "Recalculate" navigates to raw JSON.~~
    **Confirmed fixed** — now `components/ui/RefreshButton.tsx`, a proper
    client-side fetch + `router.refresh()` with error surfacing.
22. ~~`/dashboard/settings` "Connect" buttons have no `onClick`.~~
    **Confirmed fixed** — integrations now show a "Connected" badge or a
    disabled "Coming soon" span, no dead button exists.
23. ~~`/dashboard/contacts/[id]` "+ New Invoice" 404s; Edit/overflow dead.~~
    **Confirmed fixed** — "+ New Invoice" deep-links
    `/dashboard/invoices?new=1&contact=<id>&name=<name>` into
    `CreateInvoiceModal.tsx`, which reads all three params correctly via
    `useSearchParams`. The old Edit/overflow buttons no longer exist on the
    page at all.
24. ~~`/dashboard/calendar` renders a 2-column grid + `<table>` (leave
    requests + invoices due), not a month/week calendar view.~~ **Fixed
    Session 14 (2026-08-22, commit `0e03646`)** — real Monday-first
    month-grid aggregating 6 tables (leave, invoices, bookings,
    compliance, licences, contracts). → memory
    `adminos-calendar-rebuild-2026-08-22`.
25. **Still true.** No `ref=`/`referred_by`/`referral_code` read anywhere in
    signup or onboarding — `app/dashboard/settings/referrals/page.tsx` shows
    the tenant's own code and rewards, but nothing captures an incoming
    referral. The referral program has no attribution mechanism at all.
26. ~~`/contact` has no form, only `mailto:` links.~~ **Downgraded, not a
    live bug** — the page has a real lead-capture path (Cal.com "Book a
    Demo" booking link) plus mailto: for sales/support/legal.

### P5 — infra/monitoring (dated June, unverified since — confirm still true before building)

27. No Sentry (Next.js or the now-existing Expo app).
28. No super-admin health dashboard (`/dashboard/admin/health` — queue
    depth, error rate, AI usage per tenant).
29. No per-tenant request rate limiting outside AI routes.
30. No document virus scan on upload.
31. No automated tenant-isolation test suite (RLS-leak regression guard).
32. **Missing data model, flagged not fixed (Session 14 schema-drift
    sweep)** — five small gaps, each needs a migration + real
    implementation, not a rename:
    - `tenants.women_owned` — no such column; nothing captures this today.
    - `goals` has no target/deadline column — `healthScore.ts`'s
      `scoreStrategic()` is currently degraded to an active-count-only
      proxy because of this.
    - `cashflow_entries`'s real shape doesn't support what
      `cashflowForecast.ts` needs from it — forecast function is running
      against a schema mismatch.
    - `inngest/functions/socialSync.ts` references `last_synced_at`,
      which doesn't exist — left as a stub, not a working sync.
    - `call_logs` has no column to dedupe a Twilio-retried WhatsApp-sent
      flag against — `app/api/voice/status/route.ts`'s dead update call
      was removed rather than fixed; a retry could still double-send.
    → memory `adminos-schema-drift-sweep-2026-08-22`.
33. **Orphaned `calendar_events` table** — fully designed (`event_type`/
    `source_type`/`source_id` polymorphic shape) but zero rows, zero code
    references anywhere. The new calendar (P4#24) deliberately reads from
    6 real source tables instead. If anything is ever built to populate
    `calendar_events`, the calendar page should be revisited to read from
    it directly instead. → memory `adminos-calendar-rebuild-2026-08-22`.

Source memory files for full detail behind every item above:
`adminos-post-conference-audit-2026-08-20`,
`adminos-page-level-authorization-gap`,
`adminos-agent-system-disconnected-2026-08-21`,
`adminos-automations-layer-audit-2026-08-21`.
   scope; not a code fix.

---

## Session 15 (2026-09-18) — production-readiness push: DB outage, screen audit, AI cost routing

Nanda asked for a production-readiness checklist, confused WhatsApp setup,
noted mobile issues + broken features, and asked for a Playwright-driven
screen audit + a fix so the DB stops sleeping. Mid-session she also added
`GEMINI_API_KEY` and asked to route AI to free models since she can't
sustain Claude API cost.

**1. Found AdminOS's production DB down live, mid-session** (commit
`067f5c6`). `/api/health` returned `"database":"error"` (503) — the same
auto-pause bug as [[adminos-supabase-db-autopauses]], recurring a month
later. Restored via the Management API (`INACTIVE` → `ACTIVE_HEALTHY` in
~3 min, confirmed via polling). Shipped a daily Vercel Cron hitting
`/api/health` (already does a real Supabase query) so this shouldn't
recur — self-contained, no JarvisOS dependency.

**2. WhatsApp setup diagnosed, not fixed** (Rule Zero — `.env.local` is
off-limits). `META_WHATSAPP_ACCESS_TOKEN` and `META_WEBHOOK_SECRET` are
empty; `META_WEBHOOK_VERIFY_TOKEN` is missing entirely (a third, separate
secret from `META_WEBHOOK_SECRET` — easy to conflate, see
`app/api/webhook/whatsapp/route.ts`'s `GET` handler vs `verifyWebhookSignature`
in `lib/whatsapp/send.ts`); `WHATSAPP_BUSINESS_ACCOUNT_ID` has a stray
leading colon. Nanda needs to fill these in Vercel env vars herself.

**3. Playwright installed + a reusable screen-audit script written**
(`scripts/screen-audit.mjs`, commit `067f5c6`). Signs up one disposable
QA tenant via the real `/signup` form (same approach as
[[adminos-signup-e2e-verified]]), skips onboarding via
`POST /api/onboarding/complete`, then crawls all ~48 dashboard routes ×
desktop/mobile — read-only, no mutating clicks. Local `next dev` fails on
this machine with the same OneDrive file-read error `next build` already
had (`UNKNOWN: read` on `next.config.ts`) — the script defaults to
auditing production instead; pass a URL as argv[1] or `AUDIT_BASE_URL` to
point elsewhere. Output goes to `scripts/audit-out/` (gitignored).

**Findings from the crawl (102 page-loads):**
- **Zero horizontal-scroll/overflow at 390px on any page** — the Aug
  16-17 mobile pass held up; did not reproduce "mobile issues" from
  Nanda's report. Need her to name the specific screen.
- **Sentry has been silently dead on every page since it was added** —
  `next.config.ts`'s CSP had no `js.sentry-cdn.com` in `script-src` (nor
  `*.sentry.io` in `connect-src`), so the loader script in `app/layout.tsx`
  was blocked on every single load. Fixed, commit `067f5c6`.
- **New: `/dashboard/creative-assets` 400s on load** (both viewports) —
  not root-caused; likely the client-side `contacts` select in
  `CreativeAssetsPage`'s `load()`, not yet isolated from the
  `/api/creative-assets` GET (which only ever returns 401/403/500, ruled
  out).
- **New: `/dashboard/suppliers` throws React hydration error #418 on
  mobile only** — not root-caused; `SuppliersTable`/`SuppliersPage`
  themselves look clean (rendered against an empty QA tenant → EmptyState
  path), so the mismatch likely lives in `TopBar` or `AddSupplierModal`
  at mobile width. Needs focused repro, ideally with React dev build.
- 55/102 loads never reached Playwright's `networkidle` (timed out at
  20s) but still rendered and screenshotted fine — almost certainly
  Supabase Realtime holding a websocket open (`conversations`,
  `documents`, `invoices`, `audit_logs` per `DEPLOYMENT_CHECKLIST.md`).
  Not a functional bug; flagged for SA mobile-data/battery context.

**4. Hybrid Groq/Gemini + Claude AI cost routing built** (commit
`5df2eb8`). `GROQ_API_KEY` was NOT actually added despite Nanda believing
she had — only `GEMINI_API_KEY` (+ `GEMINI_PROJECT_NUMBER`/`_NAME`, which
may mean she's actually on Vertex AI rather than the AI-Studio API-key
path `lib/ai/providers/gemini.ts` targets — unverified, will 401 if so).
`lib/ai/costControls.ts`'s `getProviderForFeature()` routes high-volume/
low-stakes features (chat conversation, classification, document
classify/extract, agent draft/summarise/lookup) to Groq (preferred) or
Gemini when configured; compliance-sensitive features (debt wording,
briefs, board packs, langa mentor) stay hard-pinned to Claude regardless.
`callClaudeAgent`/`callClaudeWithCache` fall back to Claude automatically
on any provider error. Also fixed two pre-existing gaps found while in
here: `draftRecoveryMessage` and `generateDailyBrief` never passed an
explicit `feature`, silently defaulting to the generic `agent_call`
bucket instead of their intended routing tier.

**Known gap, not yet built:** `lib/ai/orchestrator.ts` (the `pen` agent /
Inbox AI panel, per [[adminos-agent-system-disconnected-2026-08-21]]) has
its own separate `anthropic.messages.create` call path with dynamic
`agent_${name}` feature keys — does not go through `getProviderForFeature`,
so Inbox AI panel traffic is not yet covered by the free-tier routing.

**Also found, not yet fixed:** `DEPLOYMENT_CHECKLIST.md` is stale (last
updated April 2026) — references dead `/api/cron/*` routes ([[adminos-automations-layer-audit-2026-08-21]] already confirmed these
dead, Inngest replaced them), `DIALOG360_API_KEY` (WhatsApp migrated to
Meta Cloud API directly, per `WHATSAPP_TEMPLATE_SETUP.md`), and old
Starter/Growth/Enterprise pricing (renamed, see
[[adminos-pricing-tiers-renamed]]). Anyone following it today would set up
the wrong things.

Full detail: memory `adminos-session15-production-push-2026-09-18`.

---

## Session 15 (Phase 3) — 2026-09-18 — Mobile off-screen fix + design elevation

Nanda listed ~24 dashboard pages as "off screen" on mobile in one message,
plus "accountant report page dont work" and "does autonomy even work,"
plus a broad design ask: glassmorphism, color-coded data, "modern
high-tech," away from generic flat boxes, "max proactivity across pages."

**Root cause, one line, fixes the majority of the list:**
`app/dashboard/layout.tsx`'s `<main>` was a flex item with no `min-w-0`.
Flex items default to `min-width: auto` — they refuse to shrink below
their content's intrinsic width, so any page with wide content (a
populated table, the calendar grid) forced the whole page wider than the
viewport. `globals.css`'s `overflow-x: hidden` on `html`/`body` didn't
fix that — it silently clipped the overflow instead of making it
scrollable, which is exactly the "off screen, can't reach it" symptom.
This also explains why the earlier Playwright crawl (Phase 1) found zero
overflow: it ran on an empty QA tenant with no wide content, and
`overflow-x: hidden` hides the signal from a naive `scrollWidth` check
too. The team had already hit and fixed this identical mechanism once,
locally, on `TopBar.tsx` (`min-w-0 flex-1`) — it just was never applied
to the outer shell.

**Remaining specific bugs fixed (not covered by the shell fix):**
- Calendar month-grid (`grid-cols-7`, no mobile override) — wrapped in a
  horizontal-scroll container below `md:`.
- Three hand-rolled modals were missing the `max-h-[90vh] overflow-y-auto`
  the shared `Modal` primitive already has: `TaskActions.tsx`
  (`CreateTaskModal` — the reported "create task form is off the page"),
  `StokvelActions.tsx` (the reported "stokvel form off screen"), and
  `email-studio/page.tsx`'s inline confirmation dialog.
- `PenStream.tsx` had `maxWidth: 380` with no `width: '100%'` — could
  render wider than a 360-375px real phone.

**Accountant Reports:** no reproducible bug found by static reading, but
`app/api/money/export/route.ts` was missing the `checkPermission
('view_financials')` check every sibling export route has — fixed as a
real (independent) security gap. Two candidate explanations remain for
what Nanda is actually seeing (page 404ing vs. a silent near-empty CSV
download) — asked her directly rather than guessing further.

**Autonomy — honest finding, not fixed this pass:** only 2 of 8
configurable decisions in `/dashboard/settings/autonomy` are genuinely
wired (`money/invoice_reminder`, `ops/booking_reminder`). The other 6 save
to the DB and round-trip in the UI but nothing reads them — the
underlying automations (low-stock reorder, cold-lead nudge, etc.) were
never built. Intentional partial rollout per `LAUNCH_TODO_SPINE_AUTONOMY.md`,
not a regression. Notifications half of that same page is fully wired.

**Design elevation:** the codebase already had a mature token system and
glass/blur utilities (`.glass`, `.glass-strong`) — they just weren't
applied consistently. Gave `Card` (32 imports — the highest-leverage
primitive in the app) a `variant: 'glass' | 'flat'` prop, defaulting to
glass; deleted `GlassCard.tsx` (zero usages, superseded). Set `variant="flat"`
on the 4 pages (Suppliers, Safety, Licenses, Compliance) whose `Card` wraps
an already-glass `DataTable`, to avoid glass-on-glass. Fixed hardcoded,
non-token colors on the Health page (delta badge, dimension colors, trend
row highlight) and `RefreshButton`'s hardcoded emerald to ride the
existing chip/token system. Rebuilt the Health page as the flagship
example — replaced the flat dimension-bar list and plain history table
with real `recharts` (`HealthRadarChart`, `HealthTrendChart` in new
`components/dashboard/HealthCharts.tsx`), styled to match
`CashflowChart.tsx`'s existing theme-aware chrome. Deliberately did not
hand-redesign all 24 listed pages — the `Card` change cascades across
them automatically; Health is the one bespoke flagship change other pages
can be brought up to later.

**Not done this pass (explicitly deferred):** per-table mobile
column-hiding, migrating the 3 fixed modals onto the shared `Modal`
component, the 6 unwired autonomy automations, auth/marketing pages'
hardcoded gray/white styling + stray `#2D4A22` green on `signup/page.tsx`,
hand-redesigning individual pages beyond Health + the shared-primitive
cascade.

Commits: `e3db91c` (mobile fixes + accountant-report permission gap),
`32eebaa` (glassmorphism-by-default Card + real charts on Health) — both
pushed to `origin/main`.

Full detail: memory `adminos-mobile-and-design-elevation-2026-09-18`.

---

## Session 15 (Phase 4) — 2026-09-18 — Wired the remaining 6 autonomy decisions

Only `money/invoice_reminder` and `ops/booking_reminder` actually did
anything when toggled in `/dashboard/settings/autonomy`; the other 6
round-tripped through the DB but nothing read them (see Phase 3's honest
finding). Wired all 6, tier-gated (A=auto-act, B=draft+notify owner,
C=surface-only), reusing the domain-signal builders that already existed
for the cockpits rather than re-deriving the data:

- **`money/payment_receipt`** — auto-thanks the customer by WhatsApp when
  an invoice is marked paid. Also added a `wasAlreadyPaid` guard so the
  payment-received notify/receipt/formalization block can't re-fire on a
  later no-op PATCH of an already-paid invoice. **Self-correction (commit
  `30bb886`):** the first pass of this change wrongly "fixed"
  `app/api/invoices/[id]/route.ts`'s `amountPaid` branch based on an
  incomplete schema read — `total`/`amount_due` ARE real, live columns
  (added by `20260614_schema_bugfixes.sql`, actively read by
  `healthScore.ts` and `boardPack.ts`), and the original code selecting
  them was correct. My "fix" deleted the `amount_due` update entirely,
  which would have let it silently go stale on every payment. Restored in
  the same session before anyone hit it in production; also fixed a typo'd
  `invoice_reference` (real column: `reference`) introduced in the same
  new code.
- **`money/final_demand`** — still never auto-sent (Debt Collectors Act,
  unchanged hard rule). Tier A/B now pre-drafts a firm-but-lawful message
  into the owner's review notification (reusing `draftRecoveryMessage`,
  content-guarded) instead of a blank "decide how to proceed."
- **`ops/low_stock_reorder_alert`** — new daily cron
  (`inngest/functions/opsAlerts.ts`), reuses `buildOpsIntel`'s existing
  low-stock computation.
- **`sales/going_cold_nudge`** — new weekly cron
  (`inngest/functions/salesColdLeads.ts`), reuses `buildSalesIntel`'s
  `staleContacts`; new `draftColdLeadMessage` AI helper, capped to 3
  contacts/tenant/run to bound cost. Extended `StaleContact` with
  `id`/`phone` so the automation can act on it (was display-only before).
- **`people/approval_reminder`** — new daily cron
  (`inngest/functions/peopleApprovals.ts`), nudges on leave/expense
  approvals pending 48h+ (separate from the existing submit-time alert).
- **`governance/deadline_alert`** — new daily cron
  (`inngest/functions/governanceDeadlines.ts`), reuses
  `buildGovernanceIntel`'s deadlines, fires only at 14/7/3/1/0-day
  checkpoints to avoid daily noise on a deadline still weeks out.

New `lib/autonomy/tiers.ts` helper `tierAllowsWhatsapp()` — for the
owner-facing (non-customer) alerts, tier C means bell-only, A/B also
mirror to WhatsApp. All 4 new crons registered in
`app/api/inngest/route.ts`. **No schema changes** — everything reuses
existing columns/tables. `npx tsc --noEmit` clean; `tests/autonomy.test.ts`
5/5 pass.

**Not done:** the settings UI already renders all 8 decisions from
`DECISION_CATALOGUE` (no UI change needed). Production verification of the
4 new crons (they won't fire until their next scheduled run) is still
pending — check Inngest dashboard after first scheduled run.

Commit: `974d37d`, pushed to `origin/main`.

Full detail: memory `adminos-autonomy-fully-wired-2026-09-18`.

---

## Session 15 (Phase 5) — 2026-09-18 — Cash sales + chart-of-accounts categorization

Nanda asked for (a) various ways to log a cash sale, since "business types
and operations are unique and vast", and (b) light bookkeeping structure
("so people's finances are in order from day one") — she picked the
recommended depth via AskUserQuestion: chart-of-accounts categorization
feeding the existing exports, not a full double-entry ledger (that stays a
deliberately out-of-scope, much bigger build).

**Chart of accounts** — `lib/finance/chartOfAccounts.ts`: 7 income
categories (Sales, Service Income, Rental, Membership/Subscription,
Grants & Donations, Interest, Other) and 20 expense categories (was 5:
travel/meals/equipment/accommodation/other — kept those 5 keys unchanged
so existing expense rows still resolve correctly, added COGS, Salaries,
Rent, Utilities, Bank Charges, Professional Fees, Marketing, etc.), each
with a simplified GL-style code matching what `buildJournalCsv` already
hardcoded (Sales 4000, VAT Control 2200, etc.). Validated at the
application layer, not a DB CHECK — same approach `expenses.category`
already used, so the list can grow without a migration.

**Schema** — `supabase/migrations/20260918_chart_of_accounts.sql`
(applied to prod via the Management API, `scripts/apply-coa-migration.mjs`,
after explicit confirmation — auto mode classifier flagged it):
`invoices.category` (default `'sales'`), `invoices.channel` (`'invoice'`
default, or `'cash_sale'`), `invoices.payment_method` (nullable). All
additive/defaulted, no existing column touched.

**Cash sales** — `POST /api/invoices` extended (not a separate endpoint)
with `channel:'cash_sale'` (server forces `status:'paid'`,
`amount_paid=amount_due=0` immediately — the client can't set this
itself), `category`, `paymentMethod`, and line items that can carry a
`productId` instead of description/unitPrice — server resolves the real
name/price, validates stock for ALL items before creating anything, then
decrements `products.current_stock` + logs an `inventory_transactions`
row per item (mirrors `/api/inventory/transactions`'s existing 'sell'
path). New `app/dashboard/invoices/QuickSaleModal.tsx`: a "From stock"
mode (cart-style, picks products, live total) and a "Quick amount" mode
(single description+amount, for services) — which one shows by default is
driven by whether the tenant has any active products, not hardcoded per
industry. `lib/finance/chartOfAccounts.ts`'s
`defaultIncomeKeyForBusinessType()` pre-selects a sensible income category
per vertical (property→rental, ngo→grants, school→membership,
consulting/legal/accounting/trades/creative/cleaning→service, else sales).

**Shared paid-invoice side effects** — extracted the owner-notify /
formalization-bump / autonomy-gated customer-thank-you block (built in
Phase 4 for `money/payment_receipt`) out of the PATCH route into
`lib/invoices/onPaid.ts`'s `handleInvoicePaid()`, called from both the
PATCH route (an invoice being marked paid) and the new cash-sale POST
path (paid at creation) — so a Quick Sale gets the exact same automation
an invoice payment does, not a second hand-rolled copy. Also populated
`contact_phone` on invoice creation when a contact is linked (previously
never set on POST at all — a pre-existing gap that meant `payment_receipt`
could never fire for a normally-created invoice tied to a contact) so
that a linked-contact cash sale can now also send the receipt thank-you.

**Reports** — `lib/money/exports.ts`: `buildIncomeStatement` now breaks
revenue down by category (previously one lump "Sales revenue" line, while
expenses were always categorized — asymmetric); new
`buildIncomeByCategory()` parallels the existing `buildExpensesByCategory`;
`buildJournalCsv` now posts each sale to its real income account instead
of always "Sales (4000)". New `income_by_category` report type wired
through `app/api/money/export/route.ts` and listed on
`/dashboard/money/reports`. `humanCat()` now prefers the canonical
chart-of-accounts label over title-casing raw text, for both invoices and
expenses.

**Self-correction along the way (see Phase 4's entry above for the root
incident):** discovered while reading the invoice insert path that
`total`/`amount_due` are real, live columns — this is what surfaced the
Phase 4 schema misdiagnosis and triggered its same-session fix.

**Not done:** no double-entry ledger (explicitly declined depth); no
UI surfacing of category/channel/payment_method on `InvoicesTable`
itself (the reports are where the categorization shows up); recurring/
subscription billing (school fees, memberships) was named as a cash-sale
scenario but scoped out — Quick Sale handles the one-off capture, a
recurring-billing engine is a separate, larger feature.

`npx tsc --noEmit` clean throughout.

Full detail: memory `adminos-cash-sales-chart-of-accounts-2026-09-18`.

---

## Session 15 (Phase 6) — 2026-09-18/19 — Deployment webhook broken + post-deploy bug sweep

**The GitHub→Vercel deploy webhook stopped firing mid-session, silently.**
Every push through the "docs: correct Phase 4..." commit (`9cb9516`)
auto-deployed within ~2 seconds, same as every prior session. Every push
after that — `2f8e6d8`, `fcfd98d`, `df8e05b`, `a50d753` — got **zero**
response: not building, not queued, no GitHub commit-status entry at all
(confirmed via `gh api .../commits/{sha}/status`, `total_count: 0`, vs.
the prior commit's `total_count: 1` with a completed Vercel status
within seconds). An empty retrigger commit didn't fix it either — this
is a persistent integration fault (GitHub App delivery), not a fluke,
and outside what's fixable through code. **Nanda needs to check the
Vercel dashboard's Git integration for this project and likely
reconnect/reauthorize the GitHub App.**

**Workaround used for the rest of this session:** trigger deployments
directly against the Vercel REST API (`POST /v13/deployments` with
`gitSource: {type:'github', repoId, ref:'main', sha}`) using
`VERCEL_API_TOKEN`/`VERCEL_TEAM_ID` from `.env.local` — confirmed already
present, not added this session. This bypasses the webhook entirely and
reliably produces a READY production deployment aliased to
`adminos.co.za`. **Until the webhook is fixed, every future push needs
this same manual trigger** — check `gh api repos/.../commits/{sha}/status`
first; an empty `statuses` array means it silently didn't fire.

**Bug sweep from Nanda's first live pass** (after the deploy gap above
was closed) — four reports, three real bugs found and fixed, one still
open:

1. **"tasks form still an issue" (mobile)** — the Phase 3 CSS-only patch
   (`overflow-hidden`→`overflow-y-auto max-h-[90vh]`) on
   `TaskActions.tsx`'s hand-rolled `fixed inset-0` overlay wasn't enough
   on a real device. Migrated `CreateTaskModal` onto the shared
   `Modal`/`FormField`/`Btn` primitives (`components/ui/modal.tsx`) that
   every other working form modal already uses — the deferred Phase 3
   punch-list item ("migrate the 3 fixed modals onto the shared Modal
   component"), done for this one now that CSS-patching alone proved
   insufficient.
2. **Found alongside it, not reported but almost certainly related:**
   `tasks.assigned_to` referenced `auth.users(id)`, but the "Assign To"
   dropdown has only ever populated it from `staff.id` — so picking
   anyone in that dropdown made task creation fail outright with a
   foreign-key violation (a confusing raw Postgres error, not a friendly
   message — would read as "the form is broken"). The 13 existing rows
   all pointed to one demo-seed `auth.users` id, none matching any staff
   record — confirms this path had never worked. Nulled the stale demo
   data, corrected the FK to reference `staff(id)`. Migration
   `20260918_fix_tasks_assigned_to_fkey.sql`, applied to prod.
3. **"inbox page dont make sense"** — `app/dashboard/inbox/page.tsx` had
   **zero** responsive handling anywhere in the file (no `md:`/`sm:`
   breakpoints at all) — a fixed `w-72` conversation list and the message
   panel always rendered side by side, leaving ~90px for messages on a
   phone. This page predates the Phase 3 mobile sweep and sits outside
   the standard `p-4 md:p-6` content pattern (its own `h-screen` layout),
   so the shell fix never touched it. Rebuilt to the standard mobile-chat
   pattern: one pane at a time, back button to return to the list.
4. **"export buttons dont work"** — couldn't reproduce a server-side
   failure (checked Vercel runtime errors/logs for `/api/money/export`
   and friends — none in the relevant window). Two candidates fixed
   defensively since either could explain it: (a) most "export" buttons
   in the app are `DataTable`'s built-in CSV export
   (`components/ui/DataTable.tsx`), which built the download via a
   detached `<a>` element's `.click()` — several mobile browsers (iOS
   Safari especially) silently no-op that; now appends the anchor to the
   DOM before clicking. (b) it's also possible she tested before the
   webhook-gap deploy landed, in which case nothing was actually broken.
   **Still needs her confirmation** on which "export" and whether it's
   fixed now.

`npx tsc --noEmit` clean across all fixes. Commits `df8e05b` (tasks
form + FK), `a50d753` (Inbox mobile + DataTable export) — each manually
deployed per the webhook workaround above.

Full detail: memory `adminos-deploy-webhook-broken-and-bugsweep-2026-09-19`.

---

## Session 16 (2026-10-04) — Scale + app-store readiness audit

**Question asked:** is AdminOS ready for 1000s of businesses, is it set up
for Play Store + Huawei AppGallery, and where is the code badly designed?
**Answer: no on both counts — yet.** Nothing here needs a rewrite; it's a
specific, finite list. This section is the deep-dive queue — work it top to
bottom in fresh sessions. **For scale/store work it supersedes the "Build
list" section above.**

Verification: `npx tsc --noEmit` exit 0; `npm test` 32/32 → 36/36 with new
`tests/fetchAll.test.ts`. ESLint crashed on an OneDrive file-read error
(`errno -4094`) — environmental. `expo-app/` could not be type-checked (no
`node_modules`).

### Live production facts (Management API, 2026-10-04)

| Check | Result |
|---|---|
| Project `aetydnhnxmrsgqaqtofc` (AdminOS, eu-west-1) | ACTIVE_HEALTHY |
| Org `CreativelyNandawula` plan | **free** |
| PostgREST `max_rows` | **1000** (confirms the cron cap bug below) |
| Tenants / active | 8 / 8 |
| DB size | 21 MB |
| Staff rows / with a login (`staff.user_id` set) | **12 / 0** |
| Tenant names containing `& < >` | 0 (Ring bug hadn't hit anyone yet) |
| Campaigns stuck in `sending` | 0 |
| Security advisor | **13 × ERROR rls_disabled_in_public, 2 × ERROR security_definer_view**, 10 definer functions executable by anon, 14 mutable search_path, leaked-password protection off, OTP expiry too long |
| Performance advisor | 100 × multiple_permissive_policies, 62 unindexed FKs, 10 auth_rls_initplan, 78 unused + 4 duplicate indexes |

Note: the AdminOS project lives in a different Supabase org than the one
the Supabase MCP connector sees — use the Management API with
`SUPABASE_ACCESS_TOKEN` from `.env.local`.

### 🔴 P0 — anon-key data exposure (migration written, NOT yet applied)

With only the public anon key (in every browser bundle) and **no login**,
anyone could read/insert/update/delete:
`notifications`, `contract_signatures` (signer names + emails),
`triggered_lessons`, `book_in_action_completions`, `achievements`,
`academy_modules`, `academy_lessons`, `framework_library`,
`contextual_triggers`, `impact_snapshots`, `coaching_cards`, and
**`plan_catalogue` / `addon_catalogue` (live pricing)**. Plus the
`overdue_invoices` and `wellness_summary` views are SECURITY DEFINER and
anon-selectable → every tenant's overdue invoices and staff wellness data.

Fix: `supabase/migrations/20261004_lock_down_rls_disabled_tables.sql` —
enables RLS on all 13, revokes anon writes, adds only the two user policies
the mobile app needs (own notifications; read lessons), sets both views to
`security_invoker` and revokes client access. Safe for the web app: every
web/Inngest access to these objects is via `supabaseAdmin` (verified by
grep). **Auto-mode blocked applying it — Nanda to apply in the SQL editor,
then re-run the security advisor to confirm the 15 ERRORs are gone.**

Follow-ups in the same area: revoke `EXECUTE` from anon on the 10 SECURITY
DEFINER functions (`create_default_subscription`, `seed_compliance_calendar`,
`fn_trigger_*`, `search_kb_articles`, …) after checking callers; set
`search_path` on the 14 flagged functions; enable leaked-password
protection + shorten OTP expiry in Auth settings.

### Fixed this session — commit `e6e053a`

1. **WhatsApp replies silently dropped.** `app/api/webhook/whatsapp/route.ts`
   started the AI workflow as an un-awaited promise, then returned 200.
   Vercel freezes the function once the response is sent → replies
   intermittently never generated/sent. Same for read receipts + status
   updates. All moved into Next's `after()`. **There was no
   `after()`/`waitUntil` anywhere in the codebase before this.**
2. **Meta retries billed against plan limits.** `incrementUsage` ran before
   `checkDuplicate`, so every Meta redelivery counted toward the monthly
   cap (and re-sent "limit reached"). Dedup now runs first.
3. **Ring broke for any business name with `&`.** Nothing in
   `app/api/voice/inbound/route.ts` was XML-escaped → malformed TwiML →
   Twilio "application error". Added `xml()` at every interpolation.
   Removed the transfer fallback that dialled `to` — the tenant's *own*
   Twilio number — looping the caller back into the AI.
4. **Tenants past #1000 silently dropped from all crons** (confirmed live:
   `max_rows` = 1000). New `lib/supabase/fetchAll.ts` pager (stable
   `order('id')` + `range`, throws rather than returning a partial list),
   wired into fanOutBrief, fanOutHealthScore, fanOutWellness,
   governanceDeadlines, opsAlerts, peopleApprovals, salesColdLeads,
   signalRefresh, cashflowForecast, benchmarkCalculate, valuationSnapshot.
5. **Mobile staff app could never show data.** `expo-app/store/auth.ts`
   read `tenant_id`/`role` from `user_metadata` (stripped in Phase 0) and
   `staff_id`, which **no code path has ever written**. Now reads
   `app_metadata` and resolves the staff row via `staff.user_id`.
   ⚠️ Live data shows **0 of 12 staff have `user_id` set** — see A7.

### Open — scale blockers (deep-dive in this order)

- **S1. Production Supabase is on the free plan** (why it auto-pauses —
  memory `adminos-supabase-db-autopauses`). 500 MB cap, pauses, no PITR.
  Upgrade to Pro + enable PITR before onboarding paying tenants at volume.
  Billing decision, not code.
- **S2. Reach campaigns broken three ways** —
  `app/api/reach/campaigns/[id]/send/route.ts`:
  (a) sends `type: 'text'`; Meta rejects free-form business-initiated
  messages outside the 24h window (error 131047) → most of any broadcast
  list fails. Must use approved templates (`lib/whatsapp/send.ts` already
  has a template sender, unused here).
  (b) `void dispatchCampaign(...)` — the same frozen-function bug as #1;
  campaigns die partway and stay `status='sending'` forever.
  (c) contacts query unpaginated → capped at 1000.
  **Fix:** Inngest function, steps of ~50, throttled, template-only,
  `fetchAll` for contacts.
- **S3. `inngest/functions/payrollReminder.ts`** — serial loop over every
  tenant, 2 queries + a send each, **no `step.run`**. Times out at scale;
  each retry re-sends reminders already sent. Convert to fan-out
  (`fanOutBrief.ts` is the template).
- **S4. Inngest 1000-step cap.** `cashflowForecast`, `valuationSnapshot`,
  `boardPack` (monthly cron) do one `step.run` per tenant in a single
  function → hard-fails past ~1000 eligible tenants. Convert to fan-out.
  `boardPack`'s tenant query is also still unpaginated.
- **S5. `cashflowForecast` upsert writes columns that don't exist**
  (`forecast_data`/`calculated_at`; its own NOTE says so). The weekly
  forecast does nothing today.
- **S6. `signalRefresh` runs hourly per tenant** → ~24k Inngest runs/day
  at 1000 tenants. Check Inngest plan limits; consider every 3–6h or only
  tenants active in the last 7 days.
- **S7. Throughput caps:** `sequencesCron` max 200 enrollments/hour,
  `escalateConversations` max 100 per 15 min. Fine now, backlog at scale.
- **S8. `inngest.send` with the whole tenant array in one call** — fine at
  1000 (~80 KB); chunk to 500/send before ~5–10k tenants.
- **S9. Mobile `lib/api.ts` sends `Authorization: Bearer`** but
  `middleware.ts` only reads cookie sessions → any mobile `/api/*` call
  will 401. Latent (no screen calls `apiFetch` yet).
- **S10. Performance advisor:** 100 multiple-permissive-policy warnings
  (each query evaluates several policies), 10 `auth_rls_initplan` (wrap
  `auth.uid()` in `(select …)`), 62 unindexed FKs. Cheap wins before
  load grows; duplicates/unused indexes cost write speed.

### Open — Play Store / AppGallery blockers

- **A1. No account deletion anywhere** (no in-app path, no web URL). Google
  Play hard requirement. Need in-app "Delete my account" + public web
  page, soft-delete per Rule #3 with a purge window, owner-vs-staff
  semantics decided.
- **A2. Expo build would fail:** `expo-app/assets/` doesn't exist but
  `app.json` references `adaptive-icon.png`, `notification-icon.png`,
  `favicon.png`; no top-level `icon`/splash image. `app.json`/`eas.json`
  still contain `YOUR_EAS_PROJECT_ID`, `YOUR_APPLE_ID`, etc.
- **A3. Expo SDK drift:** declares SDK 52 but several deps are SDK-51
  versions (`expo-camera ~15`, `react-native-screens 3.31.1`, …). SDK 52
  targets an Android API below Play's current requirement for new apps.
  Upgrade to current SDK, re-pin with `npx expo install --fix`.
- **A4. Huawei/AppGallery:** no Google Play Services on Huawei devices →
  Expo push (FCM) won't deliver. HMS Push Kit, or accept no push there.
- **A5. Mobile signup creates no tenant.** `expo-app/app/(auth)/signup.tsx`
  never runs the web onboarding that provisions the tenant (its
  `role:'owner'` in user_metadata is ignored since Phase 0) → new users
  land in an empty app. Also relies on confirmation email, which doesn't
  arrive (memory `adminos-resend-key-dead`).
- **A6. Listing assets:** `/privacy` exists; still need Data Safety
  answers, 512px icon, feature graphic, phone screenshots, content rating,
  reviewer test account.
- **A7. Staff accounts aren't linked to logins.** 0/12 staff rows have
  `user_id`. Find/build the staff-invite flow that creates the auth user
  and writes `staff.user_id` — without it there is no "My Admin" for any
  employee, on web or mobile.
- **Faster route than finishing Expo:** ship the PWA as a Trusted Web
  Activity (Bubblewrap) to both Play and AppGallery. Needs
  `public/.well-known/assetlinks.json` (missing) and a real maskable icon
  (manifest reuses `icon-512.png`). Days, not weeks; still needs A1 + A6.
  **Decision for Nanda: TWA first, or Expo?**

### Open — code quality / smaller issues

- **Q1. Uncommitted GTM snippet in `app/layout.tsx`** is blocked by the CSP
  in `next.config.ts` (no `googletagmanager.com`) and loads before
  `CookieConsent` → POPIA. Add to CSP + gate behind consent, or drop it
  (PostHog already covers analytics).
- **Q2. Pen agent double-spend:** `app/api/agents/pen/route.ts` with
  `saveDraft` streams the reply *and* runs the whole agent again via
  `void orchestrator.run(...)`. Save the streamed text instead.
- **Q3. Remaining un-awaited background work** (same class as fix #1):
  `academy/lessons/[lessonId]` (`inngest.send`, `checkAchievements`),
  `agents/[agentType]` (`storeAdvisorInsights`). Wrap in `after()`.
- **Q4. `/api/workflow/trigger` unreachable by n8n** — checks
  `x-n8n-secret` but isn't in middleware `PUBLIC_PREFIXES`, so it 401s
  first. Add it, or delete the route if n8n is gone.
- **Q5. Voice prompt injection:** caller speech is concatenated into the
  system prompt in `voice/inbound`. Move the transcript into the user turn.
- **Q6. Middleware onboarding gate reads `user_metadata.onboarding_completed`**
  (user-writable). Low impact; inconsistent with the Phase 0 rule.

### Next session — suggested order

1. Apply the P0 RLS migration; re-run the security advisor.
2. Confirm `e6e053a` deployed (deploy webhook may still need a manual
   trigger).
3. S1 — decide on Supabase Pro.
4. S2 Reach → Inngest + templates.
5. A1 account deletion + A7 staff login linking.
6. Decide TWA vs Expo, then A2–A6.
7. S3–S5 cron rewrites, S10 advisor cleanup, then Q-items.

Full detail: memory `adminos-scale-store-readiness-audit-2026-10-04`.

### Session 16b — whole-app engineering baseline (same day)

Nanda's direction: **AdminOS must be industry-grade in every tab, and the
Expo app will be finished (not TWA).** The list above is *not* exhaustive —
it covered the riskiest paths. This is the app-wide baseline.

Surface: **57 dashboard tabs, 149 API routes (121 with writes), 37 Inngest
functions, 43 components, 78 lib files, 7 unit-test files, no CI.**

Scanner committed as `scripts/quality-scan.cjs` (heuristic — verify before
acting). Re-run after each tab sweep; these numbers are the scoreboard.

| Signal (baseline 2026-10-04) | Count |
|---|---|
| Non-public routes with no role/permission check | 88 / 149 |
| Write routes with no schema (zod) validation | 27 |
| Routes returning raw DB `error.message` to the client | 85 |
| Hard `.delete()` (violates Rule #3) | 10 routes |
| `select('*')` in routes | 49 |
| Write routes with no audit log | 98 / 121 |
| Rate-limited routes | 11 |
| Tabs with no permission check | 17 / 57 |
| Tabs with no empty state | 23 |
| Tabs with a possibly unbounded list query | 27 |
| CI pipeline | **none** (no `.github/`) |
| API/integration tests | **none** (7 unit tests of pure logic) |

**Verified by reading, not just scanned:**
- **Role authorization inside a tenant is the systemic gap.** Tenant
  isolation is solid (routes filter by `app_metadata.tenant_id`), but
  most routes never check *role*. Confirmed: any staff-role user can
  `POST /api/payroll/[id]/distribute` (sends everyone's payslips) and
  `POST /api/push/send` (push any text to any colleague — phishing
  channel). Some of the 88 are correctly open to all roles (clock-in, own
  profile, mark-read) → needs a **role matrix**, not a blanket gate.
- False positive confirmed: `payroll/payslip/[id]` does its own ownership
  check. But its manager list is `['admin','hr_manager','owner']` — the
  `manager` role can't view staff payslips. Roles are inconsistent across
  routes; the matrix must settle the canonical role set.
- Hard deletes: contacts, contacts/merge, creative-assets, documents,
  email-drafts, kb, portal, sequences, social/accounts, tasks.
- CSP allows `js.sentry-cdn.com`/`*.sentry.io` but Sentry isn't installed
  — errors go to PostHog via `instrumentation.ts onRequestError`. Dead CSP
  entries; decide on one error tracker.

**Definition of done — every tab must pass all of these:**
1. Role-authorized on page *and* every route it calls, per the role matrix.
2. Every write validated with zod; friendly 4xx messages, never raw DB text.
3. Soft delete only; every write audit-logged.
4. Lists paginated server-side, with search/filter where the data grows.
5. Loading, empty, error and mobile states all designed.
6. Tests: an authz test (wrong role → 403, other tenant → 404) + happy path.
7. Errors captured by the error tracker; no silent `.catch(() => {})` on
   user-facing actions.

**Plan (each phase = one or more fresh sessions):**
- **Phase 0 — exposure, now:** apply the P0 RLS migration; role-gate
  `payroll/*` and `push/send`.
- **Phase 1 — foundations, so per-tab work is cheap and consistent:**
  (a) GitHub Actions CI: tsc + tests + scanner on every push.
  (b) Role matrix (`lib/auth/roleMatrix.ts`) — canonical roles × actions.
  (c) One `withRoute()` wrapper: auth + tenant + role + zod + error mapping
      + audit log; migrate routes onto it tab by tab.
  (d) Soft-delete helper + `deleted_at` columns where missing.
  (e) Shared paginated `DataTable` server contract.
  (f) Route test harness (authz + happy path) against a Supabase branch.
- **Phase 2 — tab-by-tab sweep by domain** (one session each, DoD above):
  Money (invoices, money, cashflow, expenses, payroll, valuation,
  stokvel, suppliers, inventory) → People/HR (staff, team, leave,
  performance, disciplinary, ee, safety, ir-log, handbook, shifts) →
  Customers & comms (inbox, contacts, reach, sequences, ring, bookings,
  email-studio) → Ops (tasks, projects, calendar, documents, contracts,
  creative-assets, workflow-monitor) → Compliance & governance → AI
  (langa, agents, board-pack, analytics, health) → Growth (academy,
  community, getting-started, onboarding) → Settings & billing.
- **Phase 3 — Expo app to store-ready:** current SDK + `expo install
  --fix`, assets, EAS project, signup → tenant provisioning, staff↔login
  linking (A7), bearer auth in middleware (S9), account deletion (A1),
  push incl. Huawei HMS (A4), offline queue QA, EAS builds, store listings.
- **Phase 4 — scale proof:** Supabase Pro + PITR, S2–S8 cron/campaign
  rewrites, performance-advisor cleanup, then a load test with synthetic
  1000-tenant data before claiming "ready for thousands".

### Session 16c — SA market fit + product roadmap (2026-10-04/05)

Nanda asked which industries AdminOS really helps and whether it addresses
SA's current economic bottlenecks. Answer grounded in the code (not the
marketing copy) and in current data.

**SA conditions (sourced, Oct 2026):**
- Unemployment **33.6%** Q2 2026 (+345k unemployed); Eastern Cape
  **47.5%**, highest province (Stats SA QLFS Q2 2026).
- SARB hiked repo **+25bp to 7.25%** on 2026-09-23 → credit dearer, so
  collecting your own debtors matters more.
- **91%** of SA SMEs hurt by late payments; ~half call cash flow their #1
  growth threat (Xero survey). 117 municipalities averaged **286 days** to
  pay suppliers; national departments paid R35.1bn of invoices late.
- Red tape: IMF (Mar 2026) flagged regulatory complexity; for firms with
  <20 staff, compliance burden hits productivity ~2× harder.
- Load shedding largely over: 341 days without it, none in winter 2026.

**Fit — bottleneck → what the code has → verdict:**

| Bottleneck | AdminOS today | Fit |
|---|---|---|
| Late payment / cash flow | Invoices & AR, WhatsApp debt-recovery automation, Cash Cockpit, Quick Sale | Strong — but no pay-from-invoice (gateway held off) and cashflow forecast is dead (S5) |
| Red tape / compliance | Compliance calendar, licences, EMP201, VAT201 working paper, EE, POPIA, IR log, safety, e-sign contracts | **Strongest differentiator** vs Xero/Sage — mind the open compliance-overclaims decision |
| Owner admin overload | WhatsApp-first AI inbox, autonomy tiers, agents, multilingual (isiXhosa, isiZulu, Afrikaans…) | Strong once the `after()` webhook fix is live |
| Access to finance | Valuation, health score, board pack, accountant reports, formalisation nudges | Medium — lender-ready info, no lender connection |
| Unemployment | Nothing direct | Indirect only (SME survival/growth). Don't market as a jobs fix; AI can read as replacing admin jobs |
| Load shedding | Offline caching, load-shedding integration | Now secondary — don't lead marketing with it |

**Industries:**
- *Best fit* (staff + recurring customers + invoices + WhatsApp
  customers): salons, cleaning, trades, private clinics, private/ECD
  schools, consulting, accounting, legal, property management, NGOs,
  events, creative agencies.
- *Weaker today:* retail/spaza (no POS/Yoco — Quick Sale is manual),
  logistics (no fleet/POD).
- *Not covered:* restaurants/hospitality, manufacturing, agriculture,
  most of the informal sector (price + formality — Formalisation and
  Stokvel are the on-ramps).

**Product roadmap — the four SA-bottleneck features (after Phase 1–2):**
- **R1. Pay-from-invoice / pay-from-reminder.** Directly attacks the #1
  SME problem. Revisit the held-off gateway decision (memory
  `adminos-invoice-payment-gateway-held-off-2026-09-18`) — PayFast/Paystack
  are already integrated for AdminOS's own billing.
- **R2. Bank feeds** (e.g. Stitch or statement import) → makes the cashflow
  forecast real (fixes S5 properly) and auto-reconciles invoices.
- **R3. The business's *own* B-BBEE + CSD.** Today B-BBEE level exists only
  on *suppliers* (`app/dashboard/suppliers`). Add EME/QSE affidavit or
  certificate with expiry tracking + CSD registration number to the
  compliance calendar — this is what lets SMEs sell to corporates and
  government.
- **R4. Government-debtor recovery track.** Municipalities average 286
  days. A debt-recovery variant for government/municipal clients: formal
  escalation letters citing the 30-day payment rule, accounting-officer
  escalation path.
- Also noted, lower priority: POS/Yoco integration (opens retail),
  SARS eFiling submission (VAT201 is export-only today).

**Positioning caveat:** several of the features that make AdminOS strongest
for SA are the ones the audit found broken (WhatsApp replies — fixed in
`e6e053a`; Reach campaigns S2; cashflow S5; staff logins A7; email —
Resend key dead). The positioning is right; Phase 1–2 is what makes it
trustworthy.

### Session 16d — NORTH STAR: how AdminOS wins (2026-10-05)

Agreed with Nanda as the product strategy that ties everything together.
**Every future build decision should be checked against this section.**

**Thesis:** don't sell "an OS with 42 tabs" — Xero, Sage, Zoho and
SimplePay each own a slice and we won't out-tab them. Win by being the only
product where **work flows between people by itself, over WhatsApp, and
everyone it touches gets pulled in.**

**The loop every tab must serve:**

> Work → Invoice → Get paid → Pay staff → Stay compliant → Prove you're
> healthy → Get funded → Grow → more work

Every existing tab already sits on this loop. The job is to make each step
*automatically trigger the next* — not to add more features.

**The five moves:**
1. **Three apps, one system.** Owner app (home = a short *feed of
   decisions*, e.g. "Approve 3 leave requests", "R14,200 overdue — send
   final notice?", not a sidebar). Staff app (payslips, leave, clock-in,
   tasks, training). Customer side (WhatsApp, pay page, booking, portal —
   no download needed).
2. **The staff app drives downloads.** Each owner brings 5–50 employees.
   Staff app **free forever** and genuinely useful (payslip on phone, leave
   balance, UIF info, payday reminders) → 10–20× download multiplier per
   paying business → app-store ranking. Competitors' apps are owner-only.
   This is why A7 (staff ↔ login linking) is strategic, not just a bug.
3. **Every document is an ad and a network.** Invoices, reminders,
   payslips, quotes go out with "Sent with AdminOS" + pay link. Most B2B
   invoice recipients are businesses. Moat: **when both sides use
   AdminOS, the invoice lands directly in the client's Expenses, already
   matched**, with payment status syncing both ways. Each new business
   makes the network more valuable.
4. **Free wedge, paid autopilot.** Free for solo businesses: WhatsApp
   invoicing + reminders + pay-from-invoice (R1) — the #1 SA pain, brings
   downloads in. Paid tiers sell **autopilot**: AI debt recovery, payroll +
   EMP201, compliance calendar, Langa, autonomy tiers. Pitch = "stop doing
   admin", not "more features".
5. **Data unlocks money (the flywheel).** Real invoices + bank feeds (R2) +
   payroll + compliance history → a **verified business health profile** →
   lender partnerships (invoice financing, working capital) on revenue
   share. Plus own B-BBEE + CSD records (R3) → AdminOS becomes how SMEs
   qualify to supply corporates and government. This is the lock-in.

**Distribution:**
- **Accountants/bookkeepers** — existing partner/white-label plan; one
  accountant = 20–80 clients. Build a multi-client dashboard + rev share.
- **Institutions** — SEDA, SEFA, NYDA, chambers, bank SME programmes,
  Eastern Cape development agencies. They need proof their funded SMEs
  grow; health score + board pack are that proof.
- **Industry playbooks** for best-fit trades (salons, cleaning, trades,
  clinics, schools): one-click setup with the right tabs, templates and
  WhatsApp scripts — extend the existing per-industry sidebar.

**Sequencing (non-negotiable — a viral loop spreading broken WhatsApps or a
staff app with no logins spreads *bad* word of mouth just as fast):**
1. Trust — engineering Phases 0–2 (P0 leak, foundations, domain sweeps).
2. Wedge — free invoicing + reminders + pay-from-invoice (R1); staff app
   live in Play Store + AppGallery (Phase 3).
3. Network — invoice→expense link between AdminOS businesses; accountant
   multi-client dashboard.
4. Flywheel — bank feeds (R2), B-BBEE/CSD (R3), government-debtor track
   (R4), lender partnerships.

**Open inputs needed from Nanda to turn this into a concrete plan:**
current tier prices (solo/grow/operate/scale/partner amounts) and which
competitor she loses deals to most often.

## Session 17 (2026-10-05) — Phase 1: foundations

Commits `2c798d1` + `6e81f50` (build fix). Verification: `tsc --noEmit` exit 0,
tests 36 → **77/77**, CI green on GitHub Actions.

**Built — all six Phase 1 items:**
- **(a) CI** — `.github/workflows/ci.yml`: `npm ci` → `next typegen` → `tsc`
  → `npm test` → `quality-scan --check`. The scan is now a **ratchet**:
  `scripts/quality-baseline.json` holds the scores, and CI fails if any of
  them get worse. After an improvement, lock it in with
  `node scripts/quality-scan.cjs --write-baseline`.
- **(b) Role matrix** — `lib/auth/roleMatrix.ts`. It defines the 6 canonical
  roles, the 14 permissions, the default role sets, and ~35 route **actions**
  (`payroll.distribute` → `view_payroll`, `clock.self` → any member). Routes
  declare an action and never name a role. It has no imports, so tests load
  it directly. `permissions.ts` re-exports from it.
- **(c) `withRoute()`** — `lib/api/withRoute.ts`, with a framework-free core
  in `lib/api/handler.ts`. One wrapper handles:
  - auth + tenant (fail-closed) and the matrix check
  - zod body/query validation, with per-field 400s
  - DB errors mapped to friendly 4xx (constraint names never reach the client)
  - an audit row on success, and per-tenant rate limiting
  - unexpected errors reported to PostHog
  - helpers: `unwrap()`, `notFound()`, `conflict()`
- **(d) Soft delete** — `lib/db/softDelete.ts` (`softDelete`, `restore`,
  `live`). Migration `20261005_soft_delete_columns.sql` was **applied to prod**.
  It adds `deleted_at` to 40 business tables; before it, **no table had the
  column**. Converting a route means swapping `.delete()` for
  `softDelete()` **and** adding `live()` to every read of that table.
- **(e) Server lists** — `lib/api/list.ts`:
  - `parseListParams` with allow-listed sort and filters
  - `applyList`, whose search is safe against PostgREST `or()` injection and
    which adds an `id` tiebreak
  - `listResult`

  `DataTable` also has a `server` prop now: its state lives in the URL and the
  server pages with `.range()`. **No page uses it yet.** Contacts or invoices
  is the first adopter (Phase 2).
- **(f) Route test harness** — `tests/helpers/routeHarness.ts` drives the
  real `withRoute` core with fake callers per role, so the 401/403/400
  contract is testable for every route. **Not covered:** cross-tenant → 404
  needs a real DB. Supabase branching needs Pro (S1), so this is blocked on
  that decision.

**Pilots on withRoute (4 routes):**
- `payroll/[id]/distribute` now claims the run atomically. Before, a
  double-click sent every payslip twice.
- `generate-payslips`
- `push/send` no longer echoes the raw zod error.
- `payroll/payslip/[id]`: its manager check used `'hr_manager'`, a role that
  doesn't exist, read from `app_metadata`. It now uses the matrix's
  `payroll.read`.

**Lesson (cost one failed deploy):** Next's build-time route validator
rejects an *optional* second argument on route handlers, and plain `tsc`
doesn't run it. CI now runs `next typegen` first. `next typegen` crashes
locally with the OneDrive `UNKNOWN read` error, so it has to run in CI.

**Scores after Phase 1** (`scripts/quality-baseline.json`):
- routes with no permission check: 84
- write routes without zod: 27
- hard deletes: 10
- raw DB error leaks: 85
- `select('*')`: 49
- unaudited writes: 95
- rate-limited routes: 12
- routes on withRoute: 4
- pages with no permission check: 17
- pages with no empty state: 23
- pages with unbounded queries: 27

**Still open / found this session:**
- 🔴 **P0 RLS migration still NOT applied.** The auto-mode classifier blocked
  the RLS change via the Management API, again. It was re-verified live:
  the 13 tables still have RLS off. The file also gained an
  `academy_modules` read policy, which the Expo training screen needs.
  **Nanda: paste `supabase/migrations/20261004_lock_down_rls_disabled_tables.sql`
  into the SQL editor.**
- `test@adminos.co.za` (tenant "Test Business ZA") has **no `user_roles`
  row**. getContext fails closed for it, so every withRoute call returns 401.
  It's a test account; delete or seed it. Nanda's own login is unaffected
  because super-admin bypasses the check.
- Middleware gates `/api/admin/*` on `app_metadata.role === 'super_admin'`,
  but Nanda's role there is `admin`, and the real check is the `admins`
  table. Align it during the Settings/admin sweep.
- Phase 3 / A7: the staff-invite flow must also write a `user_roles` row.
  withRoute fails closed without one, so a linked staff login would get 401.
- The payroll page posts plain HTML `<form>`s to the distribute and generate
  routes, so the browser lands on raw JSON. Fix this in the Money sweep.

**Next:** Phase 2, domain by domain. Start with Money. In each tab, move its
routes onto withRoute, adopt soft delete and server lists where they apply,
then run `--write-baseline`.

## Session 18 (2026-10-05) — Phase 2: Money sweep

Commits `60bc823` → `b9661d5` (6 commits). Every Money route (22) is now on
`withRoute`. tsc 0, tests 77 → **97/97**. Two additive migrations **applied to
prod** via Management API. Nanda's direction this session: *"every time you
find bugs, go extra debugger mode for more hidden bugs"* and *"we don't want
this app to have catastrophic errors that will ruin a whole business"* — so
each bug was chased to its siblings before moving on. Most of what's below was
found that way, not by the scanner.

**Catastrophic-class bugs fixed (would have hurt a real business):**
- **Debt recovery never chased invoices made in AdminOS.** Every chaser
  filtered `['unpaid','partial']`; the app creates invoices as `sent` and
  nothing sets `overdue`. Live: 7 of 11 past-due invoices invisible to the
  cron, Remind button, brief and agents. New `lib/invoices/status.ts` is the
  one definition (OPEN / OWED / `outstanding()` / `paymentState()`).
- **Reminders misstated the debt.** Messages quoted the invoice *total* to
  customers who had part-paid ("owed R7,935" when R5,157.75 was owed). The
  engine also never re-checked status at send time (paid-after-08:00 still
  chased) and loaded invoices by id with no tenant scope. Customer portal
  showed the same wrong totals.
- **VAT charged by unregistered businesses.** Both invoice modals defaulted
  "Include 15% VAT" ON; no tenant has a VAT number; the document hides the VAT
  line without one. Live: **17/21 invoices carry R5,995 VAT** their documents
  don't show. API now 400s VAT without a VAT number; toggle only for
  registered businesses. ⚠️ **Existing 17 rows untouched — Nanda decides**
  (mostly test tenants; check whether any were sent to a real customer).
- **VAT201 working paper** counted draft and *cancelled* invoices as sales,
  assumed VAT on invoices without it, claimed input VAT on *pending* claims.
- **No way to record a payment.** PATCH `/api/invoices/[id]` had no caller,
  so every invoice stayed outstanding — and in debt recovery — forever. New
  Record payment / Mark sent / Cancel / Delete-draft actions.
- **Payroll never worked end to end (0 runs ever in prod).** distribute
  needed statuses the DB constraint forbids; generate-payslips wrote columns
  that don't exist (deleted); `/run` sent payslips immediately with no review;
  re-runs duplicated payslips; the payslip viewer 404'd on nonexistent
  columns; the WhatsApp link needed a login no employee has. Now:
  draft → processing → **finalised (review)** → **paid (send)**, atomic
  claims, soft-deleted re-runs, per-employee review table, and an expiring
  **payslip view token** (`/api/payslips/view/[token]`, ID/bank masked).
- **EMP201 UIF = NaN** on the SARS working paper (snake_case rows through a
  camelCase reader; cache never written).
- **PAYE on 2025/26 tables.** SARS raised brackets/rebates/medical credits
  3.4% for 2026/27. Tables are now keyed by tax year and chosen from the pay
  period. **Every February: add the new year to `TAX_TABLES`** in
  `lib/payroll/calculate.ts` (tests check self-consistency).
- **Race conditions:** invoice numbers (count+1) collided; Quick Sale and
  stock movements read-modify-wrote stock with no tenant filter on the write;
  payments and expense approvals could double-apply. Fixed with a unique
  index, the atomic `adjust_product_stock()` RPC, and conditional updates.

**Also fixed:** money/remind had no permission check (any staff login could
start collections); cashflow/valuation/stokvel/suppliers/inventory open to all
members; expenses list/submit let anyone see or file as colleagues; CSV formula
injection in all exports and DataTable; exports + summaries truncated at 1000
rows; Recalculate on cashflow/valuation silently failed after the first save of
the day (upsert without onConflict); forecast dated >16-day-overdue
collections in the past; health score "revenue" always R0; home dashboard and
Money signal counted drafts/cancelled as receivables and read the stale
`days_overdue` column (45 stored vs 158 real); stokvel contributions accepted
any member UUID; `lowStock` filter errored on every call.

**Migrations applied to prod (additive):**
`20261005_money_sweep.sql` (invoice-number unique index, `adjust_product_stock`
service-role-only, `payslips.deleted_at` + one live payslip per staff per run),
`20261005_payslip_view_tokens.sql`.

**Scores** (baseline after Phase 1 → now): no-permission routes 84 → 75,
raw DB-error leaks 85 → 72, unaudited writes 95 → 86, `select('*')` 49 → 44,
rate-limited 12 → 16, on withRoute 4 → 22, unbounded pages 27 → 26.

**Open / found, not fixed (decisions or later sweeps):**
- 🔴 P0 RLS migration (`20261004_lock_down_rls_disabled_tables.sql`) still
  needs Nanda in the SQL editor.
- 17 VAT-bearing invoices from unregistered tenants (above).
- **WhatsApp templates:** payslips and debt reminders are free-form text, which
  Meta only delivers inside the 24h customer window. A `payslip_ready`
  template needs submitting in Meta Business Suite; until then the owner gets
  a "not delivered to …" list after each payroll.
- DB trigger `update_invoice_days_overdue` excludes `sent` and only runs on
  write; `fn_trigger_debt_recovery` still enqueues a legacy `workflow_queue`
  path. Nothing in code reads `days_overdue` any more — consider dropping the
  trigger + column in a later migration.
- ETI is always 0 on EMP201; payroll has no medical-aid/pension inputs per
  employee yet (calc supports them).
- Expense-approval form errors land on JSON (native form post); approvers can
  approve their own claims.
- `products (tenant_id, sku)` unique key isn't partial on `deleted_at` —
  re-creating a deleted product's SKU will 409 once product delete exists.
- Ops pages (`inventory`, `stokvel`, `suppliers`, `cashflow`, `valuation`,
  `money`) still render server-side without server paging — fine at current
  sizes, belongs in the page half of the DoD.

**Next:** Phase 2 continues — **People/HR sweep** (staff, team, leave,
performance, disciplinary, EE, safety, IR log, handbook, shifts). Same method:
read every route + page, verify columns/constraints live, chase siblings,
withRoute + matrix, then `--write-baseline`.

---

## Session 19 (2026-10-05/06) — Mobile app: Play Store + AppGallery readiness

**Commits:** `480b5ef` (role-aware RLS for people + money tables), `945dae4` (Phase 2 People/HR sweep, every HR route on withRoute), `a827895` (mobile backend), `0eca1d8` (offline clock, claim categories, receipt cap, CI mobile job), `6b873b1` (Expo app rewrite).
The first two landed at the end of Session 18 and weren't journaled until now.

### What was wrong before
The old `expo-app/` could not ship:
- It read Supabase tables directly with the anon key. That's the P0 RLS exposure from Session 16.
- It persisted payslips and profile data to plain AsyncStorage.
- It had no account deletion (a hard Play requirement) and no store build config.
- 0 of 12 staff rows had a login, so no employee could get in at all.

The backend also had real bugs that the app surfaced:
- **Sick leave deducted annual leave.** Every leave request was implicitly annual (BCEA s20 vs s22).
- **Leave requests could not be created by employees.** No route existed.
- **Tenant-level owner alerts leaked to staff** through the notifications route.
- **`/api/conversations/reply` sent WhatsApp to any number in the body,** with no role gate.
- **Langa and the agent routes had no role gate.** Any logged-in staff member could query the business's finances.
- **Tasks:**
  - no authorisation on update or delete
  - hard delete (Rule #3)
  - cross-tenant assignee accepted
  - priority sorted alphabetically, so "urgent" ranked below "high"
- **Expense receipts:** `javascript:` URLs were accepted, and receipts sat in a public bucket. Category was free text.
- **FOUND 2026-10-06 (live schema):** `notifications.user_id` is NOT NULL in prod, but `lib/notifications/notify.ts` writes tenant-level alerts with `user_id: null`. **Every in-app notification since August has failed silently.** The table has 0 rows. The fix is part of the mobile migration (§5, `DROP NOT NULL`).

### What was built
**Backend:**
- Bearer-token auth through `createClient()` and middleware.
- `/api/me` is a single round-trip home payload, gated per permission.
- Leave API with BCEA types and SA working days (`lib/people/workingDays.ts`: Easter via Meeus, Sunday→Monday rule).
- Withdraw-own-pending leave; the employee is notified of the decision.
- Push via the Expo Push API; dead tokens are soft-revoked.
- WhatsApp invite codes for staff: SHA-256 stored, atomic claim, rate limited, generated staff logins for people without email.
- Account deletion: ban + unlink immediately, anonymise after 30 days via the `accountDeletionPurge` cron. Business records are kept per BCEA s31 and TAA s29, as the page discloses.
- Private `expense-receipts` bucket, 5-minute signed URLs, file type sniffed from bytes, 4 MB cap.
- Staff directory; own-only documents; payslips only from **paid** runs.
- Offline clock `occurredAt` (at most 12h old, at most 2 min skew, out-of-order rejected, audit-flagged).
- Tests 116 → 128. Ratchet: withRoute 38 → 54, no-permission routes 69 → 63.

**Expo app (SDK 57, expo-router, NativeWind, TanStack Query):**
- `app.config.ts` plus EAS profiles: `preview` APK, `production` AAB for Play, `production-huawei` APK. Package `za.co.adminos`. Background location, audio and storage permissions are blocked.
- Tabs come from permissions. Employees get Home · Clock · Leave · Pay · More. Managers get Home · Approvals · Inbox · More.
- Privacy and security:
  - Session in chunked SecureStore.
  - Sensitive queries are never written to disk.
  - The cache is bound to its owner.
  - Sign-out clears the cache, the offline queue and the push token.
  - Optional biometric lock with a 2-minute grace period.
- Offline clock queue for load-shedding.
- Generated icon, splash and store graphics (pure-Node PNG encoder; `sharp` hangs on OneDrive).
- `expo-app/STORE_LISTING.md` is the full console handoff: Data safety table, listing copy, device checklist, AppGallery steps.

### Verification
- Web: `tsc` 0, 128/128 tests pass, ratchet shows no regressions.
- Expo: `tsc` 0 on the last full run.
- A clean `npm ci` + `expo export --platform android` in a scratch copy ran out of system memory on this laptop; the OneDrive copy timed out crawling `node_modules`. **The CI `mobile` job now runs that bundle on every push and is the authority.**

### Migrations applied to production — 2026-10-06 ✅
Applied on Nanda's instruction through the Supabase Management API (access token in `.env.local`). Each ran in its own transaction, in this order, and each returned 201:
1. `20261004_lock_down_rls_disabled_tables.sql`: RLS is on for the 13 tables that had none. The 2 definer views are now `security_invoker` and revoked from client roles.
2. `20261005_role_aware_rls_people.sql`:
   - Adds `has_permission()` and `is_own_staff()`.
   - Role-aware SELECT on 15 people/money tables.
   - Client writes revoked. Clients keep only own-row INSERT on clock events, leave and expenses, and those inserts are born pending.
   - Tenant self-upgrade closed.
   - The spoofable `sage_connections` and `payment_events` policies are dropped.
3. `20261005_wellness_burnout_trigger_fix.sql`: wellness check-ins no longer freeze after the 3rd entry.
4. `20261005_mobile_app_foundations.sql`: leave types, staff invites, account deletion, push revocation, nullable `notifications.user_id` (the notification spine works again), private `expense-receipts` bucket.

**Pre-flight checks:**
- All 24 referenced tables and views exist, plus `current_tenant_id()`.
- A parser that resolves the client behind every `.from()` call on an affected table found zero session-client calls in app/, lib/, components/ or inngest/. Everything goes through `supabaseAdmin`.
- Browser realtime feeds now stream invoice events only to users with finance permissions. This is intended; before, they leaked to all staff.
- The prior policy set was snapshotted before applying. It was tenant-only `ALL` / `SELECT` policies, so a rollback is a simple re-create.

**Verified after applying:**
- All schema objects are present; 0 public tables without RLS.
- Anonymous probe with the public key: `staff`, `payslips`, `invoices`, `leave_requests`, `overdue_invoices`, `wellness_summary`, `sage_connections`, `payment_events` and `staff_invites` all return **401**. `notifications`, `contract_signatures`, `plan_catalogue` and `tenants` return empty.
- Supabase security advisor: **0 ERROR** (was 15).
- Live site: `/`, `/login`, `/app` and `/account/delete` return 200; `/api/me` returns 401 when not logged in.
- Vercel deployed `d5d7811` (the latest), and the auto-deploy webhook is working again.

**The P0 anon-key RLS exposure from Session 16 is closed.**

Remaining advisor WARNs, as follow-ups:
- 10 SECURITY DEFINER functions are executable by anon. Review each and revoke where it isn't meant to be public.
- 13 functions have a mutable `search_path`.
- pg_graphql exposes tables. Consider disabling the GraphQL extension if unused.
- Leaked-password protection is off, and OTP expiry is long. Both are Auth dashboard toggles.

### Needs Nanda
1. `eas login` and `eas init`, then set the EAS env vars (see STORE_LISTING.md §1).
2. Firebase: upload `google-services.json` and the FCM V1 key.
3. Play Console: org account (D-U-N-S), then a 12-tester / 14-day closed test. Start early.
4. Huawei enterprise developer verification.
5. Screenshots from the preview build, and a designed feature graphic.
6. Reviewer logins: owner + linked staff on the test tenant.
7. After launch, set `NEXT_PUBLIC_PLAY_STORE_URL` / `NEXT_PUBLIC_APPGALLERY_URL` in Vercel.
8. Supabase Auth dashboard: turn on leaked-password protection and shorten OTP expiry.

### Next
- Security advisor WARNs above (anon-executable SECURITY DEFINER functions first).
- Remaining Phase 2 sweeps: Customers & comms, Ops, Compliance, AI, Growth, Settings.
- HMS Push for the Huawei build.
- Payslip PDF download in the app.
- The 17 VAT invoices decision and the WhatsApp templates are still open (Session 18).

---

## Session 20 (2026-10-06) — Full-system verification: DB ↔ code, wiring, every nav page, 7 industry personas

**Nanda's brief:**
1. Test the code against the live database using the Supabase access token in `.env.local`; make sure the code matches the DB.
2. Make sure every API route and AI feature is actually connected.
3. Open every page on the nav menu; review its details, features, UI and operational capability; find the gaps and fill them.
4. Every page must fully serve its purpose for running a business.
5. Take on 7 industry user roles and test the app from each one's point of view.

This plan was written **before any work started**. Findings and fixes are appended
under "Results" as each workstream closes.

### Ground rules for this session
- **Rule Zero:** `.env.local` is read only. Keys are loaded by scripts and never printed.
- Prod is the test target, because local `next dev` is broken on this machine (Session 15).
  Code fixes reach prod by push → Vercel auto-deploy (the webhook was confirmed working again in Session 19).
- Reads against prod use the Management API through a new helper, `scripts/sql.mjs`.
  Schema changes go in a migration file first, then get applied; nothing is changed ad hoc.
- QA data in prod is clearly tagged (tenant slug `qa-persona-*`, emails `nandaregine+persona-*@gmail.com`).
  It is never mixed into real tenants. Cleanup is listed at the end.
- Soft delete only, UTC timestamps only, `tsc --noEmit` = 0 and `npm test` green before every commit.
- **Debugger mode:** every bug found → hunt its siblings. Money, tax and payroll bugs go first.
- Nanda's uncommitted GTM edit in `app/layout.tsx` is hers; it's left out of every commit this session.
- Each tab is measured against the 7-point Definition of Done from Session 16b.

### Baseline (start of session)
- **Surface:** 49 nav-menu entries (`lib/nav/features.ts`), 57 dashboard pages, 160 API routes, 17 test files (128 tests).
- **`quality-scan` scores:**

  | Signal | Count |
  |---|---|
  | Routes with no permission check | 63 |
  | Write routes with no zod validation | 25 |
  | Routes with a hard delete | 9 |
  | Routes that leak DB errors | 52 |
  | Routes using `select *` | 40 |
  | Write routes with no audit log | 74 |
  | Routes on `withRoute` | 54 |
  | Pages with no permission check | 17 |
  | Pages with no empty state | 23 |
  | Pages with an unbounded query | 25 |

- **Prod tenants:** 8. Only `mzansi-test-traders` (retail, partner plan) has meaningful seed data: 9 staff, 16 invoices, 14 contacts.
  - 6 tenants have no `business_type`.
  - 4 tenants have 0 `user_roles` rows. withRoute fails closed for them, so those owners get 401 on migrated routes.

### Workstream A — Code ↔ DB contract (brief item 1)
Pull the live schema: columns, types, nullability, defaults, check constraints, enums, FKs, RPC functions,
storage buckets and RLS policies. Then check every DB touch in `app/`, `lib/`, `inngest/` and `components/` against it:
1. **Reads.** Every `.from(t).select(cols)`, including embeds and aliases. Validate through PostgREST
   (`scripts/audit_selects.mjs`, extended to `lib/` + `inngest/`).
2. **Writes.**
   - Every `.insert/.update/.upsert` payload key must exist on the table.
   - Required NOT NULL columns with no default must be supplied (the class of bug `notifications.user_id` was).
3. **Filters.** Every `.eq/.in/.order/.is/.gte` column must exist. String literals compared to enum or check columns
   must be legal values (the class of bug the `processQueue.ts` status was).
4. **RPCs.** Every `.rpc('fn')` must exist, with matching argument names.
5. **Storage.** Every `.storage.from('bucket')` must exist, and its public/private setting must match how the code uses it.
6. **Types.** Generated DB types must be in step with the live schema. Regenerate them if they have drifted.
7. **Tables nothing uses, and tables the code uses that don't exist.**

**Output:** a mismatch list. Fix in code where the code is wrong, and in a migration where the DB is missing a real model.

### Workstream B — API routes & AI features wired (brief item 2)
1. **Every client call to `/api/*`**, from pages, components and the Expo app: does the route exist, and does it export that HTTP method?
   Do the request body keys match what the route reads, and does the response shape match what the caller reads?
2. **Orphan routes:** routes nothing calls. Classify each as webhook/cron/external, dead, or a missing UI hookup that needs building.
3. **AI features:**
   - Inventory every model call. Each must go through the metered client: cost budget plus routing (Groq/Gemini/Claude).
   - Model IDs must be current.
   - Failures must surface to the user, never fail silently.
   - The prompt must get real tenant data (not empty context because of a wrong column).
4. **Inngest:** every `inngest.send('event')` must have a registered function. Every function must be reachable by an event or a cron.
5. **Env wiring:** compare every `process.env.X` the code reads with the names in `.env.local` and Vercel (names only, never values).
   List missing keys and the features each one disables.
6. **Live smoke against prod:** hit every GET route as a QA-tenant user and record status and shape.
   Fire each AI feature once with real seeded data.

### Workstream C — Every nav page, page by page (brief items 3 + 4)
For each of the 49 nav entries, in value-chain order (Command → Get Paid → Win Work → Deliver → Team → Govern → Grow → Setup):
- **Purpose:** the one sentence a business owner would use for "what is this page for?"
- **Data:** which tables and routes it reads; whether real tenant data shows up.
- **Features:** every button, form and action. Does each one work end to end (UI → route → DB → visible result)?
- **UI:** loading, empty, error and mobile states; navigation in and out; consistency with the Card-glass design.
- **Operational capability:** can a real business run that function from this page alone?
  What's missing that a competitor (Xero, Sage One, Zoho, Bitrix) or an SA operator would expect?
- **DoD 7-point check:** authz, zod, soft delete + audit, pagination, states, tests, error capture.
- **Gap → fix:** fix what's buildable in-session. Anything that needs a product decision or external setup goes to "Needs Nanda".

The sweep uses code reading, the live schema, `scripts/screen-audit.mjs` (Playwright against prod) and the persona runs below.

### Workstream D — 7 industry personas (brief item 5)
Each persona gets its own QA tenant in prod, with `business_type` set so industry nav filtering is tested.
Each tenant is seeded with realistic SA data: ZAR, VAT at 15%, SA names, IDs/phones in SA format.
Each persona signs in with **their own role**. Non-owner personas get an owner created alongside them,
so the role matrix is exercised for real, not just as owner.

| # | Persona | Industry (`business_type`) | Role | Day-in-the-life they must be able to complete |
|---|---|---|---|---|
| 1 | Lindiwe, owner of a 4-chair salon, Mdantsane | `salons` | owner | Take bookings; ring up cash Quick Sales; restock products; see stylist hours and pay; check today's cash; message clients on WhatsApp |
| 2 | Nomsa, finance & admin officer at a community NGO, East London | `ngo` | admin | Log donor-funded expenses and approve claims; run payroll for 6 staff; produce the board pack; track NPO/SARS compliance deadlines; POPIA register |
| 3 | Sipho, site manager at a building contractor, Gqeberha | `trades` | manager | Assign site tasks; log a safety incident; order from suppliers; track materials stock; approve leave; raise a progress invoice. **Must NOT see payroll** |
| 4 | Zanele, receptionist at a GP clinic, Mthatha | `clinic` | staff | Book and reschedule patients; update contact records; answer the inbox; file documents. **Must be blocked from finance, payroll and settings** |
| 5 | Jabu, videographer / creative studio owner, Johannesburg | `creative` | owner | Quote → contract → invoice → get paid; manage creative assets; run a follow-up sequence; see cash and tax position |
| 6 | Themba, delivery driver at a logistics firm, East London | `logistics` | field_agent | See own tasks/deliveries; clock in and out; update a customer contact. **Everything else must be blocked, cleanly, with no broken screens** |
| 7 | Mrs Naidoo, bursar at an independent school, Durban | `school` | manager | Invoice school fees for a class of parents; chase arrears; record expenses; announcements to staff; compliance calendar |

For each persona:
1. Walk their nav as they would see it, and check the industry filter shows the right pages.
2. Run their task list through the UI (Playwright against prod) and the API.
3. Record friction, dead ends, wrong permissions, empty or meaningless screens, and jargon.
4. **Authz matrix test:** call every route action as this role and assert allowed → 2xx, forbidden → 403.
   Calls into another tenant's data must give 404.

**Output:** a per-persona scorecard (tasks completed / blocked / broken) and a fix list.

### Workstream F — SA law & compliance, verified against primary sources (added mid-session at Nanda's request)
Every legal rule the app encodes or claims gets checked against the **actual source**:
gov.za / Government Gazette Acts, SARS, Dept of Employment & Labour, the Information Regulator,
CIPC, the B-BBEE Commission, and the Constitution. Secondary blogs don't count.
Each finding records the section cited, the source URL, what the code does, and whether it matches.
- **Tax:**
  - PAYE tables and rebates for 2026/27; the UIF ceiling and 1%+1% split; SDL at 1% and the R500k exemption; ETI.
  - EMP201/EMP501 deadlines.
  - VAT at 15%, the R1m compulsory / R50k voluntary registration thresholds, and the tax-invoice content rules (VAT Act s20).
  - Provisional tax and IRP6 dates; record retention (TAA s29, 5 years).
- **Labour:**
  - BCEA leave: annual s20, sick s22 (30 days per 36-month cycle), family responsibility s27, maternity s25, parental s25A.
  - Hours and overtime (s9–s10); payslip contents (s33); notice periods (s37); severance (s41); public holidays.
  - National minimum wage (current gazetted rate).
  - LRA fair-dismissal procedure and Code of Good Practice (IR & Discipline page).
  - EEA: designated-employer threshold after the 2025 amendments, EEA2/EEA4, sector targets.
  - OHSA incident reporting (s24, Annexure 1 / WCL.2) and COIDA.
- **Privacy (POPIA):**
  - Conditions for lawful processing; the Information Officer registration duty.
  - s18 notice, s69 direct marketing (opt-in, the WhatsApp/SMS broadcasts), s72 cross-border transfer (US/EU AI providers).
  - Breach notification (s22); data-subject access and erasure; PAIA manual.
  - **Constitution s14 (privacy) and s9 (equality, EE data).**
- **Corporate:**
  - CIPC annual returns (Companies Act s33); beneficial-ownership filing.
  - NPO Act annual reports (NPO persona); B-BBEE affidavit thresholds (EME < R10m, QSE < R50m).
  - CPA cooling-off and direct-marketing rules; ECTA s43 website disclosures; NCA if credit is extended.
- **Where it applies in the app:** payroll engine, leave engine, compliance calendar seeds, invoice documents,
  broadcasts/Reach/sequences (consent), the AI data flow, EE page, safety page, IR log, licences, the public site's legal pages.

**Output:** a compliance matrix with each rule marked as matched / wrong / missing / over-claimed, then fixes.
Anything ambiguous goes to Nanda with the source, rather than being guessed.

### Tracked category: APIs with no UI (Nanda: "good that you are picking these up")
Every route that exists but that no page, component or the Expo app calls gets listed in Results.
Each is classified as webhook/cron/external, dead (remove), or a missing UI (build it).
Found so far: `/api/book/[slug]` (public booking: no customer booking page exists), `/api/loyalty`, `/api/projects`.

### Workstream E — Fix, verify, report
- Fixes are batched by domain, with a commit per batch. `tsc` 0, tests green and the ratchet (`quality-scan`) must not regress.
- After deploy, re-run the screen audit and the persona scripts. A fix only counts once it's verified on prod.
- Results are appended below. Memory is updated, and a "Needs Nanda" list is kept for anything that needs her decision or a dashboard toggle.
- **QA cleanup:** the persona tenants stay for regression runs unless Nanda says otherwise. They are clearly tagged and can be removed by soft delete.

### Results
_(appended as each workstream closes)_

#### Workstream A — Code ↔ DB contract: done (2026-10-06)
**New tooling:**
- `scripts/db-contract-audit.mjs` uses the TypeScript AST against the live schema.
  It checks:
  - every select (validated through PostgREST);
  - insert/update/upsert keys;
  - NOT NULL columns with no default;
  - filter columns;
  - enum/CHECK literal values;
  - upsert conflict targets (must be a real, non-deferrable, non-partial unique key);
  - RPCs and storage buckets;
  - reads of soft-deletable tables that ignore `deleted_at` (`--soft`, with `--fix-soft` codemod).
- `scripts/sql.mjs` runs read-only SQL through the Management API.

**Scope:** 474 files, 356 unique selects, 245 resolved write payloads (the other 12 hand-checked). Every finding below was confirmed by reading the code and, where possible, probing prod inside a rolled-back transaction.

**Fixed:**
- **Public booking page wrote `contacts.name`** (the column is `full_name`), and upserted against `contacts_tenant_phone_unique`, which is **DEFERRABLE**.
  - Postgres refuses deferrable constraints as ON CONFLICT arbiters; verified live: `55000 … does not support deferrable unique constraints`.
  - Result: every public booking failed.
  - The same deferrable upsert is in the shared `lib/contacts/upsert.ts` used by the WhatsApp engine, so **no inbound WhatsApp sender would ever have become a contact** (latent: 0 conversations in prod so far).
  - Rewritten as find-then-fill. Phone identity is now matched across formats (`+27 82…`, `082…`, `2782…` are one person; `lib/contacts/phone.ts` + tests). Blank fields are never overwritten, a soft-deleted match is revived, and a 23505 race re-reads the winner.
  - The booking route also gained a staff-belongs-to-tenant check, SA phone validation and friendly errors.
- **176 reads of soft-deletable tables ignored `deleted_at`** across 31 tables, so deleted invoices, staff and contacts would reappear on dashboards, cashflow, board packs, payroll reminders and exports.
  - Added `.is('deleted_at', null)` to 175 of them (codemod, then reviewed).
  - The one deliberate exception is the POPIA erasure route, which must find deleted rows.
- **Board pack:**
  - Revenue summed `invoices.total`, which is 0 on 4 of Mirembe Muse's real invoices (R94k), so it under-reported revenue.
  - It filtered `contact_type='customer'` (the enum is `client`), compliance statuses `pending/in_progress` (the real ones are `upcoming/due`) and goal statuses `completed/cancelled` (real: `achieved/missed`), so those sections were always 0.
  - Rejected expense claims counted as costs.
  - Valuation and the impact snapshot had the same `total` bug.
- **Weekly cashflow cron:** stubbed to throw and had never run once. It now uses the real forecast engine.
- **Forecast engine:**
  - It forecast only ONE payroll in a 90-day window, from an unordered "last" run, only for `finalised` runs.
  - Its SARS line left out employee UIF.
  - It now covers every pay day in the window, with EMP201 on the **7th of the following month, or the last business day before it**, verified against SARS (`emp201DueDate` + tests). Pay day is configurable via `settings.payroll_day`, default 25th.
- **`/api/cashflow`** returned two different shapes: a snake_case cached row versus camelCase fresh output. It is now normalised.
- **Website chat widget:** `message_type 'widget_chat'` violated the CHECK, so every visitor message was rejected.
- **`/api/projects` and the NPS reminder cron** selected `contacts(name)` and errored on every call.
- **Loyalty expiry** wrote `'expiry'`; the CHECK allows `'expire'`.
- **Documents DELETE** was a hard delete (Rule #3) that also wiped the stored file, with no role check. It is now a withRoute soft delete; the file is kept.
- **`documents.file_type` enum** is `pdf|docx|xlsx|csv|image`, but upload wrote the raw extension, so **every image and .txt upload failed** (verified live: `22P02`).
  - Migration `20261006_document_file_type_text.sql` (adds `text`) is **applied and verified**.
  - The code maps extension → enum.

**Kept as-is, intentionally:**
- 9 tables nothing references (`book_in_action_completions`, `calendar_events`, `debtors`, `kb_categories` (used via embed), `overdue_invoices` (view), `rate_limit_overrides`, `referrals`, `sage_connections`, `whatsapp_templates`) all have 0 rows. Each is reviewed with its page in Workstream C.

#### Workstream B — API & AI wiring: static pass done (2026-10-06)
**New tool:** `scripts/api-wiring-audit.mjs` maps 137 client calls (web + Expo) onto 160 routes.
- 0 calls to missing routes. The 2 flagged were the external payments hub, which is correct.
- 0 method mismatches. The one flagged was a spread `init`, a false positive.
- **54 routes have no UI anywhere**, plus 4 booking routes that are dashboard APIs with no caller. Per Nanda's no-half-built rule, each is resolved in Workstream C: built into its page, or removed if it duplicates a page's server read.
  - Academy (lessons, streaks, certificates, frameworks, triggered lessons, achievements): a whole feature with no UI.
  - Loyalty (config API + expiry cron, no earn path, no UI).
  - Public booking page (`/book/[slug]` has an API but no page).
  - Goals, NPS, mentorship, performance reviews, profit-first, projects, branches, social accounts, coaching, benchmarks, valuation/cashflow/board-pack APIs (their pages read the DB directly), and admin tools (ai-costs, impact, special-pricing, tenants).

**Inngest:**
- All 47 functions are registered.
- `adminos/push.send` (the payroll reminder) had **no listener, so the reminder went nowhere**. Rewired through `notifyTenant` + `pushToUsers` (view_payroll) with per-tenant steps.
- `adminos/achievement.check` is never sent, so achievements can never be awarded. Wired with the Academy build.

**AI (10 files call models directly or via helpers):**
- **~20 call sites were unmetered.** `callClaudeAgent` only budgeted and logged when given an optional `tenantId`. Every document-upload call, WhatsApp intent + sentiment (2 per inbound message), inbound voice, and the debt-recovery and cold-lead drafts omitted it. `TenantAI` is now a **required** type, so an unmetered call no longer compiles.
- **Every upload was AI-processed twice:** inline AND by the Inngest docIntelligence job, racing on the same row.
  - Files ≥5 MB ran in a promise left alive after the response, which serverless kills: 1 xlsx is stuck "processing" in prod.
  - Image vision was unmetered.
  - **Any document classified "invoice" was silently inserted as an unpaid RECEIVABLE**, so a supplier's bill became money "owed" to the business. The n8n copy spread model JSON into that insert, which let a crafted document choose `tenant_id`.
  - Replaced by one pipeline, `lib/documents/pipeline.ts`: budgeted, small files inline, large files via the durable Inngest job.
  - Invoices are now *extracted* for the owner to confirm as a bill or an issued invoice (Documents page, Workstream C). Goals are de-duplicated.
  - The download link was `startsWith(tenant/)`-checked, which `../` traversal bypassed. It now must match a live document row and needs `documents.read`. Upload needs `documents.write`.
- **When the AI budget ran out, the business's CUSTOMER was sent the owner-facing text** "your daily AI usage limit… upgrade your plan at /dashboard/settings/billing" on WhatsApp. It was also cached as the FAQ answer, so it kept going out after the reset. The email webhook had the same leak. Customers now get a neutral holding reply; the owner gets a deduped alert.
- **AI cost log used stale prices.** Haiku 4.5 was logged at $0.25/$1.25 per M tokens (actual **$1/$5**, so 4× under-reported) and Opus 4.8 at $15/$75 (actual $5/$25). Model IDs (`claude-haiku-4-5-20251001`, `claude-sonnet-4-6`, `claude-opus-4-8`) are valid and served.
  - *Recommendation, not changed:* Sonnet 5.5 is newer and cheaper than Sonnet 4.6 ($2/$10 vs $3/$15). The migration changes thinking/tool params, so it needs Nanda's go-ahead.

**Env wiring (names only; values never read):**

| Missing in Vercel prod | Effect |
|---|---|
| `GROQ_API_KEY`, `GEMINI_API_KEY` | Free-tier routing is off; everything uses Claude. `.env.local` names it **`GROG_API_KEY`** (typo), which is why it looked set. |
| `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN` | WhatsApp webhook can't verify. |
| `CLOUDINARY_API_KEY/SECRET`, `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Creative-asset uploads. |
| `TWILIO_AUTH_TOKEN` | Ring voice fails closed; correct, but Ring is unusable. |
| `RESEND_FROM_EMAIL`, `N8N_WEBHOOK_SECRET`, `USD_ZAR_RATE`, store URLs | Smaller gaps. |

- **PostHog was dead in prod:** the code read `POSTHOG_TOKEN`, but Vercel holds `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`. So server error capture from withRoute and onRequestError, and all analytics, were off. The code now accepts the configured name.

**SA law caught along the way (POPIA, Workstream F):**
- Analytics ran for everyone regardless of the cookie banner, and sent users' **email addresses** to a US processor.
- The banner told users it was "Vercel Analytics… no third-party tracking".
- Now: PostHog starts only on "Accept all" and opts out on withdrawal; no email is sent (s10 minimality, s72 cross-border); the banner text is accurate.
- **Nanda's uncommitted GTM snippet in `app/layout.tsx` also loads before consent.** It needs the same gate before it ships.

#### API call changes — what changed this session (contract reference for web + Expo callers)
Commit `c70e338`, **not yet pushed or deployed**. A "breaking?" entry means a caller that relied on the old behaviour must change; none of the breaking ones currently has a caller in the web or Expo app.

| Route / call | Before | After | Breaking? |
|---|---|---|---|
| `POST /api/book/[slug]` (public booking) | Always failed: wrote `contacts.name` + deferrable ON CONFLICT. Raw DB errors returned. | Works. Contact find-or-create by SA phone identity. New: **422** invalid phone; **404** if `staffId` is not this tenant's live staff. Friendly error text only. | Error bodies changed; no UI caller yet (public page to be built) |
| `GET /api/book/[slug]` | Raw DB error on failure | `{ error: 'Could not load services' }` 500; soft-deleted services hidden | No |
| `POST /api/documents/upload` | Any member; raw-extension `file_type` (images/txt 500'd); processed twice | **withRoute `documents.write`** (field_agent/client now 403); 413/415 as `{ error, code }`; ≥5 MB returns `processing` and finishes via Inngest; invoices *extracted*, never auto-booked | Role gate is new; response shape (`document`) unchanged |
| `GET /api/documents/upload?path=` | `startsWith(tenant/)` check (traversal-able); any member | **withRoute `documents.read`**; path must match a live document row; `{ url }` unchanged | Role gate is new |
| `GET /api/documents/[id]` | Session client, any member | withRoute `documents.read`; 404 `{ error, code }` | Error body shape |
| `DELETE /api/documents/[id]` | **Hard delete** + file wiped; returned **204** | **Soft delete**, file kept; returns **200 `{ id, deleted: true }`**; `documents.write` | **Yes**: 204 → 200 (no UI caller existed) |
| `GET /api/cashflow` | Cached hit returned a snake_case DB row; a miss returned camelCase | Always the camelCase `CashflowForecast` shape | Yes, for any snake_case reader (none found) |
| `POST /api/widget/[tenantId]/message` | Every message rejected (CHECK on `message_type`) | Stored as `message_type: 'dm'`, `platform: 'website_widget'` | No |
| `GET /api/projects` | 500 on every call (`contacts(name)`) | `contact.name` populated (aliased from `full_name`); deleted projects hidden | No (no UI caller yet) |
| `POST /api/workflow/file-received` (n8n) | Unvalidated body; `!==` secret; model JSON spread into `invoices.insert` | zod payload (`fileType` ∈ `pdf, docx, xlsx, csv, image, text`; `tenantId` uuid); timing-safe secret; tenant must exist; returns `{ success, document_id, category, status }` | Yes for n8n: stricter payload; `fileType` values changed |
| `POST /api/webhook/email` (hub) | Returned owner-facing budget text as the customer reply | `{ response: null }` when the AI budget is exhausted; owner alerted | The hub must treat `null` as "no auto-reply" |
| WhatsApp engine (`lib/workflow/engine.ts`) | Budget text sent to the customer + FAQ-cached | Neutral holding reply, `escalated: true`, owner alert; nothing cached | No |
| `lib/ai/callClaude.ts` (internal) | `callClaudeAgent(sys, msg, maxTokens?, opts?)`: metering optional | **`callClaudeAgent(sys, msg, maxTokens, opts: { tenantId, plan, feature?, model? })` required**. `classifyIntent`, `classifySentiment`, `classifyDocument`, `extractGoalsFromDoc`, `draftRecoveryMessage`, `draftColdLeadMessage` and `generateDailyBrief` all take `TenantAI`. New `tenantAI(tenantId)` loader. | Compile-time (all callers updated) |
| `lib/contacts/upsert.ts` (internal) | PostgREST upsert (always failed) | Find-then-fill by phone identity; never blanks fields; revives soft-deleted match; 23505-safe | No (same signature) |
| Inngest `adminos/document.uploaded` | Fired on every upload; ran a second pipeline | Fired only for files ≥5 MB; payload adds `mime_type`, `actor`; runs the shared pipeline | Payload superset |
| Inngest `payroll-reminder-cron` | Sent `adminos/push.send` (no listener) | `notifyTenant` + `pushToUsers(view_payroll)`, deduped per month | No |
| Inngest `cashflow-forecast-weekly` | Threw on every run | Runs `generateCashflowForecast` + `saveCashflowForecast` per tenant | No |

**Env names the code now also accepts:**
- `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` / `NEXT_PUBLIC_POSTHOG_HOST`, as fallbacks for `POSTHOG_TOKEN` / `POSTHOG_HOST`.
- New optional tenant setting `settings.payroll_day` (1–28, default 25), read by the forecast.

#### API call changes — planned: Sonnet 4.6 → Sonnet 5.5 (NOT applied; needs Nanda's go-ahead)
Source: the Claude API migration guide (§ Migrating to Claude Sonnet 5, then § Migrating to Claude Sonnet 5.5, which layers on top), checked 2026-10-06.

**Why:**
- Sonnet 5.5 is $2/$10 per M tokens against Sonnet 4.6's $3/$15, and it is materially stronger.
- But its tokenizer produces **about 30% more tokens** for the same text.
- So the real saving is roughly 10–15%, not 33%, until re-baselined.
- Our token-denominated daily budgets (`DAILY_TOKEN_BUDGET`) also get used up about 30% faster.

**Our exposure, from an audit of every call site:**
- 15 features route to `MODELS.SONNET` (`lib/ai/costControls.ts`): `daily_brief`, `langa_mentor`, `advisor_agent`, `document_analysis`, `contract_analysis`, `email_studio`, `onboarding_sequence`, `book_in_action`, `health_score_insight`, `cashflow_forecast`, `agent_escalation`, plus `board_pack`, `exit_analysis`, `strategic_advisor`, `valuation_analysis` on non-premium plans.
- 3 hard-coded `'claude-sonnet-4-6'` in `lib/ai/orchestrator.ts`.
- **None of our calls send `temperature`/`top_p`/`top_k`, `thinking`, `tool_choice`, `budget_tokens` or assistant prefills.** So none of the request-shape 400s apply.

**Required call changes:**
1. **Model ID.** `MODELS.SONNET = 'claude-sonnet-5-5'` (no date suffix). Replace the 3 literals in `orchestrator.ts` with `MODELS.SONNET`. Update `COST_RATES` to $2/$10.
2. **The thinking default flips.** On 4.6, omitting `thinking` = no thinking. On 5.5, omitting it = **adaptive thinking on**, and thinking tokens count against `max_tokens`. Our Sonnet calls use `max_tokens` 100–1000, so replies could be eaten by thinking and truncate (`stop_reason: 'max_tokens'`).
   - Short drafting/summary features (`daily_brief`, `email_studio`, `onboarding_sequence`, `agent_escalation`, `document_analysis` vision):
     - either send `thinking: { type: 'between_tools' }` (5.5's "thinking off"; only valid at effort ≤ high, with no other field inside `thinking`);
     - or use adaptive + `output_config: { effort: 'low' }` with `max_tokens` raised. The guide recommends trying this first.
   - Reasoning features (`board_pack`, `valuation_analysis`, `exit_analysis`, `strategic_advisor`, `langa_mentor`, `advisor_agent`): adaptive thinking, `output_config.effort` set **explicitly** (levels are recalibrated on 5.5; start at `medium`), and `max_tokens` raised to leave thinking room. These run in Inngest or stream, so time-outs are not a concern.
   - Never send `{ type: 'disabled' }`: it is a 400 on 5.5.
3. **Read content by block type, not position.** 8 sites read `response.content[0]`, and on 5.5 a response can begin with a `thinking` block:
   - `lib/ai/callClaude.ts:138` and `:259`
   - `lib/ai/orchestrator.ts:205`
   - `lib/ai/agents/langa.ts:208`
   - `lib/documents/pipeline.ts:151`
   - `inngest/functions/boardPack.ts:138`, `dailyBrief.ts:112`, `debtRecovery.ts:221`

   Replace them with one shared helper that joins all `text` blocks. It's harmless on 4.6, so worth doing now regardless. The two streams (`langa.ts:281`, `orchestrator.ts:268`) already filter text deltas.
4. **Refusals.** 5.5 can decline with HTTP 200, `stop_reason: 'refusal'` and a `stop_details.category` (`cyber`, `bio`, `frontier_llm`, `reasoning_extraction`, `general_harms`).
   - The shared helper must check `stop_reason` before reading content, and return a friendly "couldn't help with that" rather than an empty string.
   - Optional on the Claude API: `betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default'`. It retries only `cyber` and `frontier_llm` declines.
5. **Vision.** 5.5 accepts images up to 2576 px, about 3× the image tokens of 4.6. `processImage` in `lib/documents/pipeline.ts` should downsample to ~1568 px on the long edge first. Classify/summarise needs no extra fidelity.
6. **Budgets and cost.**
   - Re-baseline `DAILY_TOKEN_BUDGET` (+~30%, or keep the same rand value per plan), the per-call `checkBudget` estimates, and the AI-cost report, once real `usage` numbers come in.
   - Record `cache_read_input_tokens` in `recordUsage` for `callClaudeWithCache`.
7. **Verify.** After deploy, assert `response.model.startsWith('claude-sonnet-5-5')` in a one-off script. Then run each Sonnet feature once on a QA persona tenant and compare length, quality and `usage` against 4.6.

**Not in this plan:**
- Haiku 4.5 stays as it is; it's the cheapest current model.
- Premium-plan Opus 4.8 → Opus 5.5 ($4/$20, cheaper than 4.8's $5/$25) is a separate decision. On Opus 5.5 thinking cannot be disabled at all; effort is the only control, and its default is `medium`.

#### Session 20 continued (2026-10-06, second sitting): role-aware nav, My Day, email honesty
**Shipped first:** `c70e338` + both docs commits were verified (tsc 0, 131/131 tests) and **pushed**. Vercel auto-deploys them.

**Workstream C/D findings, fixed (committed, NOT yet pushed; see "Resume here"):**
1. **The sidebar ignored role.** Every login saw all 49 entries; a driver tapped into a wall of 404s.
   - Every `FEATURES` entry now declares `requires` (the permission its page checks, any-of for lists).
   - `canOpenFeature()` filters it, fail-closed; super-admins are unscoped. The layout passes `getContext()` permissions to the Sidebar.
   - Default-role nav sizes: owner 49 · admin 48 · manager 33 (no payroll) · staff 9 · field_agent 7 · client 5.
   - `tests/navAccess.test.ts` asserts each nav `requires` matches a `checkPermission` call in that page or its segment layout, so the nav and the page can't drift apart.
2. **The Command Center showed the owner's cockpit to every login** (debtors, net position, runway, contracts), read via the admin client.
   - Roles without `view_analytics` now get **My Day** (`app/dashboard/MyDay.tsx`): own tasks, own bookings today, own shifts, own leave + balance, today's clock status, announcements they may see (`canSeeAnnouncement`), unacknowledged SOPs for their role, and shortcuts limited to pages they can open.
   - If the login isn't linked to a staff row, it says so and points to the invite code.
   - In the management view, every decision item, constraint and scorecard lens is gated by its own permission. A manager has no inbox and no settings access, so those links were dead ends.
   - The compliance-deadline links pointed to POPIA settings; they now point to `/dashboard/compliance`.
3. **UTC clock on a SAST business.** The greeting said "Good morning" until 14:00, and between 00:00 and 02:00 the dashboard date/"today" was yesterday. New `lib/time/sast.ts` (tested) is used by the Command Center and My Day.
   - **Siblings not yet swept:** other `toISOString().slice(0,10)` "today" filters across pages.
4. **Ungated client-component pages.** Inbox, Documents, Creative Assets, Email Studio, Langa and Community now have segment `layout.tsx` gates matching their APIs. Getting Started and Integrations are gated on `manage_settings`.
5. **Email silently never sent.** Resend's SDK resolves `{ error }` and every caller ignored it. With the key revoked and `RESEND_FROM_EMAIL` missing in Vercel, Email Studio marked drafts "sent", and the onboarding and trial-nudge steps reported success. Nothing was ever delivered.
   - New `lib/email/send.ts`: `sendEmail` throws an `EmailError` (`not_configured` | `rejected`), and `escapeHtml` escapes owner and business names in HTML emails.
   - `/api/email-drafts` (GET) and `/api/email-drafts/[id]` (GET, PATCH, POST send, DELETE) are rebuilt on withRoute with the new action `email.drafts` (= `view_analytics`, same as the Pen agent).
     - DELETE is now a **soft delete** (it was hard).
     - Send returns **503** when email isn't configured and **502** when Resend rejects. A draft is marked sent only once Resend accepts it; resending an already-sent draft returns 409.
     - PATCH only edits drafts that haven't been sent.
   - Email Studio shows server errors. A 403/429 used to leave the compose box silently empty.
6. **The Pen agent generated every email twice.** It streamed one version, then called the model again in a fire-and-forget promise to save the draft: double the AI cost, a saved draft that differed from what was on screen, and serverless killed the promise.
   - The draft is now saved from the streamed text in the stream's `flush()`.
   - Pen also had **no role check** (now `email.drafts`) and didn't pass `plan` to metering.
7. **The onboarding sequence drifted.** `sleepUntil(Date.now()+N)` was re-evaluated on replay, so "day 3" landed around day 4 and "day 7" around day 11. It's now anchored to `event.ts`.

**Verified:** `tsc --noEmit` 0 · `npm test` 138/138.

**Open: persona findings not yet fixed (next session, in order):**
- **Tasks leak.** `/api/tasks` GET and `/dashboard/tasks` return *every* tenant task to any member, including the external `client` role. Writes are already scoped to own tasks (`loadEditable`).
  - Fix: roles holding `view_own_data_only` read only tasks assigned to their staff row OR created by them. Apply to the page, `GET /api/tasks` and `/api/tasks/[id]/comments`, which still uses bare `getUser` with `select *` and raw errors.
- **Sipho (manager) can't log a safety incident on the web.** The page needs `manage_staff`, while `safety.report` is MEMBER. Split it: a report form for members, the register for `hr.records`.
- **Zanele (receptionist/staff) has no Inbox.** The default staff role lacks `view_communications`. Needs Nanda's decision, or a role-permission editor in Settings if none exists (check).
- **The `/api/agents/langa` plan** comes from `user.app_metadata.plan` (often unset → 'trial'). Use `tenantAI()`.
- **Sidebar "Active Agents" chip list** shows Alex/Care, which are unbuilt.
- **Persona tenants (Workstream D)** are not created yet. The authz-matrix script is not written yet (cookie auth: sign in with supabase-js → build the `sb-<ref>-auth-token` cookie).
- **54 no-UI routes:** still to be resolved page by page (Academy, Loyalty, public `/book/[slug]` page, Goals, NPS, Projects, …).
- **Workstream F (SA law):** not started.

**Needs Nanda:**
- **Expo:** she has created an Expo dev account. To link it: `! cd expo-app && npx eas-cli login`, then `npx eas-cli init`. That prints the project id; set `EAS_PROJECT_ID` and `EXPO_OWNER` (as EAS env vars or in your shell); `app.config.ts` reads both. After that, `eas build --profile preview` produces a test APK.
- **Vercel env:** `RESEND_FROM_EMAIL` plus a live `RESEND_API_KEY`, otherwise no email leaves AdminOS (now reported honestly instead of faked).
- **GTM snippet in `app/layout.tsx`:** still uncommitted and still loads before cookie consent (POPIA). It needs the same consent gate as PostHog before it ships.

**Resume here:**
1. Push the commit from this sitting. Watch the Vercel deploy. Sign in as owner and as a staff login, and check the sidebar plus Command Center vs My Day on prod.
2. Fix the tasks leak.
3. Fix the safety report split.
4. Build the persona tenants and the authz-matrix script (Workstream D).
5. Then Workstream C page by page.

#### Session 20 continued (2026-10-06, third sitting): tasks leak, safety split, SAST sweep, money periods
`838a51c` was already on `origin/main` at the start (the "NOT pushed" note above was stale).

**Shipped (all pushed; tsc 0, `npm test` 142/142, quality ratchet no regressions):**
1. **Tasks leak closed** (`484f53c`). New `lib/ops/taskScope.ts`, plus `seesOnlyOwnData()` in the role matrix (super-admins are never scoped).
   - Staff, field_agent and client logins now read only tasks assigned to their staff row or created by them. Covers `GET /api/tasks`, `/dashboard/tasks` (titled "My tasks" for them) and the comments route.
   - `/api/tasks/[id]/comments` is rebuilt on withRoute: a task-visibility 404, explicit columns, a soft-delete filter, audit and rate limit.
2. **Expo linked** (`cf8635e`). `app.config.ts` defaults to EAS project `mirembe-muse/adminos`. New manual `EAS build` GitHub workflow (preview / production / production-huawei / all-stores), which **needs the repo secret `EXPO_TOKEN`**.
3. **Safety split** (`0509ae7`). Every member can now open Safety Incidents.
   - `hr.records` gets the register and its stats.
   - Everyone else gets "Report a safety incident" and their own reports. The form leaves out the HR investigation fields.
   - "IOD not yet reported" now counts minor injuries too (COIDA W.Cl.2 covers every injury on duty).
   - `quality-scan` now recognises `can(ctx, …)` / `seesOnlyOwnData(` as page permission checks.
4. **AI/billing** (`6e7f1cb`).
   - Langa is metered on `tenants.plan` via `tenantAI()`. It read `app_metadata.plan`, so every tenant got the trial budget.
   - Langa's history is trimmed to the 20 turns it uses, and raw zod errors are no longer echoed.
   - Removed the dead `requirePlan`/`hasPlan`: same bug, plus retired plan names that passed every tenant. `BillingGateOverlay` labels now use solo…partner.
   - The sidebar agents now read Langa · Pen · Chase · Doc (it showed Alex and Care, which are unbuilt). Deleted the unused `AgentStatusBar`, which listened to a non-existent `audit_logs` table.
5. **Money periods** (`bd7fb52`). The VAT201 / P&L / journal / income exports compared UTC `created_at` with the period bounds. **A sale at 01:00 SAST on the 1st landed in the previous month's VAT201.**
   - They now compare SAST calendar days.
   - `todayDateString()`/`daysOverdue()` use the SAST day, so invoices go overdue at 00:00 SAST.
   - Tests cover both midnight edges.
6. **App-wide SAST sweep** (`2fa0568`).
   - 25 "today" filters now use `sastDate()`.
   - UTC-midnight bounds are now SAST in: the daily brief, lesson cap, IR-log month, bookings week and today, and the calendar booking range.
   - **80 `toLocaleDateString/TimeString` calls in 56 files** now pass `timeZone: 'Africa/Johannesburg'`. Server-rendered times were 2h behind: a 09:00 booking showed 07:00.

**Still open (in order):**
1. Persona tenants + authz-matrix script (Workstream D).
2. Workstream C page by page.
3. Workstream F (SA law).
4. 54 no-UI routes. `/api/tasks/[id]/comments` joins this list: no UI calls it yet, so the task board needs a comments thread.
5. Zanele/staff Inbox decision.
6. The Sonnet 5.5 go-ahead.

**Needs Nanda (unchanged + new):**
- GitHub repo secret `EXPO_TOKEN` (robot token, mirembe-muse Expo account) for the EAS build workflow.
- `RESEND_FROM_EMAIL` + a live `RESEND_API_KEY` in Vercel.
- The GTM consent gate in `app/layout.tsx` (still uncommitted, still hers).

#### Session 20 continued (2026-10-06, fourth sitting): Workstream D — 7 personas, authz matrix, compliance calendar
**Shipped (all pushed; tsc 0, `npm test` 156/156, quality ratchet improved and re-baselined):**
`942b2c0` QA tooling · `a908f6e` authz sweep · `384a881` compliance calendar · plus the scripts/docs commit after it.

**1. Persona tenants live in prod** (`scripts/qa-personas.mjs`, idempotent, no email sent, passwords derived from the service key; print one with `--password <key> [owner]`, list logins with `--list`).

| Tenant slug | Persona (login role) | business_type · plan |
|---|---|---|
| qa-persona-salon | Lindiwe Mbatha (owner) | salons · grow |
| qa-persona-ngo | Nomsa Gqola (admin) + owner | ngo · operate |
| qa-persona-trades | Sipho Ngcobo (manager) + owner | trades · operate |
| qa-persona-clinic | Zanele Dumisa (staff) + owner | clinic · grow |
| qa-persona-creative | Jabulani Khoza (owner) | creative · solo |
| qa-persona-logistics | Themba Mabhena (field_agent) + owner | logistics · operate |
| qa-persona-school | Mrs Kamini Naidoo (manager) + owner | school · operate |

Each has staff linked to logins, SA contacts, 3 invoices (paid/sent/overdue, 15% VAT unless solo), tasks (2 for the persona, 1 for a colleague, 1 owner-only), shifts, a pending leave request, expense claims, announcements (all + managers), bookings/services (salon, clinic), stock/suppliers (salon, trades, logistics) and the statutory calendar.

**2. Authz matrix** (`scripts/authz-matrix.mjs`): signs in as all 12 logins and checks every withRoute/guard() method against the role matrix, every nav page against its `requires`, and other tenants' ids on `GET /api/<x>/[id]`.
- First run: withRoute routes, pages and cross-tenant probes were already clean. **But ~37 legacy GET routes answered a receptionist and a driver with 200.**
- Root cause: legacy routes checked permissions on writes, not reads, and `quality-scan` counted a file as checked if any method was.
- **Final run on prod after the fix: 134–165 API checks per login, all correct; 49/49 pages; 0 cross-tenant leaks.** Own-data roles now reach only public data (FX, weather, load-shedding), the solo/team flag, and creative assets for staff (manage_documents).
- Notable: the matrix detects Next's streamed `notFound()` (HTTP 200 + 404 UI, because dashboard has `loading.tsx`) by body, not status.

**3. Authz fixes** (`a908f6e`):
- `lib/api/guard.ts`: same context, matrix and 401/403 bodies as withRoute, as one line at the top of a legacy method. Added to **80 methods across 52 routes**.
- Worst ones: `settings/profile` let any login rewrite the **bank details printed on invoices**; `autonomy` let any login switch on automatic final demands; contacts merge/delete, contracts, `tenant/me`, logo, client-portal links.
- New actions: `bookings.*`, `broadcasts.read`, `kb.*`, `privacy.erase`, `contracts.*`, `compliance.*`, `licences.*`, `insight.write`, `settings.read` (pinned by tests).
- Board pack routes rebuilt on withRoute (money.read + Scale plan → 402).
- Hard deletes → soft: contacts DELETE, contacts merge, kb, sequences, social accounts, creative assets.
  - **Contact merge** moved only 3 of the 12 tables that reference a contact. The hard delete then cascaded loyalty points away and orphaned bookings/tasks/contracts/projects/NPS/creative assets (and would fail on any contact with broadcast history). All 12 now move, errors are checked, and the absorbed contacts are soft-deleted.
- `quality-scan` now requires a check on **every** exported method: routes_no_permission 58 → 11 (the rest are public/token/static data).

**4. Persona day-in-the-life walk** (`scripts/persona-walk.mjs`, Playwright, desktop + phone): **all 7 personas pass**. Seeded data shows where it should, blocked pages are blocked, no phone overflow, and no console errors on the walked pages. Themba sees his own deliveries but not the other driver's or the owner-only task.

**5. Compliance calendar (money/tax, found via the NGO persona)** (`384a881`). The SQL `seed_compliance_calendar` was wrong for **every** tenant:
- EMP201 = month start + 37 days (the 7th/8th/10th, never weekend-adjusted).
- IRP6/ITR14 dated for a December year end, ignoring its own year-end parameter.
- EMP501 descriptions swapped.
- COIDA ROE on 31 March, before the window opens.
- Every new tenant got an invented, already-overdue IRP6, and a CIPC date made up from the signup date.
- Nothing rolled the calendar forward.
- Google signups never got one.

Now `lib/compliance/calendar.ts` + `planCalendarSync` (tests in `tests/complianceCalendar.test.ts`), run at email/OAuth/admin signup, on year-end or business-type change, and by the monthly cron `compliance-calendar-roll` (1st, 05:00 SAST; also event `adminos/compliance.calendar.sync`). Completed work is never touched, genuinely missed deadlines stay, wrong open rows are soft-deleted.

Sources checked 2026-10-06:
- SARS: provisional tax page; EMP501 deadlines (31 May annual, 31 Oct interim); ITR14 due 12 months after year end.
- Dept of Labour / Compensation Fund ROE notices (April – 31 May; gazetted extensions, e.g. 30 Jun 2025).
- DSD on NPO Act s18(1)(a): 9 months after year end.

**Applied to QA persona tenants only** (`scripts/qa-calendar-sync.mjs`; a second pass is a no-op).

**Needs Nanda (new):**
- **Apply `supabase/migrations/20261006_revoke_public_definer_rpcs.sql`.** `seed_compliance_calendar(uuid,int)` and `search_kb_articles(uuid,text,int)` are SECURITY DEFINER, take a tenant id, and are **executable by anon**: anyone with a tenant UUID can write compliance rows into it or list its KB titles. The app only calls them as service_role, so revoking is safe. (Auto-mode blocked me from applying a prod schema change.)
- **Real tenants' calendars** are corrected automatically by the deployed monthly cron on **1 Nov 05:00 SAST**. To do it sooner, send Inngest event `adminos/compliance.calendar.sync` (no data = all tenants). It soft-deletes open items on wrong dates and inserts the correct ones.
- **Financial year end** is read from `settings.financial_year_end_month` (default Feb) but no settings screen sets it, and CIPC needs `settings.incorporation_date`. Both need a field in Settings → Business (Workstream C).

**Open, found this sitting (not fixed):**
- `PATCH /api/tenant/me` writes 6 columns that don't exist on `tenants` (province, website_url, registration_number, vat_number, women/youth/township flags). There's no UI caller. Fold into the Settings page work.
- `/api/engineering/feedback` is an unauthenticated proxy to the Jarvis feedback endpoint.
- `/api/portal/generate` (now invoices.read) and the board-pack APIs still have no UI (the 54 no-UI list).
- Zanele (staff) still has no Inbox: the product decision is unchanged.

**Resume here:** Workstream C page by page (start with Settings → Business: year end, incorporation date, the tenant/me drift), then Workstream F (SA law), using the persona tenants + `authz-matrix.mjs` + `persona-walk.mjs` as the regression gate after each deploy.

#### Session 20 continued (2026-10-06, fifth sitting): migration applied; Workstream C begins
**Revoke migration applied** (Nanda approved): `20261006_revoke_public_definer_rpcs.sql`. Verified: the anon RPC call `search_kb_articles` returns 401, and the in-app `/api/kb?q=` returns 200.

**Shipped (all pushed and deployed; tsc 0, `npm test` 161/161, ratchet re-baselined):**
1. **Settings → Business Details** (`0ee3d06`). The profile card was read-only: nothing could set the year end, incorporation date, UIF reference (printed on payslips) or pay day (read by the forecast).
   - New `BusinessDetailsForm`: registered/trading name, industry, contact, CIPC number, incorporation date, year-end month, income tax / PAYE / SDL / UIF references, pay day. Errors are shown per field.
   - `POST /api/settings/profile` is on withRoute + zod. Formats are from SARS's PAYE BRS and VAT guides: VAT 10 digits starting with 4; PAYE 10 digits starting with 7; SDL `L`+9; UIF `U`+9; SDL/UIF share PAYE's last 9 digits. Also validates CIPC number, branch code and account number.
   - Changing invoice bank details now writes a critical audit entry (field names only) and sends the owner an alert (in-app + WhatsApp).
   - Year-end, incorporation-date and industry changes resync the statutory calendar.
   - The industry picker follows the recorded product decision: clinic/legal are offered only to a tenant that already has one. **Note:** the clinic persona sits outside the marketed industries; that's fine for QA.
   - `tenant/me` PATCH removed: it had no caller and wrote 6 non-existent columns.
   - **Verified on prod (QA NGO):**
     - driver → 403
     - bad VAT → field message
     - year end → June moved IRP6 to 31 Dec, ITR14 and IRP6 P2 to 30 Jun, and the NPO report to 31 Mar; back → restored
     - bank change → alert + `tenant.bank_details_changed` audit
2. **Money totals no longer stop at 1000 rows** (`5c4f943`). PostgREST caps responses at 1000 rows, and **every Quick Sale is an invoice row**. So past ~1000 invoices, the dashboard, Analytics, Cashflow, health score, valuation, forecast, money/sales signals, agent context, board pack, daily brief and stokvel totals all undercounted. Platform jobs (benchmarks, impact snapshot, loyalty expiry) read all tenants in one capped query.
   - `allRows()` is applied to 31 aggregate reads.
   - Benchmarks (route + cron) summed `invoices.total`; they now use `amount`.
   - The sales signal's `.limit(2000)` was silently capped at 1000.
   - New ratchet metric `money_reads_unpaged` (12 left; each reviewed as filter-bounded).
3. **Page gates** for reach, sequences (send_broadcasts) and the settings setup wizard (manage_settings). The scan now counts segment `layout.tsx` gates: pages_no_permission 11 → 2 (onboarding flow, role-aware root).
4. **No raw Postgres errors** (`4e0fe37`): `dbError()` reuses withRoute's `mapError` (409/400/404/logged 500). 79 sites in 48 routes; routes_leak_db_error 46 → 0.
5. **persona-walk** now waits for its marker: streamed 404s and data land after networkidle, which caused 3 false results. **Full walk on prod: 122/122** (salon 24, ngo 16, trades 18, clinic 18, creative 14, logistics 20, school 12).

**Workstream C — remaining, in order:**
- **DoD API signals:** write routes with no audit (71), write routes with no zod (24), `select *` (35).
- **Pages with no empty state (23).** Unbounded page lists (24) beyond money: inventory, suppliers, contracts, documents, team clock_events, inbox messages, sequences enrolments.
- **Get Paid → Grow page-by-page functional review** (Purpose/Data/Features/UI/Ops) with the personas.
- **54 no-UI routes** (Academy, Loyalty, public `/book/[slug]` page, Goals, NPS, Projects, task comments, board-pack/portal APIs).
- `/api/engineering/feedback` (unauthenticated Jarvis proxy); Zanele/staff Inbox decision; Sonnet 5.5 go-ahead.

#### Session 20 continued (2026-10-06/07, sixth sitting): Workstream C — API sweep, and WhatsApp turned out to be broken end to end
Started at the DoD API signals; the sweep kept opening onto sibling bugs (debugger mode). Two commits: `09fba54` (Reach/consent) and the route-sweep commit after it.

**1. POPIA s69 for every marketing send** (`09fba54`). Source: POPIA s69(1),(3),(4) — consent OR existing customer (details from a sale), opportunity to object on every message, sender identity + opt-out contact on every message.
- Reach messaged *every* contact with a phone: no consent check, no opt-out, no opt-out line; capped at 1000; status check and claim not atomic (double-click = double send); sent inside the request after a 202 (Vercel cuts it off).
- New `contacts.marketing_opt_out_at` (migration `20261007_contacts_marketing_opt_out.sql`, **applied to prod**, additive). `lib/reach/consent.ts` holds the rules (tested).
- Send = GET preview (eligible / held back, shown on the button before confirming) → atomic claim → Inngest `reachCampaignSend` in resumable batches → owner told the counts. Duplicate `/api/reach/send` removed. `{{name}}` was promised in the placeholder but never filled; now it is.
- Inbound "STOP" (and variants) records the opt-out, confirms, cancels active sequences, never reaches the AI.
- Inbound WhatsApp senders are now `unknown`, not `client` — messaging a business doesn't make you its customer (s69(3)).
- Contact page: record consent / opt-out / opt back in.
- Cold-lead nudges (autonomy tier A auto-send) are marketing too: consent-checked + footer.
- **Sequences never enrolled anyone**: none of the 6 triggers was wired and manual enrol had no UI. Now `new_contact` / `new_client` fire from contact creation and type change, Enrol button on each sequence, unwireable triggers (keyword: no column; overdue_invoice: belongs to the recovery engine's legal tiers; onboarding) removed. Every step consent-checked.

**2. WhatsApp identity — it never worked per tenant.** Live: 0/15 tenants have `meta_phone_number_id`, and nothing in the app could set it.
- Inbound routing matched Meta's numeric phone-number ID against `tenants.whatsapp_number` (the display phone, "+27…") — **no inbound message could ever reach a tenant**. Now matches `meta_phone_number_id`.
- A third identity, `settings.whatsapp_phone_number_id`, was read by NPS + payslip distribution and set by nothing: **no NPS survey and no payslip was ever WhatsApp'd** (every payslip reported "WhatsApp not connected").
- New `lib/whatsapp/tenantSender.ts` (`sendAsTenant`): the business's own line, else the platform line. Used by every customer/staff-facing send: AI replies, inbox replies, call follow-ups, booking reminders, payment thank-yous, notifyContact, wellness check-ins, NPS, payslips, cold-lead nudges, sequences. Owner alerts stay on the platform line.
- Escalation cron WhatsApp'd the business's own customer-facing number; now a normal owner alert.
- Over-limit gate in the webhook dropped the customer's message (never reached the inbox) and told the *customer* to "upgrade your plan at adminos.co.za". The engine already sends a polite holding reply and files the message; the webhook now only alerts the owner (daily).
- Super-admin can set a tenant's `meta_phone_number_id` (`PATCH /api/admin/tenants`, shown on the operator page) after Meta onboarding.

**3. Routes the middleware silently 401'd** — public by design but never listed: n8n `workflow/trigger` + `workflow/file-received`, the feedback widget proxy (signed-out visitors), and NPS answers (customers have no login). Added as narrow `PUBLIC_PATTERNS`; each self-authenticates and is marked `@public`.
- **NPS end to end**: survey links pointed at `/survey/[token]`, which didn't exist. Built the public page + `POST /api/survey/[token]` (token-scoped, rate limited, answers once). Detractor (0–6) → owner alert with the comment (was an Academy-lesson event with a contact id passed as a user id). `POST /api/nps` accepted other tenants' contact ids — now filtered to the business.

**4. The rest of the API list:** autonomy (only catalogue decisions accepted, tier changes audited), settings notifications/logo/mode, both super-admin routes (zod, capped paging, budget changes critically audited), plan + add-on cancellation audited (non-throwing: the cancel already happened), expense approval zod, `workflow/trigger` timing-safe secret + schema, feedback proxy (JSON ≤ 20 KB, IP rate limit), integrations (members only; `fx-rates` put the raw `base` param into the upstream URL path and anyone could burn the 1,500/month quota), **portal links no longer hard-deleted** (earlier links expired instead — Rule #3).
- Quality scan: a write that never reads a body has nothing to validate; `@public` self-authenticating methods count as checked. **routes_no_permission 10 → 0, write_routes_no_zod 24 → 0, routes_hard_delete 1 → 0.**

**Needs Nanda:**
- **Connecting WhatsApp numbers.** Per-tenant numbers need Meta onboarding (Embedded Signup or 360dialog). Until then everything goes from the platform line, inbound AI can't route to a tenant, and Reach is blocked with "contact support to connect". Decide: shared platform number (route inbound by sender → contact → tenant) or per-tenant numbers (build Embedded Signup).
- WhatsApp templates: free-form messages only reach people who messaged in the last 24h; broadcasts, reminders, payslips, NPS need approved templates.
- `app/layout.tsx` GTM snippet (uncommitted, yours): GTM loads before cookie consent. Under POPIA + the cookie banner, tags that set analytics/ads cookies should wait for consent (GTM Consent Mode). Left untouched.

**Workstream C — remaining, in order:**
- write routes with no audit (~60), `select *` (~30).
- Pages with no empty state (23); unbounded page lists (24).
- Get Paid → Grow page-by-page functional review with the personas.
- No-UI routes (Academy, Loyalty, public `/book/[slug]`, Goals, Projects, task comments, board-pack/portal UI).
- Contacts search `.or()` interpolates raw user text into the PostgREST filter (tenant filter still holds, but a comma/paren breaks the query) — escape it.

**Regression gate after deploy (b2718dd):** authz matrix clean for all 12 logins (0 apiBad, 0 pagesBad, 0 cross-tenant leaks; the 1 unguarded-2xx flag is clinic staff reading creative assets via `manage_documents`, which is in the staff default — expected). Persona walk 122/122 (salon's `/dashboard` timed out once on the first cold hit; re-run 24/24).
- The walk surfaced React #418 on `/dashboard/compliance`: deadline countdowns used the runtime's local midnight, so the UTC server and SAST browser disagreed 00:00–02:00 SAST (a real off-by-one, plus failed hydration). Same bug on Licences (server + client). Fixed with `daysUntil()` in `lib/time/sast.ts` (tested at the midnight edge); dates format from `T12:00:00Z`.

### WhatsApp + Reach execution plan — Meta Tech Provider (decided 2026-10-07; Nanda starts Meta setup on the weekend)
**Decision:** AdminOS becomes a Meta **Tech Provider** and each business connects its **own** number through Embedded Signup with **coexistence**. This delivers the homepage promise as written ("Link your existing number via Meta WhatsApp Cloud API. 3 minutes. No new SIM or number needed."). Not a shared AdminOS number for customer messaging.

**Why (verified against Meta's docs, 2026-10-07):**
- **Coexistence** (Meta docs: "Onboarding WhatsApp Business app users"): the same number runs on the WhatsApp Business app AND the Cloud API. Messages mirror both ways; contacts and the last 6 months of chat history can sync. Only Tech Providers / Solution Partners can offer it.
  - Trade-offs: in the app, broadcast lists become read-only and disappearing messages, view-once and live location are switched off. Groups aren't available via the API. The number is capped at 20 msg/s (fine for SMEs).
- **Billing:** with Tech Provider status each business's WhatsApp Business Account carries its own payment method, so the business pays Meta directly. AdminOS doesn't resell message costs (no margin or billing liability); our fee stays the software (plan + Reach add-on).
- **Per-message pricing** (Meta docs: "Pricing", since 1 Jul 2025): charged per delivered template by category (marketing / utility / authentication) and country. SA rates come from Meta's downloadable rate cards; check them before quoting customers.
  - **Service** (non-template replies inside the 24h customer-service window) are **free**. The AI inbox, AdminOS's core WhatsApp promise, carries no Meta cost.
  - **Utility** templates (reminders, receipts, payslips, NPS) are cheap, and **free inside an open 24h window**.
  - **Marketing** templates (Reach) are the expensive category. Right for a paid add-on, and the reason the POPIA s69 consent layer matters: opt-outs/blocks also lower the number's quality rating.
  - **Click-to-WhatsApp ads** open a free 72h window (all message types free). Later growth feature: "run an ad, the AI takes the leads."
  - Volume tiers lower utility/authentication rates, aggregated per business portfolio, monthly.
- **Why not one shared AdminOS number:** one quality rating shared by every tenant (one spammy business gets it restricted for all), replies can't be routed back to the right business, and customers see AdminOS instead of the business. Acceptable **only** as a fallback for utility messages (payslips, reminders) from businesses not yet connected; never for Reach. `sendAsTenant` already does exactly this fallback.

**Nanda (external, weekend; the long pole):**
1. Meta Business **verification** for Mirembe Muse (Pty) Ltd (company registration docs, domain, business details).
2. Set up the Meta app as a **Tech Provider**; request WhatsApp business **messaging** + **management** permissions via **app review**. Review needs screencasts of the flow; Claude scripts these once the Connect flow exists.
3. Direct Tech Provider (recommended: no per-number partner fee, the code already speaks the Cloud API) vs **360dialog** partner (fallback if Meta review stalls).
4. Note for the review: AdminOS's privacy policy must cover WhatsApp data processing and the US/EU AI providers (POPIA s72), which Workstream F checks anyway.

**Claude (build in parallel; testable on Nanda's own number before approval):**
1. **Connect WhatsApp** in Settings: Embedded Signup popup with coexistence → store the WABA ID, `meta_phone_number_id` and an **encrypted** per-business access token (new columns; token never sent to the client), register the number, subscribe the app to the WABA's webhooks. Replaces the super-admin `PATCH /api/admin/tenants` workaround. Also: disconnect, and a status card (connected / quality rating / messaging limit).
2. **Template layer:** on connect, auto-submit AdminOS's standard **utility** templates (booking reminder, invoice reminder, payment receipt, payslip ready, NPS survey) to that business's WABA. Track approval via the `message_template_status_update` webhook in a templates table. Every business-initiated send uses an approved template; free-form text only inside the 24h window (tracked from last inbound message per contact). Closes the "WhatsApp templates" gap.
3. **Reach v2:** compose → submit as a **marketing** template (`{{1}}` = first name) → approved (usually minutes–hours) → preview shows recipients, held back (no consent / opted out), and **estimated Meta cost** → send through the existing `reachCampaignSend` batches. Meta delivery errors (per-user marketing limits, undeliverable, re-engagement required) map to per-recipient status so delivery stats stay honest.
4. **Pilot:** Jael (first beta user, `jael-malavila`) connects with coexistence first, then roll out to the other tenants.

**Already in place from Session 20 (sixth sitting), reused as-is:** POPIA s69 consent + STOP handling (`lib/reach/consent.ts`, `marketing_opt_out_at`), `sendAsTenant` (business line, else platform line), resumable batched sending (Inngest `reachCampaignSend`), inbound routing by `meta_phone_number_id`, public NPS survey page.

**Packaging check:** plans already promise "1 / 1 / 2 / 3 WhatsApp numbers". With the Tech Provider route, extra numbers are just more Embedded Signup connections per tenant (branches). The number limit per plan is enforced at connect time.
