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

- 360dialog Business API integration: inbound webhook + HMAC verification
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

## Stats

- **Phases completed:** 12/12
- **Sessions:** 3
- **API routes:** 30+
- **Dashboard pages:** 12+
- **AI agents:** 5 named agents + orchestrator
- **Cron jobs:** 4 automated workflows
- **Lines of code:** ~8,000+

---

## What's Next

AdminOS v1.0 is production-ready. The roadmap beyond launch:

1. **Sage / QuickBooks integration** — the majority of SA SME accountants use Sage
2. **Voice note processing** — WhatsApp voice notes are extremely popular in SA, Whisper API transcription
3. **Calendar integration** — Google Calendar sync for appointment booking via Alex
4. **Mobile app** — React Native wrapper (PWA covers ~90% of use cases already)
5. **Multi-location Enterprise** — franchise and multi-branch support
6. **Insurance document processor** — CIPC compliance certificate automation

---

*Built by Nandawula Regine Kabali-Kagwa · Mirembe Muse (Pty) Ltd · South Africa*  
*"African-built, African-first."*
