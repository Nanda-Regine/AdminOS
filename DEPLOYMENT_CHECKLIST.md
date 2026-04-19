# AdminOS — Deployment Checklist

Pre-production checklist for deploying AdminOS to Vercel + Supabase.

---

## 1. Supabase Setup

### Database
- [ ] Run all migrations: `npx supabase db push`
- [ ] Confirm these tables exist: `tenants`, `users`, `conversations`, `messages`, `contacts`, `invoices`, `debtors`, `documents`, `staff`, `wellness_records`, `workflow_queue`, `audit_logs`, `subscriptions`, `business_insights`, `goals`, `referrals`
- [ ] Enable Row-Level Security on every table
- [ ] Verify RLS policies enforce `tenant_id` isolation (test with two tenant JWTs)
- [ ] Run `supabase/seed-beta-tenant.sql` to create demo tenant

### Auth
- [ ] Enable Email + Password provider
- [ ] Enable Google OAuth provider
- [ ] Add production Redirect URL: `https://adminos.co.za/auth/callback`
- [ ] Set Site URL: `https://adminos.co.za`
- [ ] Disable email confirmation (or configure SMTP via Resend)

### Realtime
- [ ] Enable Realtime on: `conversations`, `documents`, `invoices`, `audit_logs`

---

## 2. Vercel Environment Variables

Set all variables from `.env.local.example` in Vercel → Settings → Environment Variables.

Critical (app won't start without these):
- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `ANTHROPIC_API_KEY`
- [ ] `UPSTASH_REDIS_REST_URL`
- [ ] `UPSTASH_REDIS_REST_TOKEN`
- [ ] `CRON_SECRET`

Required for features:
- [ ] `DIALOG360_API_KEY` + `DIALOG360_WEBHOOK_SECRET` (WhatsApp)
- [ ] `RESEND_API_KEY` + `RESEND_FROM_EMAIL` (Email)
- [ ] `PAYFAST_MERCHANT_ID` + `PAYFAST_MERCHANT_KEY` + `PAYFAST_PASSPHRASE` (Billing)
- [ ] `INNGEST_EVENT_KEY` + `INNGEST_SIGNING_KEY` (Workflows)

---

## 3. Vercel Project Config

- [ ] Framework: Next.js (auto-detected)
- [ ] Root directory: `adminos/`
- [ ] Node version: 20.x
- [ ] Set `VERCEL_URL` is automatically set — no manual action needed
- [ ] Enable Vercel Analytics (free tier)
- [ ] Enable Speed Insights

### Cron Jobs (Vercel Cron)
Defined in `vercel.json` — verify these are registered:
- [ ] `0 5 * * 1-5` → `/api/cron/daily-brief`
- [ ] `0 */6 * * *` → `/api/cron/debt-recovery`
- [ ] `*/15 * * * *` → `/api/cron/escalate-conversations`
- [ ] `0 9 * * 1,3` → `/api/cron/wellness`

---

## 4. External Services

### 360dialog (WhatsApp)
- [ ] Webhook URL registered: `https://adminos.co.za/api/webhook/whatsapp`
- [ ] HMAC webhook secret set on 360dialog dashboard
- [ ] `DIALOG360_WEBHOOK_SECRET` matches
- [ ] Test: send a WhatsApp message and confirm it appears in DB

### Inngest
- [ ] Production app created at app.inngest.com
- [ ] Serve URL registered: `https://adminos.co.za/api/inngest`
- [ ] Event key and signing key copied to Vercel env vars
- [ ] Sync functions after first deploy: Inngest dashboard → Sync

### PayFast
- [ ] Live merchant account active
- [ ] ITN (webhook) URL: `https://adminos.co.za/api/billing/webhook`
- [ ] Return URL: `https://adminos.co.za/dashboard/settings/billing?success=1`
- [ ] Cancel URL: `https://adminos.co.za/dashboard/settings/billing?cancelled=1`
- [ ] Test full payment flow in sandbox before switching to live

### Resend
- [ ] Domain `adminos.co.za` verified (DNS records added)
- [ ] From email `noreply@adminos.co.za` approved

### Google OAuth (Supabase)
- [ ] Google Cloud project created
- [ ] OAuth 2.0 credentials created (Web application type)
- [ ] Authorized redirect URI: `https://<supabase-project>.supabase.co/auth/v1/callback`
- [ ] Client ID + Secret added to Supabase → Auth → Providers → Google

---

## 5. DNS & Domain

- [ ] `adminos.co.za` A record or CNAME points to Vercel
- [ ] HTTPS certificate auto-provisioned by Vercel
- [ ] `www.adminos.co.za` → redirect to `adminos.co.za`
- [ ] SPF, DKIM, DMARC DNS records added for email (Resend provides these)

---

## 6. Security

- [ ] Security headers active (verify via securityheaders.com):
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Content-Security-Policy` set in `next.config.ts`
  - `Strict-Transport-Security` set
- [ ] All `/api/cron/*` routes require `Authorization: Bearer $CRON_SECRET`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is NOT in any `NEXT_PUBLIC_*` variable
- [ ] `.env.local` is in `.gitignore` (never committed)
- [ ] Run: `npm audit` — resolve any high/critical vulnerabilities

---

## 7. Post-Deploy Smoke Tests

- [ ] Landing page loads: `https://adminos.co.za`
- [ ] Sign up flow: create account → onboarding → dashboard
- [ ] Google OAuth: sign in with Google → redirected to dashboard
- [ ] WhatsApp webhook: send test message → appears in inbox
- [ ] Document upload: upload PDF → AI summary appears
- [ ] Billing page loads, pricing correct (R2,500 / R4,500 / R8,500 / R14,999)
- [ ] Daily brief cron: trigger manually via `POST /api/cron/daily-brief` with CRON_SECRET
- [ ] Offline mode: disable network → `/dashboard` still loads from service worker cache
- [ ] PWA install prompt appears on mobile Chrome

---

## 8. Monitoring

- [ ] Vercel Analytics shows traffic
- [ ] Error budget: configure Sentry alerts for error rate >1%
- [ ] Set up uptime monitoring (Better Uptime / UptimeRobot) on `https://adminos.co.za`
- [ ] Confirm Supabase connection pooling is enabled (for serverless)

---

*Last updated: April 2026 — AdminOS v1.0 production release*
