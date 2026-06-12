# AdminOS — Master Build Roadmap
> Mirembe Muse (Pty) Ltd · Complete feature roadmap from founding vision sessions · June 2026
> **Nothing in this document is optional. Everything gets built.**

---

## VISION STATEMENT

AdminOS is economic liberation infrastructure — the first AI-native business operating system built for African entrepreneurs, in African languages, for the African economic context. Every invoice it sends protects a job. Every compliance alert prevents a fine. Every lesson Langa teaches replaces an expert the owner could not afford.

**North star:** A business owner should be able to run their entire operation — legally, financially, operationally, and strategically — without ever leaving AdminOS. Every employee considers it their daily work home.

---

## ARCHITECTURE OVERVIEW

```
┌─────────────────────────────────────────────────────────────────┐
│                    AdminOS Platform                              │
├─────────────────────┬───────────────────────────────────────────┤
│   Next.js Web App   │         Expo Mobile App                   │
│  (Admin Dashboard)  │   (My Admin + Owner Mobile + Field Agent) │
│   adminos.co.za     │    iOS App Store + Google Play + PWA      │
├─────────────────────┴───────────────────────────────────────────┤
│                    Shared Backend Layer                          │
│         Supabase (af-south-1) · Inngest · Upstash Redis         │
├─────────────────────────────────────────────────────────────────┤
│                    AI Layer (Tiered)                             │
│    Claude Haiku (routine) · Sonnet (standard) · Opus (premium)  │
└─────────────────────────────────────────────────────────────────┘
```

---

## PHASE 0: INFRASTRUCTURE & FOUNDATIONS
> Weeks 1–4 · Must complete before any feature work

### 0.1 Database Migration to af-south-1
- [ ] Create new Supabase project in af-south-1 (Cape Town)
- [ ] Migrate all existing data from current region
- [ ] Update all environment variables (SUPABASE_URL, SUPABASE_ANON_KEY)
- [ ] Validate RLS policies post-migration
- [ ] Benchmark latency improvement (target: 8–20ms from SA vs current 120–180ms)
- [ ] Set up read replica for analytics queries

### 0.2 Table Partitioning (Performance at Scale)
- [ ] Partition `messages` table by tenant_id
- [ ] Partition `conversations` table by tenant_id
- [ ] Partition `workflow_queue` table by tenant_id
- [ ] Add composite indexes: (tenant_id, created_at) on messages, conversations, audit_log
- [ ] Add partial indexes for status columns (WHERE status = 'pending' etc.)
- [ ] Run EXPLAIN ANALYZE on top 10 heaviest queries, optimise

### 0.3 AI Cost Controls & Rate Limiting (CRITICAL — prevents abuse)
- [ ] Create `ai_usage_logs` table (tenant_id, model, tokens_in, tokens_out, feature, cost_usd, created_at)
- [ ] Create `ai_cost_budgets` table (tenant_id, plan, daily_token_limit, monthly_cost_limit_zar)
- [ ] Create `rate_limit_overrides` table (tenant_id, feature, requests_per_hour, updated_at)
- [ ] Implement token counting middleware in `lib/ai/callClaude.ts`
- [ ] Implement budget enforcement: hard stop when daily limit hit → queue for next day
- [ ] Implement per-feature rate limiting via Upstash Redis
- [ ] Create super-admin cost dashboard at `/api/admin/ai-costs`
- [ ] Add abuse spike detection: alert when tenant uses >3× their 7-day average
- [ ] Graceful degradation: when budget exceeded → queue → notify owner → resume next period

**Token budgets by plan (daily):**
```
Solo:     50,000 tokens/day    (~R2.50 Claude cost)
Grow:    200,000 tokens/day    (~R10.00)
Operate: 500,000 tokens/day    (~R25.00)
Scale:  1,000,000 tokens/day   (~R50.00)
Partner: 2,000,000 tokens/day  (~R100.00)
Trial:    25,000 tokens/day    (~R1.25)
```

**Model routing by feature:**
```
Claude Haiku (cheapest):
  - Daily brief (Solo/Grow tiers)
  - Chase sequence messages
  - Wellness check-in messages
  - Simple lookup/search
  - Announcement drafting
  - Basic email drafts (Solo tier)

Claude Sonnet (standard):
  - Langa mentor chat (all tiers)
  - Advisor agent
  - Document summarisation
  - Contract analysis
  - Onboarding sequence
  - Email Studio (Grow+)
  - Book in Action exercises
  - Daily brief (Operate+)

Claude Opus (premium — Scale/Partner only):
  - Board Pack generation
  - Exit/valuation analysis
  - Complex multi-document contracts
  - Strategic advisor deep sessions
  - Mastery/Legacy level academy content
```

**Caching strategy:**
```
System prompt cache:     5 min TTL   (already exists — extend)
Benchmark data:          24 hr TTL   (sector averages)
Daily brief output:      24 hr TTL   (regenerate once/day per tenant)
Langa session context:   10 min TTL  (between messages)
Framework library:       Static      (content doesn't change)
FAQ cache:               1 hr TTL    (already exists)
Tenant settings:         15 min TTL  (invalidate on settings save)
```

### 0.4 Monitoring & Observability
- [ ] Install Sentry (Next.js + Expo)
- [ ] Configure per-tenant error grouping in Sentry
- [ ] Build super-admin health dashboard `/dashboard/admin/health`
  - Per-tenant: workflow_queue backlog, failed jobs, AI usage, error rate
  - System: DB query p95, API response times, Inngest queue depth
- [ ] Set up Upstash Redis metrics dashboard
- [ ] Create alerting: Slack/email when error rate >1% or queue depth >1000
- [ ] Add `GET /api/admin/system-health` endpoint (super-admin only)

### 0.5 Priority Queue System
- [ ] Add `priority` column to `workflow_queue` (1=enterprise, 2=scale, 3=operate, 4=grow, 5=solo, 6=trial)
- [ ] Update `processQueue` cron to process by priority DESC
- [ ] Add priority assignment in all workflow_queue INSERT operations (based on tenant plan)
- [ ] Create priority upgrade function (plan upgrade → retroactively update pending jobs)

### 0.6 Role & Permission System (Foundation for Employee OS)
- [ ] Create `roles` table (id, tenant_id, name, permissions jsonb)
- [ ] Create `user_roles` table (user_id, tenant_id, role_id, branch_id nullable)
- [ ] Default roles: owner, manager, staff, field_agent, client (portal only)
- [ ] Create `permissions` enum: manage_staff, view_financials, approve_leave, view_payroll, manage_settings, manage_billing, view_analytics, send_broadcasts, manage_invoices, manage_contacts, manage_documents, manage_inventory, view_own_data_only
- [ ] Create permission middleware `lib/auth/permissions.ts`
- [ ] Add role check to all protected API routes
- [ ] Update RLS policies to respect roles (not just tenant isolation)
- [ ] Build permission management UI in `/dashboard/settings/team`
- [ ] Add role to JWT user_metadata on login

### 0.7 Solo vs Team Mode Toggle
- [ ] Add `mode` field to `tenants` table: 'solo' | 'team' (default: 'solo' if staff count = 0)
- [ ] Build mode toggle in settings
- [ ] Conditional navigation: Solo hides staff, HR, Employee OS sections
- [ ] Auto-switch to Team Mode when first staff member added
- [ ] Owner can manually toggle at any time

### 0.8 Expo App — Project Setup
- [ ] Create `expo-app/` directory at project root (sibling to Next.js)
- [ ] Initialise Expo SDK 52 with Expo Router 4
- [ ] Configure app.json: name, bundle IDs (co.adminos.app), icons, splash
- [ ] Set up shared packages: `packages/shared/` (types, supabase client, api utils)
- [ ] Install: expo-router, expo-camera, expo-location, expo-local-authentication, expo-notifications, expo-file-system, expo-image-picker, expo-document-picker
- [ ] Install: @supabase/supabase-js, zustand, @tanstack/react-query, nativewind
- [ ] Configure EAS Build for iOS + Android
- [ ] Configure Expo web (PWA output) — serves as PWA for employees without the app
- [ ] Set up push notification infrastructure (Expo Push + Supabase edge function)
- [ ] Create `push_tokens` table (user_id, tenant_id, token, platform, created_at)
- [ ] Configure deep linking (adminos.co.za/app → opens in app if installed)
- [ ] Set up OTA updates (expo-updates)

---

## PHASE 1: EMPLOYEE OS — MY ADMIN
> Weeks 5–10 · First feature employees use daily

### 1.1 Database Schema — Employee OS
```sql
-- Staff enhancements
ALTER TABLE staff ADD COLUMN job_title TEXT;
ALTER TABLE staff ADD COLUMN employment_type TEXT DEFAULT 'full_time';
ALTER TABLE staff ADD COLUMN start_date DATE;
ALTER TABLE staff ADD COLUMN salary NUMERIC(12,2);
ALTER TABLE staff ADD COLUMN bank_account_number TEXT;
ALTER TABLE staff ADD COLUMN bank_name TEXT;
ALTER TABLE staff ADD COLUMN id_number TEXT;
ALTER TABLE staff ADD COLUMN emergency_contact_name TEXT;
ALTER TABLE staff ADD COLUMN emergency_contact_phone TEXT;
ALTER TABLE staff ADD COLUMN address TEXT;
ALTER TABLE staff ADD COLUMN user_id UUID REFERENCES auth.users(id);

-- Clock in/out
CREATE TABLE clock_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('clock_in', 'clock_out', 'break_start', 'break_end')),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lat NUMERIC(10,7),
  lng NUMERIC(10,7),
  location_name TEXT,
  device_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shift rosters
CREATE TABLE shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  shift_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  location TEXT,
  notes TEXT,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'swapped', 'absent')),
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Expenses
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  receipt_url TEXT,
  receipt_storage_path TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Disciplinary records
CREATE TABLE disciplinary_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  record_type TEXT NOT NULL CHECK (record_type IN ('verbal_warning', 'written_warning', 'final_warning', 'suspension', 'dismissal', 'grievance', 'hearing')),
  incident_date DATE NOT NULL,
  description TEXT NOT NULL,
  outcome TEXT,
  documents_url TEXT[],
  issued_by UUID,
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Announcements
CREATE TABLE announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  audience TEXT DEFAULT 'all' CHECK (audience IN ('all', 'managers', 'specific')),
  audience_ids UUID[],
  pinned BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE announcement_reads (
  announcement_id UUID REFERENCES announcements(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (announcement_id, user_id)
);

-- Performance reviews
CREATE TABLE performance_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  reviewer_id UUID,
  review_period TEXT,
  ratings JSONB,
  comments TEXT,
  goals_set JSONB,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'acknowledged')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 1.2 API Routes — Employee OS
- [ ] `GET/POST /api/staff/clock` — clock in/out with GPS
- [ ] `GET /api/staff/my-profile` — staff member's own profile
- [ ] `PATCH /api/staff/my-profile` — update own profile
- [ ] `GET /api/staff/[id]/payslips` — fetch payslips for staff member
- [ ] `GET /api/staff/[id]/documents` — fetch personal documents
- [ ] `GET/POST /api/expenses` — submit/list expense claims
- [ ] `PATCH /api/expenses/[id]/approve` — manager approves expense
- [ ] `GET/POST /api/shifts` — roster management
- [ ] `GET/POST /api/announcements` — create/list announcements
- [ ] `POST /api/announcements/[id]/read` — mark as read
- [ ] `GET/POST /api/disciplinary` — IR log management
- [ ] `GET/POST /api/performance-reviews` — review management
- [ ] `POST /api/push/register` — register Expo push token
- [ ] `POST /api/push/send` — send push notification

### 1.3 Pages — My Admin (Expo App Primary)
- [ ] `(app)/my-admin/` — My Admin home screen
- [ ] `(app)/my-admin/my-day` — Today's tasks, schedule, roster
- [ ] `(app)/my-admin/my-leave` — Leave balance, apply, history
- [ ] `(app)/my-admin/my-pay` — Payslips, YTD earnings
- [ ] `(app)/my-admin/my-tasks` — Personal task list
- [ ] `(app)/my-admin/my-expenses` — Submit + track expense claims
- [ ] `(app)/my-admin/my-documents` — Employment contract, certificates
- [ ] `(app)/my-admin/my-training` — Learning paths, certificates
- [ ] `(app)/my-admin/clock` — Clock in/out with GPS
- [ ] `(app)/my-admin/handbook` — Company handbook, SOPs, policies
- [ ] `(app)/my-admin/announcements` — Company announcements
- [ ] `(app)/my-admin/team-directory` — Who's in today, contacts

### 1.4 Pages — Dashboard (Next.js — Manager/Owner View)
- [ ] `/dashboard/team` — Team overview (staff + shifts + leave at a glance)
- [ ] `/dashboard/expenses` — Expense claim approval queue
- [ ] `/dashboard/announcements` — Create and manage announcements
- [ ] `/dashboard/ir-log` — Disciplinary records management

---

## PHASE 2: BUSINESS HEALTH & DAILY INTELLIGENCE
> Weeks 11–14

### 2.1 Database Schema
```sql
CREATE TABLE business_health_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  overall_score NUMERIC(5,2),
  financial_health NUMERIC(5,2),
  legal_compliance NUMERIC(5,2),
  people_management NUMERIC(5,2),
  customer_relations NUMERIC(5,2),
  operational_maturity NUMERIC(5,2),
  strategic_readiness NUMERIC(5,2),
  dimension_details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, snapshot_date)
);

CREATE TABLE sector_benchmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_type TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  value_p25 NUMERIC,
  value_p50 NUMERIC,
  value_p75 NUMERIC,
  province TEXT,
  revenue_tier TEXT,
  sample_size INT,
  calculated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2.2 Business Health Score Engine
- [ ] Create `lib/intelligence/healthScore.ts` — calculates all 6 dimensions
  - Financial Health: debtor days, gross margin, cash position, profit trend
  - Legal Compliance: POPIA completion, contract coverage, compliance calendar %, CIPC status
  - People Management: leave balance accuracy, wellness avg, turnover rate, training completion
  - Customer Relations: NPS score, response time, conversation resolution rate, repeat business rate
  - Operational Maturity: SOP count, task completion rate, inventory accuracy, SOP acknowledgement %
  - Strategic Readiness: goals set, goals on track, exit score, succession plan status
- [ ] Cron: `GET /api/cron/health-score` — recalculate weekly for all tenants
- [ ] `/dashboard/health` — Health Score page with dimension drilldowns

### 2.3 Enhanced Daily Brief
- [ ] Expand `inngest/functions/dailyBrief.ts` to include:
  - What happened (existing)
  - What it means (new — contextual interpretation)
  - Today's business lesson (new — contextual trigger)
  - Compliance this week (new — from compliance calendar)
  - One Langa insight (new — most impactful action for today)
- [ ] Respect model tiering: Haiku for Solo/Grow, Sonnet for Operate+

### 2.4 Benchmarking Engine
- [ ] Cron: `GET /api/cron/calculate-benchmarks` — weekly anonymous aggregate by sector
- [ ] `GET /api/benchmarks/[businessType]` — fetch sector benchmarks for tenant
- [ ] Add benchmark comparison to health score page
- [ ] Add benchmark data to daily brief for Operate+ tenants

---

## PHASE 3: BUSINESS ACADEMY — LANGA & FOUNDATION LEVEL
> Weeks 15–22 · The educational heart of the system

### 3.1 Database Schema — Academy
```sql
CREATE TABLE academy_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level TEXT NOT NULL CHECK (level IN ('foundation', 'momentum', 'mastery', 'legacy')),
  module_number INT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  business_types TEXT[] DEFAULT ARRAY['all'],
  min_plan TEXT DEFAULT 'solo',
  estimated_minutes INT,
  unlock_condition JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE academy_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES academy_modules(id) ON DELETE CASCADE,
  lesson_number INT NOT NULL,
  title TEXT NOT NULL,
  content_type TEXT DEFAULT 'text' CHECK (content_type IN ('text', 'interactive', 'book_in_action', 'exercise')),
  content JSONB NOT NULL,
  estimated_minutes INT,
  trigger_events TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE academy_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES academy_lessons(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ,
  score NUMERIC(5,2),
  time_spent_seconds INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, lesson_id)
);

CREATE TABLE academy_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  certificate_type TEXT NOT NULL CHECK (certificate_type IN ('foundation', 'business_builder', 'acbo', 'module')),
  module_id UUID REFERENCES academy_modules(id),
  issued_at TIMESTAMPTZ DEFAULT NOW(),
  certificate_url TEXT,
  verification_code TEXT UNIQUE DEFAULT gen_random_uuid()::TEXT
);

CREATE TABLE achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  category TEXT CHECK (category IN ('milestone', 'compliance', 'learning', 'financial', 'team', 'community')),
  criteria JSONB NOT NULL
);

CREATE TABLE user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, achievement_id)
);

CREATE TABLE learning_streaks (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  current_streak INT DEFAULT 0,
  longest_streak INT DEFAULT 0,
  last_activity_date DATE,
  streak_broken_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE framework_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  book_title TEXT NOT NULL,
  author TEXT NOT NULL,
  framework_name TEXT NOT NULL,
  core_insight TEXT NOT NULL,
  detailed_content JSONB NOT NULL,
  situation_tags TEXT[],
  business_stage TEXT[] DEFAULT ARRAY['foundation', 'momentum', 'mastery', 'legacy'],
  business_types TEXT[] DEFAULT ARRAY['all'],
  urgency TEXT DEFAULT 'opportunity' CHECK (urgency IN ('crisis', 'warning', 'opportunity')),
  data_fields_needed TEXT[],
  action_label TEXT,
  action_route TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE book_in_action_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  framework_slug TEXT NOT NULL REFERENCES framework_library(slug),
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  outputs JSONB
);

CREATE TABLE contextual_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  condition JSONB,
  framework_slug TEXT REFERENCES framework_library(slug),
  lesson_id UUID REFERENCES academy_lessons(id),
  message_template TEXT,
  cooldown_hours INT DEFAULT 168,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE triggered_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  trigger_id UUID REFERENCES contextual_triggers(id),
  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  dismissed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);
```

### 3.2 Langa Agent
- [ ] Create `lib/ai/agents/langa.ts` — Langa mentor agent
- [ ] Langa system prompt: reads tenant data snapshot + user's completed lessons + health score + recent events + their plan (determines which frameworks and which model)
- [ ] Langa context builder: pulls live data from Supabase before every response
  - Current health score dimensions
  - Last 7 days' events (invoices, staff actions, compliance items)
  - Completed lessons + achievements
  - Business type, plan, language preference
  - Current goals and progress
- [ ] Route: `POST /api/agents/langa` — streaming, model-tiered, rate-limited
- [ ] Langa chat UI: `/dashboard/langa` (web) + `(app)/langa` (mobile — primary)
- [ ] Langa floating button on every dashboard page
- [ ] Langa in daily brief: one proactive insight per day
- [ ] Language support: respond in tenant's primary language

### 3.3 Knowledge Graph System
- [ ] Create `lib/academy/knowledgeGraph.ts`
- [ ] Function: `getRelevantFrameworks(eventType, tenantData)` → returns top 3 frameworks
- [ ] Function: `buildLangaContext(tenantId)` → returns structured context object
- [ ] Function: `getTriggeredLesson(eventType, tenantId)` → returns lesson if conditions met
- [ ] Seed framework_library with all 200+ books (see Book Canon section below)
- [ ] Seed contextual_triggers with all 30+ mapped event types

### 3.4 Foundation Level Content (6 Modules × ~5 Lessons)
- [ ] Module 1: Your Business Identity (CIPC, structure, bank account)
- [ ] Module 2: Money That Makes Sense (Revenue vs profit vs cash, P&L)
- [ ] Module 3: Your First Customer (Value proposition, pricing, invoicing)
- [ ] Module 4: Tax for Beginners (VAT, PAYE, UIF, SDL, provisional tax)
- [ ] Module 5: Your First Employee (Contract, BCEA, probation, UIF)
- [ ] Module 6: Protecting What You Built (POPIA, insurance, IP, contracts)
- [ ] Certificate generation: PDF with QR verification code
- [ ] Completion reward: 10% discount on next billing cycle

### 3.5 Contextual Learning Triggers (Map All 30+)
Every trigger wired in `lib/academy/knowledgeGraph.ts`:
- [ ] First invoice sent → payment terms lesson
- [ ] Invoice 7 days overdue → true cost of late payment
- [ ] First staff member added → employment contract requirements
- [ ] Wellness score <3 → staff retention cost lesson
- [ ] First expense claim → expense management lesson
- [ ] Contract uploaded with no expiry → contracts 101
- [ ] Gross margin drops 5+ points → margin vs markup
- [ ] Revenue hits R1M cumulative → VAT registration
- [ ] First supplier added, no PO → purchase orders lesson
- [ ] Health Score <60 → priority fix recommendations
- [ ] First broadcast → WhatsApp marketing under POPIA
- [ ] Leave declined twice same person → managing leave disputes
- [ ] Same client 5+ invoices → key client dependency risk
- [ ] Business turns 1 year old → Momentum Level unlock
- [ ] Business turns 2 years old → Mastery Level unlock
- [ ] Business turns 3 years old → Legacy Level unlock
- [ ] First international transaction → FX, SARB regulations
- [ ] Staff wellness avg <2.5 → burnout + Five Dysfunctions
- [ ] Cash balance <0 → Profit First framework trigger
- [ ] Owner doing >70% of tasks → E-Myth framework trigger
- [ ] No SOPs documented → Work the System trigger
- [ ] First disciplinary record → LRA process lesson
- [ ] Debtor days >45 → cash conversion cycle lesson
- [ ] First NPS response <6 → customer recovery lesson
- [ ] VAT threshold approaching → VAT registration module
- [ ] First payroll run → payroll compliance lesson
- [ ] First B-BBEE certificate uploaded → B-BBEE active support
- [ ] Exit score calculated → Built to Sell framework
- [ ] New hire added → WHO framework trigger
- [ ] Revenue plateau 3 months → Blue Ocean strategy

### 3.6 Achievement System (Seed All)
- [ ] Seed all achievements into `achievements` table
- [ ] Achievement check function: `lib/academy/checkAchievements.ts`
- [ ] Run achievement checks after every relevant business event
- [ ] Push notification on achievement earned (Expo)
- [ ] Achievement display on profile + LinkedIn share button

**Achievements to seed:**
```
first_breath, popia_certified, employer, cash_positive, tax_compliant,
year_one_survivor, year_two, year_three, clients_100, clients_500,
revenue_1m, revenue_5m, revenue_10m, full_team, clean_debtor_book,
community_mentor, foundation_graduate, business_builder_graduate, acbo,
seven_day_streak, thirty_day_streak, ninety_day_streak,
profit_first_implemented, first_sop, sos_builder, bbbbee_improved,
women_owned_certified, stokvel_treasurer, informal_to_formal
```

---

## PHASE 4: INDABA — FRAMEWORK LIBRARY
> Weeks 23–28 · The great gathering of business wisdom

### 4.1 Framework Library — Seed All 200+ Books

**Seed all frameworks with full structured content:**

*Finance & Cash Flow:*
- [ ] Profit First (Michalowicz) — 5-account system, allocation percentages
- [ ] Rich Dad Poor Dad (Kiyosaki) — Asset vs. liability, Cash Flow Quadrant
- [ ] Financial Intelligence (Berman & Knight) — P&L storytelling
- [ ] Simple Numbers (Crabtree) — Labour efficiency, pre-tax profit targets by tier
- [ ] Richest Man in Babylon (Clason) — Pay yourself first, seven cures
- [ ] Clockwork (Michalowicz) — 4 roles: Doing/Deciding/Delegating/Designing
- [ ] Fix This Next (Michalowicz) — Business Hierarchy of Needs
- [ ] The Great Game of Business (Stack) — Open book management

*Strategy:*
- [ ] Good to Great (Collins) — Level 5 Leadership, Hedgehog Concept, Flywheel
- [ ] Built to Last (Collins) — BHAGs, Core ideology, Clock-building
- [ ] Blue Ocean Strategy (Kim/Mauborgne) — ERRC grid, uncontested market space
- [ ] Playing to Win (Martin/Lafley) — Strategy as choice cascade
- [ ] Zero to One (Thiel) — Vertical progress, monopoly thinking
- [ ] Competitive Advantage (Porter) — Five Forces, value chain
- [ ] Crossing the Chasm (Moore) — Technology adoption, the chasm
- [ ] The Art of War (Sun Tzu) — Know yourself, know the enemy
- [ ] The Outsiders (Thorndike) — Capital allocation
- [ ] Measure What Matters (Doerr) — OKRs framework
- [ ] Balanced Scorecard (Kaplan/Norton) — 4 perspectives

*Systems & Operations:*
- [ ] The E-Myth Revisited (Gerber) — Technician trap, franchise prototype
- [ ] Traction/EOS (Wickman) — 6 components, Rocks, Scorecards, L10
- [ ] Scaling Up (Harnish) — Rockefeller Habits, one-page strategic plan
- [ ] The Lean Startup (Ries) — Build-Measure-Learn, MVP, pivot
- [ ] The Goal (Goldratt) — Theory of Constraints, 5 focusing steps
- [ ] Work the System (Carpenter) — Systems thinking, documentation
- [ ] Built to Sell (Warrillow) — 5 characteristics of a sellable business
- [ ] The Personal MBA (Kaufman) — 9 business building blocks

*Marketing & Sales:*
- [ ] $100M Offers (Hormozi) — Value equation, irresistible offers
- [ ] $100M Leads (Hormozi) — Core Four lead generation
- [ ] Building a StoryBrand (Miller) — 7-part brand story, SB7 framework
- [ ] This Is Marketing (Godin) — Smallest viable audience
- [ ] Influence (Cialdini) — 6 principles of persuasion
- [ ] Contagious (Berger) — STEPPS framework
- [ ] Positioning (Ries/Trout) — Position in the mind
- [ ] Purple Cow (Godin) — Remarkable
- [ ] Hooked (Eyal) — Habit loop: Trigger/Action/Reward/Investment
- [ ] Never Split the Difference (Voss) — Tactical empathy, calibrated questions
- [ ] Ogilvy on Advertising (Ogilvy) — Headlines, research, the consumer
- [ ] Obviously Awesome (Dunford) — Positioning methodology
- [ ] Permission Marketing (Godin) — Earned attention
- [ ] The 22 Immutable Laws (Ries/Trout) — Marketing laws

*Leadership & People:*
- [ ] The Five Dysfunctions (Lencioni) — Trust pyramid, team health
- [ ] Radical Candor (Scott) — Care personally + challenge directly, 2×2
- [ ] Drive (Pink) — Autonomy, Mastery, Purpose
- [ ] First Break All the Rules (Gallup) — Q12, play to strengths
- [ ] Extreme Ownership (Willink) — Leaders own everything
- [ ] Turn the Ship Around (Marquet) — Leader-Leader, intent-based leadership
- [ ] The Culture Code (Coyle) — Safety, Vulnerability, Purpose
- [ ] Multipliers (Wiseman) — Multipliers vs. Diminishers
- [ ] The 7 Habits (Covey) — 7 habits framework
- [ ] Dare to Lead (Brown) — Vulnerability, brave conversations
- [ ] Who (Smart/Street) — A Method for Hiring, scorecard
- [ ] High Output Management (Grove) — Output-focused management
- [ ] The Effective Executive (Drucker) — What effective executives do

*Entrepreneurship & Mindset:*
- [ ] Atomic Habits (Clear) — 4 laws, habit stacking, identity
- [ ] Mindset (Dweck) — Fixed vs. growth, praise effort
- [ ] Grit (Duckworth) — Passion + perseverance, deliberate practice
- [ ] Thinking Fast and Slow (Kahneman) — System 1/2, cognitive biases
- [ ] Antifragile (Taleb) — Gain from disorder, optionality
- [ ] The Black Swan (Taleb) — Tail risk, robust planning
- [ ] Man's Search for Meaning (Frankl) — Purpose, response freedom
- [ ] How to Win Friends (Carnegie) — Genuine interest, make people feel important
- [ ] Think and Grow Rich (Hill) — Definiteness of purpose, mastermind
- [ ] Deep Work (Newport) — Protected focus, shallow vs. deep
- [ ] The One Thing (Keller) — Focus question, dominoes
- [ ] Lean In (Sandberg) — Women in leadership, internal barriers

*African & SA Context:*
- [ ] Long Walk to Freedom (Mandela) — Leadership under adversity, long game
- [ ] Ubuntu philosophy — I am because we are, collective humanity
- [ ] King IV Report — Inclusive governance, stakeholder capitalism
- [ ] The Prosperity Paradox (Christensen) — Market creation in developing economies
- [ ] Africa Rising (Mahajan) — Africa as 1B+ opportunity

*Finance Advanced:*
- [ ] The Intelligent Investor (Graham) — Margin of safety, intrinsic value
- [ ] Poor Charlie's Almanack (Munger) — Mental models, latticework
- [ ] Thinking in Systems (Meadows) — Feedback loops, leverage points
- [ ] Freakonomics (Levitt/Dubner) — Incentives, hidden patterns

### 4.2 Book in Action — 20 Core Interactive Exercises
- [ ] E-Myth: "Are you the technician?" — maps owner's task data
- [ ] Profit First: "Set up your 5 accounts" — uses live revenue data
- [ ] Five Dysfunctions: "Team health diagnostic" — uses wellness data
- [ ] Good to Great Hedgehog: "Find your hedgehog" — 3-circle exercise
- [ ] Blue Ocean ERRC: "Map your offer" — interactive grid
- [ ] $100M Offers Value Equation: "Score your offer" — live calculation
- [ ] StoryBrand: "Write your brand script" — 7-part guided template
- [ ] EOS Traction: "Score your 6 components" — EOS assessment
- [ ] Porter's Five Forces: "Analyse your competitive position"
- [ ] Theory of Constraints: "Find your bottleneck" — from task data
- [ ] Built to Sell: "Score your sellability" — 5 characteristics assessment
- [ ] Radical Candor: "Rate your conversations" — 2×2 self-assessment
- [ ] Drive: "What motivates your team?" — AMPcheck
- [ ] Playing to Win: "Make your strategy choices" — 5-question framework
- [ ] WHO Method: "Build your hiring scorecard" — for next role
- [ ] Cash Conversion Cycle: "Calculate YOUR cycle" — from invoice data
- [ ] OKR Builder: "Set your quarterly OKRs" — linked to AdminOS Goals
- [ ] Atomic Habits: "Build your business habit stack"
- [ ] Fix This Next: "Find your business hierarchy problem" — from live data
- [ ] Ubuntu Business Assessment: "How Ubuntu is your business?"

### 4.3 Daily Mental Model System
- [ ] Cron: daily mental model selection (match to yesterday's business event)
- [ ] Add to daily brief template
- [ ] Mental model library: 365 entries (one per day, never repeats)

### 4.4 Momentum Level Content (5 Modules)
- [ ] Module 7: Reading Your Numbers Like a CFO
- [ ] Module 8: Managing People Without Losing Your Mind
- [ ] Module 9: Marketing Without a Budget
- [ ] Module 10: Operations That Outlast You
- [ ] Module 11: Compliance You Cannot Ignore

---

## PHASE 5: FINANCIAL FEATURES
> Weeks 29–34

### 5.1 Database Schema — Finance
```sql
-- Payroll
CREATE TABLE payroll_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  period_month INT NOT NULL,
  period_year INT NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'processing', 'finalised', 'paid')),
  total_gross NUMERIC(12,2),
  total_deductions NUMERIC(12,2),
  total_net NUMERIC(12,2),
  total_paye NUMERIC(12,2),
  total_uif_employee NUMERIC(12,2),
  total_uif_employer NUMERIC(12,2),
  total_sdl NUMERIC(12,2),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE payslips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  payroll_run_id UUID REFERENCES payroll_runs(id),
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  gross_salary NUMERIC(12,2) NOT NULL,
  paye NUMERIC(12,2) DEFAULT 0,
  uif_employee NUMERIC(12,2) DEFAULT 0,
  uif_employer NUMERIC(12,2) DEFAULT 0,
  sdl NUMERIC(12,2) DEFAULT 0,
  other_deductions JSONB DEFAULT '[]',
  net_pay NUMERIC(12,2) NOT NULL,
  components JSONB DEFAULT '[]',
  pdf_url TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cash flow forecasting
CREATE TABLE cashflow_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  forecast_date DATE NOT NULL,
  forecast_horizon_days INT DEFAULT 90,
  projected_inflows JSONB NOT NULL,
  projected_outflows JSONB NOT NULL,
  net_by_week JSONB NOT NULL,
  lowest_point NUMERIC(12,2),
  lowest_point_date DATE,
  risk_level TEXT CHECK (risk_level IN ('safe', 'watch', 'critical')),
  generated_at TIMESTAMPTZ DEFAULT NOW()
);

-- NPS Surveys
CREATE TABLE nps_surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id),
  trigger_type TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  score INT CHECK (score BETWEEN 0 AND 10),
  comment TEXT,
  channel TEXT DEFAULT 'whatsapp'
);

-- Loyalty
CREATE TABLE loyalty_programmes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  point_value_zar NUMERIC(8,2) DEFAULT 0.01,
  earn_rules JSONB NOT NULL,
  redeem_rules JSONB NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE loyalty_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  programme_id UUID REFERENCES loyalty_programmes(id),
  transaction_type TEXT CHECK (transaction_type IN ('earn', 'redeem', 'expire', 'adjust')),
  points INT NOT NULL,
  balance INT NOT NULL,
  reference TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 5.2 Payroll Lite Engine
- [ ] Create `lib/payroll/calculate.ts`
  - PAYE calculation using current SARS tax tables (2025/26)
  - UIF: 1% employee + 1% employer (capped at R17,872 monthly remuneration)
  - SDL: 1% employer (if annual payroll >R500,000)
  - Medical aid, pension deduction support
- [ ] `POST /api/payroll/run` — process payroll for period
- [ ] `POST /api/payroll/[id]/generate-payslips` — create PDF payslips
- [ ] `POST /api/payroll/[id]/distribute` — WhatsApp/email payslips to staff
- [ ] EMP201 pre-population for SARS submission
- [ ] IRP5 tracking (annual reconciliation data)
- [ ] `/dashboard/payroll` — payroll management page

### 5.3 Cash Flow Forecasting (90-day)
- [ ] Create `lib/intelligence/cashflowForecast.ts`
  - Inflows: outstanding invoices (probability-weighted by age), confirmed payments, recurring income
  - Outflows: known expenses, recurring costs, payroll dates, upcoming tax deadlines
  - Risk scoring: weeks where net goes negative
- [ ] Cron: weekly forecast regeneration
- [ ] `/dashboard/cashflow` — 90-day forecast chart page
- [ ] Alert system: push notification when forecast shows critical week

### 5.4 Profit First Implementation Assistant
- [ ] Guided setup wizard in `/dashboard/settings/profit-first`
- [ ] 5-account allocation configuration
- [ ] Bank transfer reminders (10th and 25th)
- [ ] Monthly allocation report

### 5.5 NPS Engine
- [ ] Auto-trigger NPS after: conversation resolved, invoice paid, job completed, 30 days post-booking
- [ ] WhatsApp NPS: 1-click score (1-10 via numbered response)
- [ ] NPS dashboard: trend line, by segment, by trigger type
- [ ] Alert when NPS drops >10 points week-on-week

### 5.6 Embedded Payment Collection
- [ ] Ozow integration (EFT, instant pay): `lib/payments/ozow.ts`
- [ ] SnapScan integration: `lib/payments/snapscan.ts`
- [ ] Payment link generation per invoice
- [ ] Client portal: Pay Now button on all outstanding invoices
- [ ] WhatsApp payment link in Chase sequences
- [ ] Payment confirmation webhook → auto-mark invoice paid → Chase agent stops → receipt auto-sent

---

## PHASE 6: OPERATIONS SUITE
> Weeks 35–42

### 6.1 Database Schema — Operations
```sql
-- Tasks & Projects
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('draft', 'active', 'on_hold', 'completed', 'cancelled')),
  start_date DATE,
  due_date DATE,
  budget NUMERIC(12,2),
  progress_pct NUMERIC(5,2) DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id),
  contact_id UUID REFERENCES contacts(id),
  invoice_id UUID REFERENCES invoices(id),
  document_id UUID REFERENCES documents(id),
  title TEXT NOT NULL,
  description TEXT,
  assigned_to UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'review', 'done', 'cancelled')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('urgent', 'high', 'medium', 'low')),
  due_date TIMESTAMPTZ,
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'agent_chase', 'agent_care', 'agent_compliance', 'document_expiry', 'contract_expiry', 'payroll', 'onboarding')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SOPs & Handbook
CREATE TABLE sop_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT,
  content JSONB NOT NULL,
  version INT DEFAULT 1,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  requires_acknowledgement BOOLEAN DEFAULT FALSE,
  applicable_roles TEXT[],
  created_by UUID,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sop_acknowledgements (
  sop_id UUID REFERENCES sop_documents(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  acknowledged_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (sop_id, user_id)
);

-- Inventory
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sku TEXT,
  description TEXT,
  category TEXT,
  unit_price NUMERIC(12,2),
  cost_price NUMERIC(12,2),
  current_stock INT DEFAULT 0,
  reorder_level INT DEFAULT 0,
  reorder_quantity INT,
  unit TEXT DEFAULT 'unit',
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, sku)
);

CREATE TABLE inventory_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('receive', 'sell', 'adjust', 'return', 'damage', 'transfer')),
  quantity INT NOT NULL,
  unit_cost NUMERIC(12,2),
  reference TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bookings
CREATE TABLE booking_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  duration_minutes INT NOT NULL,
  price NUMERIC(12,2),
  buffer_minutes INT DEFAULT 0,
  max_bookings_per_slot INT DEFAULT 1,
  staff_ids UUID[],
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  service_id UUID REFERENCES booking_services(id),
  contact_id UUID REFERENCES contacts(id),
  staff_id UUID REFERENCES staff(id),
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed', 'no_show')),
  notes TEXT,
  reminder_sent_at TIMESTAMPTZ,
  cancelled_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contracts
CREATE TABLE contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id),
  title TEXT NOT NULL,
  contract_type TEXT,
  content JSONB NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'partially_signed', 'signed', 'expired', 'cancelled')),
  value NUMERIC(12,2),
  start_date DATE,
  end_date DATE,
  auto_renew BOOLEAN DEFAULT FALSE,
  signed_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE contract_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  signer_name TEXT NOT NULL,
  signer_email TEXT,
  signer_role TEXT,
  signed_at TIMESTAMPTZ,
  signature_data TEXT,
  ip_address INET,
  token TEXT UNIQUE DEFAULT gen_random_uuid()::TEXT,
  expires_at TIMESTAMPTZ
);

-- Supplier directory
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  contact_person TEXT,
  payment_terms INT DEFAULT 30,
  rating NUMERIC(3,2),
  is_community_verified BOOLEAN DEFAULT FALSE,
  bbbbee_level INT,
  women_owned BOOLEAN DEFAULT FALSE,
  youth_owned BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 6.2 Task & Project Management
- [ ] `/dashboard/tasks` — kanban board + list view
- [ ] Auto-task creation from all agent actions (Chase, Care, compliance alerts, document expiry)
- [ ] Task assignment to staff members
- [ ] Due date tracking + overdue alerts
- [ ] Task comments
- [ ] Project view with progress percentage
- [ ] Client portal: client sees their project status

### 6.3 SOP Builder & Digital Handbook
- [ ] `/dashboard/handbook` — SOP management page
- [ ] Rich text SOP editor (or Markdown)
- [ ] Version history
- [ ] Assign SOPs to roles
- [ ] Track acknowledgements
- [ ] My Admin: staff read handbook, acknowledge SOPs
- [ ] Search across all SOPs

### 6.4 Inventory Management
- [ ] `/dashboard/inventory` — product catalogue + stock levels
- [ ] Invoice line items pull from product catalogue
- [ ] Stock movement on invoice creation (auto-deduct)
- [ ] Reorder alerts → WhatsApp to owner
- [ ] Stock take workflow (mobile-friendly for Expo app)

### 6.5 Appointment & Booking Engine
- [ ] `/dashboard/bookings` — calendar + booking management
- [ ] Public booking URL: `adminos.co.za/book/[tenant-slug]`
- [ ] Service configuration with duration + buffer + price
- [ ] Staff availability configuration
- [ ] Booking confirmation via WhatsApp auto-template
- [ ] 24-hour reminder WhatsApp
- [ ] Cancellation/reschedule self-service
- [ ] Blocked slots (staff leave auto-blocks)

### 6.6 eSignature Engine (ECTA-Compliant)
- [ ] Contract builder with template library
- [ ] Send for signature via tokenized link
- [ ] Signature capture (draw or type, mobile-optimised)
- [ ] IP + timestamp + device fingerprint on every signature
- [ ] PDF generation post-signing
- [ ] Auto-archive to Documents
- [ ] Expiry tracking from signed contracts
- [ ] ECTA compliance: proper audit trail

---

## PHASE 7: UBUNTU & COMMUNITY LAYER
> Weeks 43–48

### 7.1 Database Schema — Ubuntu
```sql
-- Stokvel
CREATE TABLE stokvel_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contribution_amount NUMERIC(12,2) NOT NULL,
  frequency TEXT DEFAULT 'monthly' CHECK (frequency IN ('weekly', 'fortnightly', 'monthly')),
  payout_order TEXT DEFAULT 'rotation' CHECK (payout_order IN ('rotation', 'lottery', 'fixed')),
  start_date DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'closed')),
  rules TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE stokvel_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES stokvel_groups(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  payout_position INT,
  joined_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE stokvel_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES stokvel_groups(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES stokvel_members(id) ON DELETE CASCADE,
  period_month INT NOT NULL,
  period_year INT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'late', 'excused')),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mentorship
CREATE TABLE mentor_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_tenant_id UUID NOT NULL REFERENCES tenants(id),
  mentee_tenant_id UUID NOT NULL REFERENCES tenants(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'declined')),
  focus_areas TEXT[],
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Community
CREATE TABLE community_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('need_help', 'can_help', 'experience', 'supplier_review', 'celebration')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  anonymous BOOLEAN DEFAULT FALSE,
  sector TEXT,
  province TEXT,
  replies_count INT DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Informal-to-formal tracking
CREATE TABLE formalization_progress (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  cipc_registered BOOLEAN DEFAULT FALSE,
  cipc_number TEXT,
  sars_registered BOOLEAN DEFAULT FALSE,
  sars_reference TEXT,
  vat_registered BOOLEAN DEFAULT FALSE,
  vat_number TEXT,
  business_account_opened BOOLEAN DEFAULT FALSE,
  first_contract_signed BOOLEAN DEFAULT FALSE,
  first_invoice_sent BOOLEAN DEFAULT FALSE,
  first_employee_hired BOOLEAN DEFAULT FALSE,
  uif_registered BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 7.2 Stokvel Module
- [ ] `/dashboard/stokvel` — stokvel group management
- [ ] Member management + contribution tracking
- [ ] Automated WhatsApp reminders to members on contribution due date
- [ ] Payout rotation calculation + notification
- [ ] Monthly treasurer's report (PDF + WhatsApp summary)
- [ ] Dispute management workflow

### 7.3 Community Peer Network
- [ ] `/dashboard/community` — community board
- [ ] Post categories: need help, can help, share experience, celebrate
- [ ] Supplier directory: rate, review, recommend suppliers
- [ ] Mentorship matching: browse + request mentors
- [ ] Anonymous post option
- [ ] AI moderation: flag inappropriate content

### 7.4 Informal-to-Formal Pathway
- [ ] 7-step guided wizard for informal businesses
- [ ] Step 1: Record income/expenses (no accounting needed)
- [ ] Step 2: CIPC registration guide + status tracking
- [ ] Step 3: SARS registration walkthrough
- [ ] Step 4: Business bank account (integration with FNB/Capitec)
- [ ] Step 5: First contract template + eSignature
- [ ] Step 6: First invoice + Chase setup
- [ ] Step 7: First employee onboarding
- [ ] Progress tracked in `formalization_progress`

### 7.5 B-BBEE Active Support Module
- [ ] `/dashboard/compliance/bbbbee` — B-BBEE scorecard
- [ ] Auto-calculate current score from existing data
  - Ownership (from tenant profile)
  - Management Control (from staff demographics)
  - Skills Development (from training completions)
  - Enterprise & Supplier Development (from supplier directory)
  - Socio-Economic Development (from community activity)
- [ ] Gap analysis: "3 points to next level — here's exactly what gets you there"
- [ ] Recommended actions tied to AdminOS features

### 7.6 Restorative Chase Agent Update
- [ ] Update `lib/workflows/debtRecovery.ts` — Tier 1 offers payment arrangement
- [ ] Add payment plan agreement generation (mini-contract)
- [ ] Chase agent detects if payment arrangement in place → monitors arrangement
- [ ] Only escalate if arrangement is broken
- [ ] Hardship flag: if client indicates hardship → offer extended plan, reduce to Tier 2 cadence

---

## PHASE 8: COMPLIANCE AUTOMATION SUITE
> Weeks 49–54

### 8.1 Database Schema — Compliance
```sql
CREATE TABLE compliance_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  recurrence TEXT,
  status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'due', 'overdue', 'completed', 'not_applicable')),
  completed_at TIMESTAMPTZ,
  document_id UUID REFERENCES documents(id),
  penalty_description TEXT,
  guidance_module TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE professional_licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES staff(id),
  license_type TEXT NOT NULL,
  license_number TEXT,
  issuing_body TEXT,
  issue_date DATE,
  expiry_date DATE,
  document_id UUID REFERENCES documents(id),
  renewal_reminder_days INT DEFAULT 60,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE employment_equity_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  reporting_year INT NOT NULL,
  total_workforce INT,
  demographics JSONB,
  occupational_levels JSONB,
  eea2_generated_at TIMESTAMPTZ,
  report_url TEXT,
  UNIQUE(tenant_id, reporting_year)
);
```

### 8.2 SA Compliance Calendar (Full Pre-Load)
Pre-seed all SA compliance items for every tenant on signup:
- [ ] VAT201: monthly/bi-monthly (configurable), 25th of month following
- [ ] EMP201: monthly, 7th of following month
- [ ] EMP501: bi-annual reconciliation (May 31, Oct 31)
- [ ] IRP5 certificates: employees, post EMP501
- [ ] IRP6: provisional tax (Aug 31, Feb 28, Sep 30)
- [ ] ITR14: corporate tax return (12 months after year end)
- [ ] CIPC annual return: anniversary of registration
- [ ] COIDA: return of earnings (31 March annually)
- [ ] Skills Levy return (if applicable)
- [ ] B-BBEE certificate renewal (annual)
- [ ] Municipal business licence renewal
- [ ] Industry-specific: HPCSA (clinics), SGB (schools), PPRA (property), NPO annual (NGOs)

### 8.3 Employment Equity Report Generator
- [ ] Auto-populate from staff demographic data
- [ ] EEA2 and EEA4 form generation (PDF)
- [ ] Designated employer threshold check (50+ employees OR R2M+ turnover)
- [ ] Annual submission reminder (1 October)

### 8.4 Health & Safety Module
- [ ] Incident log
- [ ] Risk register
- [ ] IOD (Injury on Duty) documentation workflow
- [ ] COIDA employer registration tracking
- [ ] Safety inspection checklists (by business type)

### 8.5 Professional License Tracking
- [ ] License register per staff member
- [ ] 90/60/30-day expiry reminders
- [ ] Document upload for license certificates
- [ ] Renewal task auto-created on expiry approach

---

## PHASE 9: MASTERY & LEGACY ACADEMY + AI INTELLIGENCE
> Weeks 55–62

### 9.1 Mastery Level Content (4 Modules)
- [ ] Module 12: Strategy Is a Choice (Hedgehog, Blue Ocean, OKRs)
- [ ] Module 13: Financial Sophistication (Balance sheet, working capital, credit, valuation)
- [ ] Module 14: Building the Right Team (Org design, hiring, EE opportunity)
- [ ] Module 15: Planning Beyond Tomorrow (Succession, exit, continuity)

### 9.2 Legacy Level Content (2 Modules)
- [ ] Module 16: Ubuntu in Your Business (Impact measurement, B Corp, Enterprise Development)
- [ ] Module 17: Giving Back Through the Platform (Mentorship activation, knowledge contribution)

### 9.3 Business Valuation Engine
- [ ] Create `lib/intelligence/valuation.ts`
  - Revenue multiple (sector-specific)
  - EBITDA multiple
  - Asset valuation
  - Weighted average of all methods
  - 7 value drivers scored (Built to Sell framework)
- [ ] `/dashboard/valuation` — valuation page
- [ ] Monthly snapshot stored in `business_health_snapshots`

### 9.4 Exit Readiness Score
Built on John Warrillow's Built to Sell framework:
- [ ] Repeatable process score (SOP documentation %)
- [ ] Owner independence score (tasks without owner %)
- [ ] Revenue concentration score (no single client >15%)
- [ ] Recurring revenue ratio
- [ ] Financial documentation completeness
- [ ] Legal compliance completeness
- [ ] Team depth score
- [ ] Combined exit score: 0-100

### 9.5 Board Pack Generator
- [ ] Monthly Inngest function: generate board pack for Scale/Partner tenants
- [ ] Sections: Executive Summary, Financial Performance, People & Culture, Customer Health, Operational Excellence, Compliance Status, Goals Progress, Risk Register, Month Ahead
- [ ] PDF generation with charts
- [ ] Auto-WhatsApp/email to owner on 1st of each month

### 9.6 AI Voice Intelligence (Ring Addon Enhancement)
- [ ] Twilio call recording → transcription (Whisper API or Deepgram)
- [ ] Transcript stored against contact record
- [ ] AI call summary → pushed to conversation thread
- [ ] Sentiment analysis on call
- [ ] Auto-CRM update from call content (extract follow-ups, promises, dates)
- [ ] AI receptionist mode: answers calls, qualifies, routes or takes message

### 9.7 Contextual Coaching Engine
- [ ] Create `lib/intelligence/coaching.ts`
- [ ] Pre-action hooks: flag relevant guidance before destructive actions
  - Before dismissal: LRA process check
  - Before final demand: NCA Section 129 check
  - Before probation extension: LRA maximum period check
  - Before signing contract: flag missing clauses
  - Before VAT threshold crossed: registration requirements
- [ ] Guidance surfaced as dismissible sidebar card in UI
- [ ] Each coaching card links to relevant Academy lesson

---

## PHASE 10: GROWTH & DISTRIBUTION FEATURES
> Weeks 63–70

### 10.1 Social Inbox — Unified Channels
```sql
CREATE TABLE social_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('facebook', 'instagram', 'google_reviews', 'twitter')),
  account_id TEXT,
  account_name TEXT,
  access_token TEXT,
  connected_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE social_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  external_message_id TEXT,
  sender_name TEXT,
  sender_id TEXT,
  content TEXT,
  message_type TEXT CHECK (message_type IN ('dm', 'comment', 'review', 'mention')),
  sentiment TEXT,
  replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```
- [ ] Facebook DM webhook integration
- [ ] Instagram DM webhook integration
- [ ] Google My Business reviews polling
- [ ] All pulled into AdminOS inbox alongside WhatsApp
- [ ] Reply from AdminOS → publishes back to platform
- [ ] AI draft responses (Haiku — cost efficient)

### 10.2 Embeddable Chat Widget
- [ ] Create `/app/widget/[tenant-slug]/` — widget embed code generator
- [ ] JavaScript snippet: `<script src="adminos.co.za/widget/[slug].js"></script>`
- [ ] Widget matches tenant's brand colours (from settings.logo_url + brand_color)
- [ ] Visitor chats → routed to AdminOS inbox (new conversation, channel='widget')
- [ ] AI auto-response from FAQ cache (Haiku — fast + cheap)
- [ ] Lead captured as contact when email/phone given
- [ ] Mobile responsive, WCAG AA accessible

### 10.3 Multi-Entity / Branch Management
```sql
CREATE TABLE branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  whatsapp_number TEXT,
  manager_user_id UUID,
  timezone TEXT DEFAULT 'Africa/Johannesburg',
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```
- [ ] Branch creation and management
- [ ] Staff assigned to branches
- [ ] Per-branch inbox, invoices, contacts
- [ ] Group-level consolidated analytics rollup
- [ ] Owner sees all branches in one dashboard
- [ ] Branch manager sees only their branch

### 10.4 White-Label Reseller Console
- [ ] `/app/reseller/` — reseller dashboard (separate layout)
- [ ] Reseller can provision new tenants
- [ ] Custom domain configuration
- [ ] Brand colour + logo override per reseller
- [ ] Sub-tenant billing (reseller pays AdminOS, reseller charges their clients)
- [ ] Revenue dashboard: sub-tenant MRR, churn, usage
- [ ] Reseller certification programme (completion of Partner Academy)

### 10.5 Knowledge Base Builder
```sql
CREATE TABLE kb_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT,
  order_index INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE kb_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category_id UUID REFERENCES kb_categories(id),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT[],
  published BOOLEAN DEFAULT TRUE,
  view_count INT DEFAULT 0,
  helpful_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```
- [ ] `/dashboard/knowledge-base` — article management
- [ ] Public URL: `adminos.co.za/kb/[tenant-slug]/[article-slug]`
- [ ] FAQ cache integration (AI uses KB as context)
- [ ] Client portal: search KB before messaging
- [ ] Deflection metric: "How many questions were answered by KB?"

### 10.6 Loyalty & Rewards Engine
- [ ] `/dashboard/loyalty` — programme configuration
- [ ] Earn rules: per purchase, per payment, per referral, per review
- [ ] Redeem rules: discount, free service, gift
- [ ] Points balance in client portal
- [ ] Points earned notification via WhatsApp
- [ ] Birthday bonus (auto-trigger on contact birthday)

---

## PHASE 11: PRICING & MONETISATION INFRASTRUCTURE
> Weeks 71–74

### 11.1 New Plan Tiers
- [ ] Update `Plan` type: 'solo' | 'grow' | 'operate' | 'scale' | 'partner'
- [ ] Migrate existing tenants: starter→grow, business→operate, enterprise→scale, white_label→partner
- [ ] Update `lib/billing/gates.ts` for all new features
- [ ] Update PayFast checkout for all 5 tiers
- [ ] Annual billing option (2 months free)

### 11.2 Add-On Billing System
- [ ] Add-on catalogue in database
- [ ] In-app add-on activation (one-click)
- [ ] Pro-rated billing on mid-cycle activation
- [ ] Add-on expiry management
- [ ] Bundle: Operate Pro = Operate + Ring + Sage

### 11.3 Special Pricing Programmes
- [ ] NGO/NPO verification (upload NPO certificate) → 40% discount applied
- [ ] School verification (upload DoE registration) → 30% discount
- [ ] Women-owned verification (WEP/WBDA certificate) → 25% discount
- [ ] Township programme (manual approval by AdminOS) → 50% discount 6 months
- [ ] SEDA programme (voucher code system) → 60% discount
- [ ] Youth programme (upload NYDA registration) → 30% discount

### 11.4 Impact Dashboard (for Cartier Award + Investors)
```sql
CREATE TABLE impact_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_businesses INT,
  active_businesses INT,
  total_staff_on_platform INT,
  jobs_protected_estimate INT,
  businesses_formalised INT,
  women_owned_businesses INT,
  township_rural_businesses INT,
  total_debt_recovered_zar NUMERIC(15,2),
  compliance_violations_prevented INT,
  active_languages INT,
  provinces_covered INT,
  ngo_nonprofit_count INT,
  youth_owned_count INT,
  stokvel_groups_count INT,
  informal_pathway_completions INT,
  academy_certificates_issued INT,
  mentorship_connections INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```
- [ ] Weekly cron to calculate and store impact snapshot
- [ ] `/api/admin/impact` — impact dashboard endpoint
- [ ] Public impact page: `adminos.co.za/impact` (shareable for press/investors)

---

## EXPO APP — COMPLETE SCREEN LIST

### Auth Screens
- [ ] Splash screen (animated AdminOS logo)
- [ ] Login screen (email/password + biometric after first login)
- [ ] Signup screen (simplified for mobile)
- [ ] Forgot password

### Owner Screens (Tab: Dashboard)
- [ ] Home — health score ring, today's KPIs, Langa greeting
- [ ] Inbox — conversations (WhatsApp + social)
- [ ] Quick invoice — fast invoice creation
- [ ] Langa — full chat interface with the mentor

### Employee Screens (Tab: My Admin)
- [ ] My Admin home
- [ ] Clock in/out (GPS map, one big button)
- [ ] My leave (apply, calendar, balance)
- [ ] My tasks (list + complete)
- [ ] My expenses (photo capture → submit)
- [ ] My pay (payslip viewer)
- [ ] My docs (document list)
- [ ] My training (lesson player)
- [ ] Company handbook (searchable)
- [ ] Team directory

### Shared Screens
- [ ] Notifications centre
- [ ] Profile settings
- [ ] Help / Contact

### Native Features Required
- [ ] Push notifications (Expo Notifications)
- [ ] Camera access (expense receipts, document scan, profile photo)
- [ ] GPS/Location (clock in/out for field agents)
- [ ] Biometric auth (Face ID / fingerprint)
- [ ] File download (payslip PDF)
- [ ] Deep links (notification → specific screen)
- [ ] Offline mode (last data accessible, queue actions for sync)
- [ ] Background sync (process queued actions on reconnect)

---

## API COST PROTECTION — COMPLETE IMPLEMENTATION

### Middleware Chain (every AI call passes through)
```
Request
  → authenticate tenant
  → check plan limits (daily token budget)
  → check rate limit (per feature, per hour)
  → check abuse flag
  → route to correct model (Haiku/Sonnet/Opus)
  → call Claude API
  → log tokens used → ai_usage_logs
  → update daily bucket in Redis
  → return response
```

### Redis Keys Structure
```
ai:budget:{tenant_id}:daily     → tokens used today (TTL: reset at midnight SAST)
ai:rate:{tenant_id}:{feature}   → requests this hour (TTL: 3600s)
ai:abuse:{tenant_id}            → abuse flag (manual clear by super-admin)
ai:cache:brief:{tenant_id}      → cached daily brief (TTL: 23h)
ai:cache:system:{tenant_id}     → system prompt cache (TTL: 5m)
ai:cache:benchmark:{sector}     → sector benchmarks (TTL: 24h)
```

### Super-Admin AI Cost Dashboard
- [ ] `/dashboard/admin/ai-costs` — per-tenant usage, cost in ZAR, trend
- [ ] Top 10 heaviest tenants flagged
- [ ] Abuse detection: tenants with >3× their own 7-day average
- [ ] Manual budget override per tenant
- [ ] Feature usage breakdown (which features cost most)

---

## DATABASE REALTIME — ADD NEW TABLES
Add to Supabase Realtime publications:
- [ ] `tasks`
- [ ] `announcements`
- [ ] `bookings`
- [ ] `clock_events`
- [ ] `business_health_snapshots`
- [ ] `academy_progress`
- [ ] `user_achievements`
- [ ] `nps_surveys`
- [ ] `payroll_runs`

---

## INNGEST FUNCTIONS — NEW FUNCTIONS REQUIRED
- [ ] `healthScore.ts` — weekly health score calculation per tenant
- [ ] `benchmarkCalculate.ts` — weekly anonymous benchmark aggregation
- [ ] `payrollReminder.ts` — monthly payroll run reminder
- [ ] `npsDispatch.ts` — post-event NPS survey trigger
- [ ] `bookingReminder.ts` — 24-hour booking reminder
- [ ] `loyaltyExpiry.ts` — points expiry at year end
- [ ] `sopAcknowledgement.ts` — remind unacknowledged staff
- [ ] `boardPack.ts` — monthly board pack for Scale/Partner
- [ ] `impactSnapshot.ts` — weekly impact metrics calculation
- [ ] `streakChecker.ts` — daily streak update for all active users
- [ ] `achievementChecker.ts` — event-driven achievement evaluation
- [ ] `contextualTrigger.ts` — route business events to lessons/coaching cards
- [ ] `formalizationNudge.ts` — nudge informal businesses through pathway
- [ ] `valuationSnapshot.ts` — monthly business valuation snapshot
- [ ] `cashflowForecast.ts` — weekly 90-day forecast regeneration
- [ ] `socialSync.ts` — hourly social inbox poll (Facebook, Instagram, Google)

---

## SECURITY HARDENING (For Scale)
- [ ] Add per-tenant request rate limiting (not just AI — all API routes)
- [ ] Document upload: validate file type + virus scan (ClamAV or Cloudflare WAF)
- [ ] Add OWASP headers to all responses
- [ ] Input sanitization: extend `lib/security/sanitize.ts` to all new routes
- [ ] PII detection: flag if AI response accidentally includes PII from wrong tenant
- [ ] Tenant isolation test suite: automated tests that verify RLS never leaks across tenants
- [ ] Penetration test: schedule before 1,000 tenant milestone
- [ ] POPIA-compliant data residency: confirm all data stays in af-south-1
- [ ] Signed URL TTL reduction: documents from 1hr → 15min for sensitive files
- [ ] Brute force protection on auth endpoints

---

## PRIORITY ORDER (Build Sequence)

```
WEEK 1-4:   Phase 0 (Infrastructure — MUST BE FIRST)
WEEK 5-10:  Phase 1 (Employee OS + Role System)
WEEK 11-14: Phase 2 (Health Score + Enhanced Brief)
WEEK 15-22: Phase 3 (Langa + Academy Foundation)
WEEK 23-28: Phase 4 (Indaba + Framework Library)
WEEK 29-34: Phase 5 (Finance: Payroll, Cash Flow, NPS, Payments)
WEEK 35-42: Phase 6 (Operations: Tasks, SOPs, Inventory, Bookings, Contracts)
WEEK 43-48: Phase 7 (Ubuntu: Stokvel, Community, B-BBEE, Restorative Chase)
WEEK 49-54: Phase 8 (Compliance Automation Suite)
WEEK 55-62: Phase 9 (Mastery/Legacy Academy + AI Intelligence)
WEEK 63-70: Phase 10 (Growth: Social Inbox, Widget, Multi-entity, Reseller)
WEEK 71-74: Phase 11 (Pricing + Impact Dashboard)
```

---

## DEFINITION OF DONE (for each feature)

A feature is not done until:
- [ ] Database migration written and applied
- [ ] API routes created with auth + RLS + input validation
- [ ] Rate limiting applied to all AI-touching endpoints
- [ ] UI built (web dashboard + Expo mobile if applicable)
- [ ] Inngest function created if async processing needed
- [ ] WhatsApp notification wired if event is user-facing
- [ ] Contextual learning trigger mapped if educational
- [ ] Achievement check added if milestone-worthy
- [ ] Test written (at minimum: happy path + tenant isolation)
- [ ] Sentry error boundary in place
- [ ] Feature gate in `lib/billing/gates.ts`
- [ ] Listed in ARCHITECTURE.md

---

*Last updated: June 2026 · Mirembe Muse (Pty) Ltd · AdminOS*
*This document is the single source of truth for what gets built. Review monthly.*
