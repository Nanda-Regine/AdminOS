# 🏢 AdminOS

**AI-powered business operating system for South African SMEs, NGOs, schools, and clinics.**

[![Next.js](https://img.shields.io/badge/Next.js_16-black?style=for-the-badge&logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS_4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Anthropic Claude](https://img.shields.io/badge/Claude_claude--sonnet--4--6-D97706?style=for-the-badge)](https://anthropic.com)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com)
[![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel)](https://vercel.com)
[![POPIA](https://img.shields.io/badge/POPIA_Compliant-🇿🇦-059669?style=for-the-badge)](#popia-compliance)

> *"One AI system that runs your business. WhatsApp. Invoicing. Staff. Clients."*

---

## The Problem

South African SMEs pay for 6–8 separate tools and still rely on WhatsApp groups, spreadsheets, and late-night phone calls to run their businesses. They're underserved by international SaaS tools designed for US markets — tools that don't understand load shedding, 11 official languages, POPIA compliance, or the reality of chasing invoices in an economy where cash flow is survival.

## The Solution

AdminOS replaces your entire toolstack with one AI-native platform. Five specialised agents handle your WhatsApp inbox, debt recovery, staff wellness, document intelligence, and daily business analytics — automatically, 24/7, in your customers' language.

**Average client saves R8,400/month** in replaced software and admin time.

---

## The 5 AI Agents

| Agent | Role | Model | What it does |
|-------|------|-------|-------------|
| 📥 **Alex** | Inbox Agent | Sonnet | Handles WhatsApp client conversations, FAQs, bookings, escalations |
| 💰 **Chase** | Debt Recovery Agent | Haiku | Automated invoice follow-up with escalating professional messaging |
| 🌿 **Care** | Wellness Agent | Sonnet | Daily staff check-ins via WhatsApp, burnout signal detection |
| 📄 **Doc** | Document Intelligence | Haiku | Classifies, summarises, and extracts data from PDF/Word/Excel uploads |
| 📊 **Insight** | Analytics Agent | Haiku | Daily 05:00 AI business brief with revenue trends, cash flow, debt aging |
| ✉️ **Pen** | Email Composer | Sonnet | Drafts professional outbound emails in the tenant's brand voice |

---

## Features

### Core Platform
- **Multi-tenant SaaS** — strict per-tenant data isolation with Supabase RLS
- **WhatsApp-native** — real business tool, not an SMS workaround
- **PWA** — offline-capable for load-shedding resilience, installable on Android/iOS
- **14-day free trial** — no credit card required

### AI Capabilities
- **Prompt caching** — 80% reduction in Claude API costs via `cache_control: ephemeral`
- **Multi-model routing** — Sonnet for nuanced agents (inbox, wellness), Haiku for structured tasks (debt templates, extraction)
- **Multilingual** — detects and responds in the customer's language automatically
- **Prompt injection protection** — sanitizeForAI() strips 17 injection patterns on all inbound WhatsApp messages

### Business Intelligence
- **Real-time analytics** — 14-day revenue chart, intent classification, debt aging
- **Wellness heatmap** — team sentiment over time with burnout signal alerts
- **Debt recovery workflow** — automatic escalation from reminder → demand letter
- **Contract intelligence** — extracts key dates, parties, and obligations from uploaded documents

### Compliance & Security
- **POPIA compliant** — right-to-erasure API, immutable audit log, data residency
- **Row-Level Security** — every table partitioned by `tenant_id`, enforced at DB level
- **Security headers** — HSTS, CSP, X-Frame-Options, Referrer-Policy on all responses
- **Rate limiting** — per-tenant sliding windows via Upstash Redis (5 limiter types)
- **Webhook verification** — HMAC-SHA256 x-hub-signature-256 validation on Meta WhatsApp and PayFast webhooks
- **2FA enforcement** — Enterprise tier admin dashboard

### Integrations
- 📱 **WhatsApp** via Meta Business API v19.0
- 💳 **Payments** via PayFast (ZAR billing, monthly subscription)
- 📧 **Email** via Resend
- 📊 **Accounting** via Xero API
- 🔋 **Load-shedding widget** via EskomSePush API

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 |
| **AI** | Anthropic Claude claude-sonnet-4-6 (Sonnet + Haiku), prompt caching, streaming |
| **Database** | Supabase PostgreSQL, Supabase Auth, Row-Level Security |
| **Caching / Rate Limiting** | Upstash Redis (sliding window, analytics) |
| **WhatsApp** | Meta Business API v19.0, inbound webhook, HMAC-SHA256 verification |
| **Email** | Resend API |
| **Accounting** | Xero OAuth 2.0 API |
| **Payments** | PayFast subscription + ITN webhook |
| **File Processing** | pdf-parse, mammoth (Word), xlsx (spreadsheets) |
| **Automation** | Inngest (event-driven workflows), Vercel Cron |
| **Hosting** | Vercel Edge + Serverless Functions |
| **Analytics** | Vercel Analytics + Speed Insights |
| **PWA** | next-pwa, service worker, offline caching |
| **Validation** | Zod schemas on all form inputs |

---

## AI Architecture

```
Inbound WhatsApp message
        ↓
[Meta Webhook] → [HMAC-SHA256 x-hub-signature-256 verification]
        ↓
[sanitizeForAI()] ← strips 17 injection patterns, 2000-char limit
        ↓
[Supabase: load conversation history + tenant config]
        ↓
[buildSystemPrompt()] ← tenant context, agent personality, KB
        ↓
[Claude API]
  └─ system: [TENANT_PROMPT (cached)] + [AGENT_INSTRUCTIONS (cached)]
  └─ messages: conversation history
  └─ model: claude-sonnet-4-6 (inbox/wellness) | claude-haiku-4-5-20251001 (debt/docs/analytics)
        ↓
[Response saved to DB] → [Meta API v19.0: send reply]
        ↓
[Audit log entry] → [Rate limit check update]
```

**Prompt caching strategy:** System prompts (2,000–5,000 tokens) are cached with `cache_control: ephemeral`, reducing input token costs by ~80% for conversations with tenant context.

**Model routing:**
```typescript
const MODEL = {
  inbox_agent:      'claude-sonnet-4-6',  // Customer-facing, needs quality
  wellness_agent:   'claude-sonnet-4-6',  // Emotional nuance required
  debt_recovery:    'claude-haiku-4-5-20251001',   // Template-based
  document_extract: 'claude-haiku-4-5-20251001',   // Structured extraction
  daily_brief:      'claude-haiku-4-5-20251001',   // Summarisation
  analytics:        'claude-haiku-4-5-20251001',   // Data analysis
}
```

---

## Real-Time Features

AdminOS uses **Supabase Realtime** for live dashboard updates without polling:

| Component | Table subscription | What updates |
|-----------|-------------------|--------------|
| `LiveActivityFeed` | `messages` INSERT | New WhatsApp messages appear instantly |
| `RealtimeNotificationBar` | `conversations` UPDATE | Escalation alerts, status changes |
| `AgentStatusBar` | `workflow_runs` INSERT/UPDATE | Agent active/idle state per tenant |
| Inbox unread count | `conversations` UPDATE | Badge count on sidebar nav item |

**How it works:**

```typescript
// Supabase Realtime subscription (tenant-scoped)
supabase
  .channel(`tenant:${tenantId}`)
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages',
      filter: `tenant_id=eq.${tenantId}` }, handleNewMessage)
  .subscribe()
```

RLS policies are enforced on the Realtime channel — a tenant can only subscribe to their own rows.

---

## Offline & PWA

AdminOS is a **Progressive Web App** — installable on Android and iOS home screens, with offline resilience for South Africa's load-shedding reality.

**Service worker cache strategy (next-pwa):**

| Route type | Strategy | Behaviour during outage |
|------------|----------|------------------------|
| Dashboard pages | NetworkFirst (5s timeout) | Shows last-cached version |
| Static assets (`/_next/static`) | CacheFirst | Served from cache instantly |
| API routes (`/api/*`) | NetworkOnly | Fails gracefully with offline toast |
| Fonts & icons | StaleWhileRevalidate | Instant load, background refresh |

**Manifest (`/public/manifest.json`):**
- Theme colour: `#0A0F2C` (AdminOS navy)
- 3 quick-launch shortcuts: Inbox, Contacts, Analytics
- Installable on Android Chrome, iOS Safari, and desktop

**Load-shedding widget:** EskomSePush API integration at `/dashboard` shows next scheduled outage time, so business owners can plan AI-dependent tasks around power availability.

---

## Cron Jobs

| Schedule (UTC) | SAST | Route | Purpose |
|----------------|------|-------|---------|
| `0 3 * * 1-5` | 05:00 | `/api/cron/daily-brief` | Generate AI business brief per tenant |
| `0 */6 * * *` | every 6h | `/api/cron/debt-recovery` | Debt recovery on overdue invoices |
| `0 7 * * 1,3` | 09:00 Mon/Wed | `/api/cron/wellness` | Staff wellness check-in messages |
| `0 5 * * 1-5` | 07:00 | `/api/cron/fan-out-brief` | Fan-out brief generation across Inngest workers |
| `0 6 * * 1-5` | 08:00 | `/api/cron/fan-out-wellness` | Fan-out wellness check-ins across workers |
| `* * * * *` | every min | `/api/cron/process-queue` | Drain workflow_queue table → Inngest events |
| `*/15 * * * *` | every 15 min | `/api/cron/escalate-conversations` | Escalate unresolved WhatsApp conversations |

---

## Pricing

| Tier | Price | Best for |
|------|-------|----------|
| **Starter** | R2,500/month | 1–10 staff |
| **Growth** ⭐ | R4,500/month | 11–50 staff |
| **Enterprise** | R8,500/month | 50+ staff |
| **White Label** | R14,999/month | Accountants & resellers |

Annual billing: 15% discount. Optional onboarding: R5,000–R15,000.

---

## POPIA Compliance

AdminOS is built to comply with South Africa's Protection of Personal Information Act (POPIA, No. 4 of 2013):

- **Lawful processing basis** — documented in Privacy Policy
- **Data minimisation** — only business-necessary data collected
- **Right-to-erasure API** — `DELETE /api/compliance/delete-contact`
- **Immutable audit trail** — every data access/modification logged with timestamp + user ID
- **Multi-tenant RLS** — physical data separation enforced at database level
- **Retention schedules** — configurable per tenant, enforced by cron cleanup
- **Information Officer** — designated contact: privacy@mirembemuse.co.za

---

## Local Development

```bash
# Clone
git clone https://github.com/Nanda-Regine/AdminOS
cd AdminOS/adminos

# Install
npm install

# Environment variables
cp .env.local.example .env.local
# Fill in all required keys — see .env.local.example for full list
# Required: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
#           SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY,
#           UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN,
#           META_WHATSAPP_ACCESS_TOKEN, META_PHONE_NUMBER_ID, META_WEBHOOK_SECRET,
#           RESEND_API_KEY, INNGEST_EVENT_KEY, INNGEST_SIGNING_KEY

# Apply database migrations
npx supabase db push

# Seed required tables (run once in Supabase SQL editor)
# See supabase/seed.sql — creates business_insights, subscriptions tables
# and inserts default plan limits for starter/growth/enterprise/white_label

# Start Next.js dev server
npm run dev

# In a separate terminal: start Inngest dev server (required for background jobs)
npx inngest-cli@latest dev
# Open http://localhost:8288 to inspect Inngest events and function runs
```

---

## Deployment

AdminOS is deployed to Vercel with zero-config from `main` branch:

```bash
# Production deploy
vercel --prod

# Environment variables (set in Vercel dashboard or CLI)
vercel env add ANTHROPIC_API_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
# ... etc
```

**Required Supabase tables** (run migrations before first deploy):
- `tenants`, `users`, `conversations`, `messages`, `contacts`
- `invoices`, `debtors`, `documents`, `staff`, `wellness_records`
- `workflow_runs`, `audit_logs`, `subscriptions`, `business_insights`

---

## Project Structure

```
adminos/
├── app/
│   ├── page.tsx                    # Landing page
│   ├── layout.tsx                  # Root layout (metadata, analytics)
│   ├── (auth)/login|signup         # Auth pages
│   ├── dashboard/                  # Protected dashboard routes
│   │   ├── inbox/                  # WhatsApp conversation inbox
│   │   ├── analytics/              # Business intelligence
│   │   ├── contacts/               # CRM
│   │   ├── documents/              # Document management
│   │   ├── invoices/               # Invoice tracking
│   │   └── settings/billing|compliance|referrals
│   ├── api/
│   │   ├── agents/[agentType]/     # Claude API proxy per agent
│   │   ├── billing/checkout|webhook
│   │   ├── cron/                   # Scheduled automation
│   │   ├── documents/upload        # File processing
│   │   └── webhook/whatsapp|email  # Inbound webhooks
│   ├── privacy/                    # Privacy Policy (POPIA)
│   ├── terms/                      # Terms of Service
│   └── contact/                    # Contact page
├── lib/
│   ├── ai/agents.ts                # Server-side Claude agents
│   ├── ai/agents.config.ts         # Client-safe agent config
│   ├── ai/buildSystemPrompt.ts     # Prompt construction with caching
│   ├── security/sanitize.ts        # Prompt injection protection
│   ├── security/rateLimit.ts       # Upstash rate limiting
│   ├── security/audit.ts           # Immutable audit logging
│   ├── workflows/debtRecovery.ts   # Debt recovery workflow
│   ├── workflows/wellness.ts       # Wellness check-in workflow
│   └── whatsapp/send.ts            # Meta Business API v19.0 send utility
├── components/
│   ├── CookieConsent.tsx           # POPIA-aware cookie banner
│   └── dashboard/Sidebar|TopBar
├── middleware.ts                   # Auth, trial enforcement, security headers
└── next.config.ts                  # PWA, CSP, HSTS, image optimisation
```

---

## Roadmap

- [ ] **Sage / QuickBooks integration** — many SA SMEs are on Sage
- [ ] **Voice note processing** — Whisper API for WhatsApp voice messages (very SA)
- [ ] **Automated payroll reminders** — cron on 25th, auto-draft payslip notices
- [ ] **Insurance document processor** — CIPC, compliance certificate handling
- [ ] **Calendar integration** — Google Calendar sync for scheduling
- [ ] **Multi-location Enterprise** — franchise and multi-branch support
- [ ] **Mobile app** — React Native (PWA covers most use cases already)

---

## About

Built by **[Nandawula Regine Kabali-Kagwa](https://creativelynanda.co.za)** | **[Mirembe Muse (Pty) Ltd](https://mirembemuse.co.za)**

African-built, African-first. AdminOS is what happens when you stop trying to adapt international SaaS tools to African business realities and build from scratch for how SA businesses actually work: WhatsApp-first, multilingual, load-shedding-aware, POPIA-compliant, and priced for SME budgets.

**Contact:** hello@mirembemuse.co.za
**Demo:** [cal.com/nanda/adminos-demo](https://cal.com/nanda/adminos-demo)
**Live:** [adminos.co.za](https://adminos.co.za)

---

*AdminOS · March 2026 · Mirembe Muse (Pty) Ltd · South Africa*
