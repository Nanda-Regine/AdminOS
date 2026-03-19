# AdminOS

> The OS that runs your business while you focus on what matters.

AI-powered hybrid business operating system for South African SMEs, NGOs, schools, clinics, and government departments.

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind CSS |
| Database | Supabase (Postgres + RLS + Realtime + Storage) |
| Auth | Supabase Auth (JWT, multi-tenant, RLS) |
| AI | Claude API (claude-sonnet-4-6) with prompt caching |
| Cache | Upstash Redis (sessions, FAQ cache, deduplication) |
| WhatsApp | 360dialog |
| Email | Resend |
| Payments | PayFast (SA) |
| Invoicing | Xero API |
| Hosting | Vercel (edge functions, cron, CDN) |

---

## Getting Started

### 1. Install dependencies

```bash
cd adminos
npm install
```

### 2. Configure environment

Fill in `.env.local` with your credentials:

- `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` + `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`
- `UPSTASH_REDIS_URL` + `UPSTASH_REDIS_TOKEN`
- `DIALOG360_API_KEY` + `DIALOG360_WEBHOOK_SECRET`
- `RESEND_API_KEY`
- `CRON_SECRET` — random string to secure cron endpoints
- All others in `.env.local`

### 3. Set up database

Run `supabase/schema.sql` in your Supabase SQL editor.

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Project Structure

```
app/
  page.tsx                      Landing page
  (auth)/login + signup/        Auth pages
  dashboard/                    Protected dashboard
    page.tsx                    Overview + stats
    inbox/                      Live conversation inbox + AI agents
    staff/                      Staff directory, leave, wellness
    invoices/                   Debt register + recovery
    documents/                  File intelligence + goal tracker
    calendar/                   Leave calendar
    analytics/                  Business intelligence
    settings/                   Bot training, integrations
      onboarding/               15-minute setup wizard
  api/
    webhook/whatsapp/           360dialog inbound webhook
    webhook/email/              Email inbound
    workflow/trigger/           n8n callback endpoint
    workflow/file-received/     File intelligence pipeline
    agents/[agentType]/         Dashboard AI agents (5 types)
    cron/                       Vercel scheduled jobs
    admin/tenants/              Super admin panel

lib/
  ai/callClaude.ts              Claude API with prompt caching
  ai/agents.ts                  5 specialist AI agents
  workflow/engine.ts            Core WorkflowEngine
  workflows/debtRecovery.ts     Escalating invoice recovery
  workflows/wellness.ts         Staff wellness check-ins
  cache/faqCache.ts             Redis FAQ cache
  security/rateLimit.ts         Per-tenant rate limiting
  security/audit.ts             Immutable audit logging

supabase/schema.sql             Full database schema + RLS policies
```

---

## Cron Jobs

| Endpoint | Schedule (UTC) | Purpose |
|---|---|---|
| `/api/cron/debt-recovery` | 07:00 daily | Chase overdue invoices |
| `/api/cron/wellness` | 06:00 Mon-Fri | Staff wellness check-ins |
| `/api/cron/daily-brief` | 05:00 Mon-Fri | Manager AI brief |

---

## Creator

**Nandawula Regine** · CreativelyNanda.co.za · Mirembe Muse (Pty) Ltd

*Built for Africa.*

---

## Original Next.js docs

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
