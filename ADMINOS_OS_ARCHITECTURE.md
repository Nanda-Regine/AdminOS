# AdminOS — Operating System Architecture & Adoption Blueprint

### Mirembe Muse (Pty) Ltd · The transformation from "app with pages" → proactive business OS
### Source study: JarvisOS (personal intelligence OS) + BB-MotherShip-Deluxe (restaurant ops OS) · July 2026

> *"The machine handles everything the machine can handle. The owner handles only what requires a human."*

This document is the single source of truth for making **every AdminOS page a system that works end-to-end**, and for **what we are adopting from the sibling repos** (JarvisOS, BB-MotherShip-Deluxe) so we build on battle-tested code instead of from scratch.

---

## 0. THE KEY DISCOVERY

AdminOS already has the **organs** of an operating system — they were just never connected to a **nervous system**, and never **surfaced** where the owner feels the loop:

- **~30 Inngest autonomous workers** already exist: `dailyBrief`, `debtRecovery`, `healthScore`, `cashflowForecast`, `contextualTrigger`, `escalateConversations`, `bookingReminder`, `npsReminder`, `wellnessFanOut`, `licenseRemindersCron`, `loyaltyExpiry`, `payrollReminder`, `onboardingSequence`, `sequencesCron`, `impactSnapshot`, `valuationSnapshot`, `benchmarkCalculate`, `boardPack`, `sopAcknowledgement`, `formalizationNudge`, `trialNudge` …
- **Real intelligence modules**: `lib/intelligence/{cashflowForecast, healthScore, valuation, coaching}`.
- **AI layer**: `lib/ai/{orchestrator, agents, callClaude, buildSystemPrompt, costControls}` + **Langa** (`lib/ai/agents/langa.ts`).
- **Coaching guardrails**: `coaching_cards` that fire before risky actions (dismissal, final demand, VAT-threshold).

The `dailyBrief` worker **already writes a full Langa-authored brief every morning** — then buries it in `audit_log` where nobody sees it. **The gap is connection + surface + lead, not a rebuild.** That makes the launch-window transformation achievable.

---

## 1. THE THREE LAWS (from JarvisOS — our north star)

1. **If it can decide, it decides.** The owner approves / vetoes / ignores — never initiates. (Governed per-tenant by the autonomy config, below.)
2. **If data exists, it has already been read.** Every domain pushes its signal to the brief. No page waits to be visited.
3. **If it can be pre-built, it is pre-built.** Reminder sequences, reorder suggestions, invoice/quote/contract drafts — loaded and ready before the owner opens the app.

**UX standard:** the home is a **decision queue, not a dashboard**. Key surfaces are **visual objects** (rings, arcs, pipelines, heatmaps), not raw tables. Every domain page opens **pre-briefed** ("AR is R45k, R12k is >60 days, I've drafted 3 reminders — send?"), never a blank input.

---

## 2. WHAT WE ADOPT FROM **JarvisOS** (ranked, with source files)

| # | Pattern | JarvisOS source | AdminOS adaptation |
|---|---------|-----------------|--------------------|
| 1 | **Tiered autonomy config** — every unattended action gates on a per-domain tier: **A** auto-act · **B** auto-draft+wait · **C** surface-only. `resolveTier()` pure; **unconfigured → C** (safest). | `src/lib/os/autonomy.ts` + table `os_autonomy_config` | `tenant_autonomy_config(tenant_id, domain, decision_type, tier)`. The trust backbone: each tenant chooses whether AdminOS may **auto-send dunning** vs draft-only. Gate `debtRecovery`, reminders, reorders through it. Ties into the "armed but disarmed" recovery engine. |
| 2 | **Signal bus** — per-domain status signal, **dual-write** (Redis hot 2h TTL + Postgres `wing_signals` durable). **Inline-publish on mutation + cron safety net.** `getOSPulse()` reads all in one `Promise.all` → health dots. | `src/lib/os/{signals,wing-signals}.ts` | `adminos:signal:{domain}:{tenant}` (**BUILT** — `lib/signals/bus.ts`). Domains: money/sales/ops/people/governance. Add Postgres `domain_signals` durable mirror (fast-follow). |
| 3 | **AI cost governance** — global + per-identity spend ceiling circuit-breaker (fail-**closed** on ceiling, fail-**open** on Redis error), cost telemetry, `ai:spend:day:{id}:{date}`. | `src/lib/anthropic.ts` + `ai/{cost-log,guard}.ts` | Key ceilings **per tenant** (`ai:spend:day:{tenant}:{date}`) sized by plan tier + a global backstop. Protects launch from runaway spend. AdminOS already has `lib/ai/costControls.ts` to extend. |
| 4 | **Daily brief / synthesis engine** — cron → `Promise.allSettled` context gather → **strict-JSON 5-section** persona narration → cache (Redis 20h) + persist + push. | `src/inngest/os/morning-brief-auto.ts` | AdminOS `dailyBrief` exists; **now surfaced** (`lib/signals/brief.ts` + Command Center). Upgrade to strict-JSON sections so the UI renders deterministic cards. |
| 5 | **Model-tier routing + prompt caching** — `getSonnet/Haiku/Opus` singletons, `cachedSystemBlock()` (ephemeral cache_control), downgrade high-frequency calls to Haiku. | `src/lib/anthropic.ts`, `ai/personas.ts` | Already partially present (`getModelForFeature` + `cache_control` in dailyBrief). Standardise a `cachedSystemBlock()` helper; reserve Sonnet for tenant-facing chat, Haiku for classification/crons. |
| 6 | **Inngest conventions** — typed `EVENTS` registry (build-time typo safety), `enqueue()`, per-entity `step.run` fan-out, **AI out of the request path**, v4 2-arg. | `src/lib/queue.ts`, `src/inngest/index.ts` | Fan crons over `SELECT id FROM tenants WHERE status='active'`; each tenant an independently-retried step. Adopt the typed EVENTS registry. |
| 7 | **Proactive agent template** — cron → **pure selector** → **tier gate** → **idempotency via existing-notification check** → surface a row. The "did X for you" pattern. | `src/inngest/finance/dunning.ts` | Maps 1:1 to AR dunning, VAT-deadline alerts, low-stock reorder, contract-expiry. Keep idempotency + fail-to-Tier-C default. |
| 8 | **Domain vertical-slice skeleton + soft-failing free-API wrapper** — pure `buildSignal`/`refreshSignal` + RAG persona chat with typed tools; API wrapper = pure helpers + soft fetch + Redis cache + fallback. | `src/lib/finance/*`, `os/{eskom,weather}.ts` | The repeatable **module contract** for every AdminOS domain. SA-context feeds behind one wrapper: **Eskom load-shedding** (already have a key), **SARS deadlines**, **public holidays**, **forex**. |

**Two footguns carried over:** (a) import the concrete Redis instance, not a bare `.client` accessor; (b) `redis.keys(pattern)` is **not** auto-prefixed — glob patterns must include the `adminos:` prefix explicitly.

---

## 3. WHAT WE ADOPT FROM **BB-MotherShip-Deluxe** (ranked, with source files)

| # | Pattern | BB source | AdminOS adaptation |
|---|---------|-----------|--------------------|
| 1 | **Declarative feature registry + role-aware launcher** — one typed array `{href,label,description,icon,category,roles}` drives ALL nav, the category-grouped hub, and role gating (`featuresForRole`/`featuresByCategory`). Adding a page = one array entry. | `lib/nav/features.ts` | **The single biggest "one OS not 40 pages" lever.** Re-express the sidebar as the **value chain**: Attract→Convert · Deliver · Get-Paid · Team · Govern · Grow. Gate by plan + role. |
| 2 | **Notification + WhatsApp spine** — service-role, **best-effort (never throws)** `notifyUser`/`notifyManagers(location)`/`notifyLocation`; writes an in-app `notifications` row **and** mirrors to WhatsApp; config-guarded (no-ops cleanly when env unset). Channel-preference + dedupe. | `lib/notifications/{notify,whatsapp}.ts` | AdminOS is **WhatsApp-native** → huge. Overdue-invoice, payment-received, booking-reminder, AP-approval, shift notices → in-app bell + WhatsApp. Call from Inngest workers. |
| 3 | **AI receipt/invoice OCR → draft coded entry** — Claude **vision** → VAT-split, account-coded JSON with a balanced-JSON extractor + validation against a chart-of-accounts allowlist; **capture (anyone) decoupled from processing (finance)**. | `lib/ai/receipt.ts`, `067_receipt_queue.sql`, `060_finance_foundation.sql` | Expenses/AP arsenal: snap a supplier invoice → draft coded lines the owner confirms. Decouple capture from processing (field submit → back-office review). |
| 4 | **Pure exceptions engine + command-center cockpit** — `deriveExceptions(metrics)` pure threshold fn → ranked high/medium "needs you now"; render **exceptions-first**, then drill-through KPI tiles, then one-tap controls. | `lib/supabase/owner.ts` (`deriveExceptions`), `admin/cockpit` | Validates the Command Center **Needs You Now** + **Constraint** (already shipped). Extract a pure `deriveExceptions()` with AdminOS thresholds. |
| 5 | **Finance exports + pure costing/margin engine** — Xero/Sage journal CSV + **SARS VAT201** working paper; ingredient→recipe→menu-margin chain, break-even, price-for-margin (dependency-free, unit-tested). | `lib/finance/exports.ts`, `lib/cost/costing.ts`, `060_finance_foundation.sql` | Big SA trust signal: AR/AP export accountant-ready coded journals + VAT201; product/inventory **margin + break-even** on the inventory page. |
| 6 | **Cross-linking auto-tick trigger** — generic `AFTER INSERT` trigger (slug via `TG_ARGV`) that ties a log to its checklist step so modules feel woven, not siloed. | `069_autotick_logs.sql` | e.g. **recording a payment auto-updates invoice status + AR run**; capturing an expense auto-ticks the month's bookkeeping checklist. |

Also: **multi-tenant-via-join + RLS-recursion-safe `SECURITY DEFINER` helpers** (`015_…`, `052_…`), **soft-delete + `set_updated_at` + generated money columns + partial indexes** schema conventions, and an **offline write-outbox** (IndexedDB queue) for SA network/power conditions.

---

## 4. THE ADMINOS DOMAIN MAP (business functions as "wings")

Each is built to the **same vertical-slice contract**: Schema → pure services (`buildSignal`) → Inngest workers (autonomous) → API → **persona that leads** → visual UI → publishes its signal → reconciles cross-domain alerts.

| Domain | Pages | Signal | Persona | The outcome it must DELIVER |
|--------|-------|--------|---------|------------------------------|
| **Money** | invoices/AR, expenses/AP, cashflow, payroll | `money` (mode, AR/AP, runway) | *The Bookkeeper* | Chase fewer payments; never run out of cash; VAT/tax on time |
| **Sales** | contacts, inbox/WhatsApp, reach, ring, sequences | `sales` (pipeline, sentiment) | *The Closer* | Win more quotes; no lead dropped; retention |
| **Ops** | inventory, bookings, projects, tasks | `ops` (stockouts, bookings) | *The Operator* | Zero no-shows; no stockouts; jobs on time |
| **People** | staff, payroll, leave, IR, handbook | `people` (wellness, leave, IR) | *The People Lead* | Compliant, well-run team; BCEA/EE safe |
| **Governance** | compliance, board-pack, valuation, health | `governance` (deadlines) | *The Advisor* | No penalties; investor-ready; know your worth |
| **Grow** | academy, langa, community, stokvel | — | *Langa* | Level up the owner; Ubuntu collective |

---

## 5. THE LAYERED BUILD (status)

**Layer 0 — Nervous system** *(connective tissue)*
- ✅ **Signal bus** — `lib/signals/bus.ts` (money/sales/ops/people/governance, `financeMode` cascade helper).
- ✅ **Brief surfaced** — `lib/signals/brief.ts`; `dailyBrief` now caches → Command Center shows **Langa's brief**.
- ✅ **Command Center publishes signals** on every load; **PROTECT-mode cascade banner** live.
- ⏭ **Tiered autonomy config** (`tenant_autonomy_config`) — gate recovery/reminders. *(JarvisOS #1)*
- ⏭ **Per-tenant AI cost ceiling**. *(JarvisOS #3)*
- ⏭ Postgres durable mirror of signals + signal-refresh in the cron fan-out.

**Layer 1 — Every page a system** *(the arsenal pattern)*
- ⏭ **Feature-registry value-chain launcher**. *(BB #1)*
- ⏭ **Notification + WhatsApp spine**. *(BB #2)*
- ⏭ **Domain personas that lead** (extend Langa/orchestrator). *(JarvisOS persona pattern)*
- ⏭ **AI receipt OCR → draft AP entry**. *(BB #3)*
- ⏭ **Finance exports (VAT201 / journal CSV) + inventory margin/break-even**. *(BB #5)*

**Layer 2 — Autonomous rhythm** — wire the existing 30 crons into brief + signals; proactive agents on the tier gate.

**Layer 3 — Weekly synthesis** — cross-domain correlations ("cash dips every month-end → stage supplier payments"). Seed: `benchmarkCalculate` / `impactSnapshot`.

---

## 6. SHIPPED THIS SESSION
- Command Center (proactive home): Pulse · Needs-You-Now decision queue · Constraint (Theory of Constraints) · Vital Signs (Balanced Scorecard) · Handled-For-You · rhythm.
- Signal bus + brief surfacing + first cross-domain cascade (PROTECT mode).

*Cross-references: [[operating-system-vision]] · [[ux-excellence-roadmap]] · [[design-system-dark]]. Repos studied are the founder's own (JarvisOS public, BB-MotherShip-Deluxe private) — patterns adopted, not code lifted wholesale.*
