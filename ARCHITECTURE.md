# AdminOS — Architecture Reference

> Developer-facing reference. Last updated: April 2026.

---

## a) Project Structure

```
adminos/
│
├── app/                                     # Next.js App Router
│   ├── layout.tsx                           # Root layout — Vercel Analytics, SpeedInsights, CookieConsent
│   ├── page.tsx                             # Public landing page (pricing, agents, ROI table)
│   ├── error.tsx                            # Global error boundary
│   ├── opengraph-image.tsx                  # OG image generation
│   ├── twitter-image.tsx                    # Twitter card image
│   ├── sitemap.ts                           # Dynamic sitemap (includes legal pages)
│   │
│   ├── (auth)/                              # Auth route group — no dashboard layout
│   │   ├── layout.tsx                       # Minimal auth shell
│   │   ├── login/page.tsx                   # Supabase email+password login
│   │   └── signup/page.tsx                  # Tenant creation + user registration
│   │
│   ├── auth/callback/route.ts               # Supabase OAuth callback handler
│   │
│   ├── privacy/page.tsx                     # Privacy Policy — POPIA compliant
│   ├── terms/page.tsx                       # Terms of Service
│   ├── contact/page.tsx                     # Contact page
│   │
│   ├── dashboard/                           # Protected routes — requires auth
│   │   ├── layout.tsx                       # Dashboard shell (Sidebar + TopBar)
│   │   ├── page.tsx                         # Main dashboard — stats, activity feed, agent status
│   │   ├── error.tsx                        # Dashboard-scoped error boundary
│   │   │
│   │   ├── inbox/page.tsx                   # WhatsApp conversation inbox with real-time updates
│   │   ├── analytics/page.tsx               # Business intelligence — 14-day charts, intent heatmap
│   │   ├── contacts/page.tsx                # CRM — contact list, conversation history
│   │   ├── staff/page.tsx                   # HR — staff directory, leave calendar, wellness scores
│   │   ├── invoices/page.tsx                # Invoice tracking, debt aging table
│   │   ├── documents/page.tsx               # Document library, AI summary viewer
│   │   ├── calendar/page.tsx                # Calendar view (planned — Google Calendar sync)
│   │   ├── email-studio/page.tsx            # AI email composer (Pen agent)
│   │   ├── workflow-monitor/page.tsx        # Inngest job queue monitor
│   │   │
│   │   ├── onboarding/
│   │   │   ├── layout.tsx                   # Onboarding-specific shell (no Sidebar)
│   │   │   └── page.tsx                     # 6-step guided onboarding wizard
│   │   │
│   │   └── settings/
│   │       ├── page.tsx                     # Settings hub
│   │       ├── billing/page.tsx             # Plan management, PayFast subscription
│   │       ├── compliance/page.tsx          # POPIA — data erasure, audit log export
│   │       ├── onboarding/page.tsx          # Re-run onboarding steps after initial setup
│   │       └── referrals/page.tsx           # Referral programme — codes and rewards
│   │
│   └── api/
│       ├── health/route.ts                  # GET /api/health — public system status
│       │
│       ├── agents/
│       │   ├── [agentType]/route.ts         # Claude API proxy — streams responses per agent type
│       │   └── pen/route.ts                 # Email compose agent (Pen — Sonnet)
│       │
│       ├── billing/
│       │   ├── checkout/route.ts            # Create PayFast subscription checkout URL
│       │   └── webhook/route.ts             # PayFast ITN — verify + update subscription
│       │
│       ├── compliance/
│       │   └── delete-contact/route.ts      # POPIA right-to-erasure — delete contact + messages
│       │
│       ├── contacts/
│       │   ├── route.ts                     # GET (list) / POST (create) contacts
│       │   └── [id]/route.ts                # GET / PATCH / DELETE single contact
│       │
│       ├── conversations/
│       │   ├── reply/route.ts               # POST — send a manual WhatsApp reply from dashboard
│       │   └── status/route.ts              # PATCH — update conversation status (close/escalate)
│       │
│       ├── cron/
│       │   ├── daily-brief/route.ts         # Insight agent — AI business brief for all tenants
│       │   ├── debt-recovery/route.ts       # Chase agent — overdue invoice escalation
│       │   ├── wellness/route.ts            # Care agent — WhatsApp check-in messages to staff
│       │   ├── escalate-conversations/route.ts  # Auto-escalate unresolved conversations
│       │   ├── fan-out-brief/route.ts       # Distribute daily-brief across Inngest workers
│       │   ├── fan-out-wellness/route.ts    # Distribute wellness check-ins across Inngest workers
│       │   └── process-queue/route.ts       # Drain workflow_queue table → Inngest events
│       │
│       ├── documents/
│       │   ├── upload/route.ts              # POST — file upload, parse PDF/DOCX/XLSX, classify
│       │   └── [id]/route.ts                # GET / DELETE single document
│       │
│       ├── email-drafts/
│       │   ├── route.ts                     # GET (list) / POST (create) email drafts
│       │   └── [id]/route.ts                # GET / PATCH / DELETE single draft
│       │
│       ├── inngest/route.ts                 # Inngest event handler endpoint
│       │
│       ├── onboarding/
│       │   ├── create-tenant/route.ts       # POST — provision new tenant on signup
│       │   ├── add-staff/route.ts           # POST — bulk import staff during onboarding
│       │   ├── complete/route.ts            # POST — mark onboarding done, unlock dashboard
│       │   └── progress/route.ts            # GET — fetch current onboarding step
│       │
│       ├── settings/
│       │   └── profile/route.ts             # PATCH — update tenant settings (name, tone, FAQs)
│       │
│       ├── webhook/
│       │   ├── whatsapp/route.ts            # Meta Business API inbound — HMAC-SHA256 verified
│       │   └── email/route.ts               # Inbound email webhook — HMAC verified
│       │
│       ├── workflow/
│       │   ├── file-received/route.ts       # n8n → AdminOS file pipeline trigger
│       │   └── trigger/route.ts             # Internal workflow event trigger
│       │
│       └── admin/
│           ├── create-tenant/route.ts       # super_admin: provision tenant directly
│           └── tenants/route.ts             # super_admin: list all tenants
│
├── components/
│   ├── CookieConsent.tsx                    # POPIA-aware cookie banner, localStorage-backed
│   │
│   ├── dashboard/
│   │   ├── Sidebar.tsx                      # Navigation sidebar with route highlighting
│   │   ├── TopBar.tsx                       # Header with tenant name, user menu
│   │   ├── StatCard.tsx                     # Reusable metric card component
│   │   ├── RealtimeNotificationBar.tsx      # Live toast notifications via Supabase Realtime
│   │   ├── LiveActivityFeed.tsx             # Real-time activity stream
│   │   └── AgentStatusBar.tsx               # 6 AI agents — live active/idle indicator
│   │
│   ├── onboarding/
│   │   ├── AlexConversation.tsx             # Animated WhatsApp demo (Alex agent)
│   │   ├── CarePreview.tsx                  # Wellness check-in preview
│   │   ├── ChasePreview.tsx                 # Debt recovery preview
│   │   ├── DocExtraction.tsx                # Document extraction animation
│   │   └── PenStream.tsx                    # Email stream preview (Pen agent)
│   │
│   └── ui/
│       ├── badge.tsx                        # Status badge component
│       ├── button.tsx                       # Button with variants
│       └── card.tsx                         # Card container
│
├── inngest/
│   ├── client.ts                            # Inngest client — id: 'adminos'
│   └── functions/
│       ├── dailyBrief.ts                    # Daily AI business brief generation per tenant
│       ├── debtRecovery.ts                  # Debt recovery escalation workflow
│       ├── docIntelligence.ts               # Document processing pipeline
│       ├── onboardingSequence.ts            # Post-signup onboarding nudge sequence
│       ├── trialNudge.ts                    # Trial expiry reminder sequence
│       └── wellnessFanOut.ts                # Wellness check-in fan-out to all staff
│
├── lib/
│   ├── ai/
│   │   ├── agents.ts                        # SERVER-ONLY — imports supabaseAdmin. Builds context from DB.
│   │   ├── agents.config.ts                 # CLIENT-SAFE — agent definitions, names, models. No DB imports.
│   │   ├── buildSystemPrompt.ts             # Constructs cached system prompts from tenant settings
│   │   ├── callClaude.ts                    # Core Claude API wrapper — streaming, caching, intent/sentiment
│   │   ├── orchestrator.ts                  # Multi-agent orchestration logic
│   │   └── types.ts                         # Shared AI type definitions
│   │
│   ├── cache/
│   │   └── faqCache.ts                      # Upstash Redis FAQ cache — hash of question → response
│   │
│   ├── contacts/
│   │   └── upsert.ts                        # Upsert contact by phone or email
│   │
│   ├── files/
│   │   └── parser.ts                        # NODE-ONLY — pdf-parse, mammoth, xlsx. Never import client-side.
│   │
│   ├── onboarding/
│   │   ├── examples.ts                      # Demo data for onboarding wizard previews
│   │   └── messages.ts                      # Onboarding step copy and validation rules
│   │
│   ├── security/
│   │   ├── sanitize.ts                      # Prompt injection protection (see §b below)
│   │   ├── rateLimit.ts                     # Upstash sliding-window rate limiters (5 types)
│   │   └── audit.ts                         # Immutable audit log writer
│   │
│   ├── supabase/
│   │   ├── admin.ts                         # supabaseAdmin — service role, bypasses RLS, SERVER-ONLY
│   │   ├── client.ts                        # createClient() — browser anon key, respects RLS
│   │   └── server.ts                        # createServerClient() — SSR anon key + cookies, respects RLS
│   │
│   ├── whatsapp/
│   │   ├── send.ts                          # Meta Business API v19.0 — send, template, read receipt, HMAC verify
│   │   └── templates.ts                     # WhatsApp message template builders
│   │
│   └── workflows/
│       ├── debtRecovery.ts                  # Debt recovery escalation logic (level 1→2→3)
│       └── wellness.ts                      # Wellness check-in message construction
│
├── lib/workflow/
│   └── engine.ts                            # AdminWorkflowEngine — step runner with per-step timeouts
│
├── public/
│   └── manifest.json                        # PWA manifest — theme_color #0A0F2C, 3 shortcuts
│
├── scripts/                                 # Utility scripts (migrations, seed data)
├── supabase/                                # Supabase migration files
├── types/
│   └── database.ts                          # TypeScript types for all DB tables
│
├── middleware.ts                            # Auth guard, tenant injection, trial enforcement, security headers
├── next.config.ts                           # Next.js config — PWA, CSP, HSTS, image optimisation
├── vercel.json                              # Cron schedules, CORS headers
└── package.json                             # Dependencies
```

---

## b) Security Architecture

### `lib/security/sanitize.ts` — Prompt Injection Protection

All inbound WhatsApp messages pass through `sanitizeForAI()` before touching any Claude call. This is critical because the WhatsApp phone number is public — anyone can message it.

#### `sanitizeForAI(input: string): string`

Strips 17 known prompt injection patterns, then enforces a 2,000-character hard limit:

| # | Pattern | What it blocks |
|---|---------|----------------|
| 1 | `ignore (all )? previous instructions?` | Classic instruction override |
| 2 | `ignore (your )? system prompt` | System prompt bypass |
| 3 | `you are now (a )?` | Role reassignment |
| 4 | `forget (your )? (previous )? instructions/prompt/context` | Context erasure |
| 5 | `new instructions:` | Instruction injection |
| 6 | `[SYSTEM]` | Token injection |
| 7 | `[INST]` | LLaMA instruction token |
| 8 | `<<SYS>>` | LLaMA system token |
| 9 | `act as (if you are )?` | Persona override |
| 10 | `disregard (your )? (previous )? instructions?` | Instruction removal |
| 11 | `override (your )? (system )? prompt/instructions?` | Override attempt |
| 12 | `you must now` | Imperative override |
| 13 | `pretend (you are\|to be)` | Persona injection |
| 14 | `roleplay as` | Role injection |
| 15 | `jailbreak` | Direct jailbreak attempt |
| 16 | `DAN mode` | Do Anything Now jailbreak |
| 17 | `developer mode` | Developer mode jailbreak |

Matched segments are replaced with `[filtered]`, not deleted. This preserves message length for rate-limit purposes and gives the model context that filtering occurred.

#### `sanitizeSystemPromptValue(value: string, maxLength = 500): string`

Used for tenant-admin-supplied configuration (business name, FAQ entries, product descriptions) before injection into system prompts. Less aggressive than `sanitizeForAI` — admins are trusted users, but still protected against structural injection:
- Removes `[SYSTEM]`, `<<SYS>>`, `[INST]` tokens
- Strips C0/C1 control characters (`\x00–\x1F`, `\x7F`)
- Enforces `maxLength` (default 500 chars)

#### `validateTenantId(tenantId: string | null): string | null`

Validates UUID format before any Supabase query. Rejects anything that isn't `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`. Prevents header injection reaching the database layer.

---

### `lib/security/rateLimit.ts` — Rate Limiting

See [SYSTEM_DESIGN.md § Rate Limiting Architecture](./SYSTEM_DESIGN.md) for full table.

Key implementation detail: limiter instances are **singletons** — created once and cached in `limiterCache`. This avoids re-instantiating a Redis connection on every request.

---

### `lib/security/audit.ts` — Immutable Audit Log

Every agent action, data access, and billing event writes to `audit_log` via `writeAuditLog()`. The table is **append-only at the database level** — `UPDATE` and `DELETE` privileges are revoked. Not even `supabaseAdmin` can modify or delete audit entries.

---

## c) Onboarding Flow (6 Steps)

Route: `/dashboard/onboarding`

Target: any business is live within 15 minutes, no technical help needed.

```
Step 1 — Business Profile
  Fields: business name, type (school/clinic/NGO/retail/property/other),
          country, primary language, secondary languages, timezone
  Stored: tenants table (name, business_type, country, language_primary, timezone)

Step 2 — Team Setup
  Fields: add staff members (name + phone number + role)
  Stored: staff table (full_name, phone, role, department)
  Bulk import: paste CSV or add one-by-one

Step 3 — Knowledge Base
  Fields: FAQs (question + answer pairs), business hours, tone preference
          (professional / friendly / formal)
  Stored: tenants.settings (faqs, business_hours, tone)
  Used by: buildSystemPrompt() to configure Alex's personality

Step 4 — Strategy Document Upload (optional)
  Action: upload PDF/DOCX — Claude extracts goals automatically
  Stored: documents table, extracted goals → goals table
  Skip allowed: skip and add goals manually later

Step 5 — Connect Integrations
  Available: Gmail (via Resend), Google Calendar, PayFast (payments), Xero (accounting)
  Auth: PayFast → merchant ID/key; Xero → OAuth 2.0; Google → Supabase OAuth
  Stored: tenants.settings.integrations[]

Step 6 — Go Live
  Actions: verify WhatsApp number, send a test message via Meta API,
           view the first AI-generated daily brief
  Completion: sets user_metadata.onboarding_completed = true
              unlocks full dashboard
              triggers onboardingSequence Inngest function
```

---

## d) Server-Only vs Client-Safe Modules

| Module | Runtime | Why |
|--------|---------|-----|
| `lib/ai/agents.ts` | Server only | Imports `supabaseAdmin` (service role key) — would expose the key if bundled client-side |
| `lib/ai/agents.config.ts` | Client-safe | Agent definitions, names, models only — no DB imports |
| `lib/supabase/admin.ts` | Server only | `SUPABASE_SERVICE_ROLE_KEY` — must never reach the browser |
| `lib/supabase/server.ts` | Server only | Uses Next.js cookies API — not available client-side |
| `lib/supabase/client.ts` | Client-safe | `NEXT_PUBLIC_SUPABASE_ANON_KEY` — safe to expose |
| `lib/files/parser.ts` | Server only | Uses `require('pdf-parse')` — Node.js `require` syntax |
| `lib/security/audit.ts` | Server only | Uses `supabaseAdmin` |
| `lib/workflow/engine.ts` | Server only | Uses `supabaseAdmin` + Claude API |

> **Rule:** If a module imports from `lib/supabase/admin.ts`, it is server-only. Never import it from a `'use client'` component. TypeScript won't catch this at compile time — it will silently bundle the service role key into the client bundle.
