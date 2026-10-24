# Autonomy Cockpit - Read-only Scan (2026-10-24)

Scope: inngest/functions/*, app/api/inngest/route.ts, lib/autonomy, lib/notifications, lib/signals, lib/bank, lib/intelligence, lib/invoices, app/dashboard (layout, page, MyDay, workflow-monitor, health), components/dashboard.
Method: Glob/Grep/Read on narrow paths only. Anything not opened is marked UNVERIFIED. No whole-repo search was possible (ripgrep timed out), so "no other emitters/readers" claims are limited to the directories named.

## 1. Inngest / cron inventory

There is no app/api/cron/ directory (empty). Everything runs through Inngest, registered in app/api/inngest/route.ts:44-101. 40 function files, 49 registered functions. Crons are UTC unless prefixed `TZ=Africa/Johannesburg`.

Class: ACTS = changes state/sends, DRAFTS = needs approval, NOTIFIES = alert only, REPORTS = writes a report/snapshot.
Audit = writes audit_log via writeAuditLog (lib/security/audit.ts:24). Gate = reads tenant autonomy tier.

| Function (file) | Trigger | Does | Class | Gate | Audit | Isolation / notes |
|---|---|---|---|---|---|---|
| fan-out-debt-recovery-cron (fanOutDebtRecovery.ts:10) | cron 0 8 * * * (10:00 SAST) | pages all open overdue invoices on auto track, sends `adminos/invoice.overdue` per invoice | ACTS (fan-out) | no | no | chunked steps, good |
| debt-recovery-engine (debtRecovery.ts:25) | event adminos/invoice.overdue | tier 1-3: Claude writes message, WhatsApp send; tier 4+ or autonomy!=A: flags `awaiting_owner_review`, optional final-demand draft, bell notice | ACTS + DRAFTS + NOTIFIES | yes: money/invoice_reminder (:93), money/final_demand (:134) | yes (:107,:247,:270,:293,:316) | step-isolated. See risks R1-R4 below |
| daily-brief-engine (dailyBrief.ts:15) | event adminos/brief.generate | aggregates counts, Claude writes Langa brief, stores in Redis | REPORTS | no (budget gated via checkBudget :81) | yes (:129,:139) | step-isolated. Descriptive only, no forecast |
| fan-out-brief-cron (fanOutBrief.ts:6) | cron 0 3 * * 1-5 (05:00 SAST weekdays) | sends brief.generate + signals.refresh per tenant | fan-out | no | no | ok |
| signal-refresh-cron / engine (signalRefresh.ts:16,36) | hourly (SAST) / event adminos/signals.refresh | recomputes 5 domain signals into Redis + domain_signals | REPORTS | no | no | allSettled per domain. Output has NO reader (see section 4) |
| low-stock-alert-cron / engine (opsAlerts.ts:17,37) | cron 06:30 SAST / event adminos/ops.lowstock-check | low-stock bell notification | NOTIFIES | yes: ops/low_stock_reorder_alert, only controls WhatsApp mirror (:50,:60) | no | tier A/B/C all behave the same in-app |
| cold-lead-nudge-cron / engine (salesColdLeads.ts:22,42) | cron Mon 08:00 SAST / event adminos/sales.cold-lead-check | C: list in bell; B: AI drafts inside notification text; A: sends WhatsApp to up to MAX_PER_RUN contacts | NOTIFIES / DRAFTS / ACTS | yes: sales/going_cold_nudge (:57) | no | step-isolated. Draft lives only in notification body (:107) |
| approval-reminder-cron / engine (peopleApprovals.ts:16,36) | daily 08:00 SAST / event adminos/people.approval-check | nudges owner about pending leave/expenses | NOTIFIES | yes: people/approval_reminder (:54) | UNVERIFIED | |
| deadline-alert-cron / engine (governanceDeadlines.ts:18,38) | daily 07:00 SAST / event adminos/governance.deadline-check | bell alert at CHECKPOINT_DAYS before compliance items | NOTIFIES | yes: governance/deadline_alert (:50) | no | body = static penalty text, NO rand amount (:55-57) |
| booking-reminder-24h (bookingReminder.ts:10) | event adminos/booking.confirmed | A: WhatsApp reminder to customer; B/C: bell to owner | ACTS / DRAFTS / NOTIFIES | yes: ops/booking_reminder (:116) | no | emitted from 3 routes (bookings, bookings/[id]/confirm, book/[slug]) |
| escalate-conversations-cron (escalateConversations.ts:7) | */15 min | conversations open >48h set to `escalated`, bell alert | ACTS + NOTIFIES | no | yes (:59) | per-conversation step. Not tenant-looped, limit(100) |
| process-queue-cron (processQueue.ts:14) | */5 min | drains `workflow_queue` pending rows into events via EVENT_MAP (:4-11) | ACTS (dispatcher) | no | no | second `step.run`-less per-job update loop is inside one step |
| payroll-reminder-cron (payrollReminder.ts:17) | 20th monthly 10:00 SAST | bell + Expo push to view_payroll users | NOTIFIES | no | no | the only cron that calls pushToUsers (:54) |
| payslip-distribution (payslipDistribution.ts:25) | event adminos/payroll.run.approved | sends payslips | ACTS | UNVERIFIED | UNVERIFIED | emitted by app/api/payroll/[id]/distribute/route.ts:54 |
| cashflow-forecast-weekly (cashflowForecast.ts:16) | cron Mon 06:00 UTC | 90-day forecast per tenant, saved | REPORTS | no | no | per-tenant step + try/catch (:34-42). Forecast is NOT surfaced in the brief or Needs You Now |
| health-score-calculate (healthScore.ts) + fan-out (fanOutHealthScore.ts:6) | Mon 02:00 UTC / event adminos/health.score.calculate | health snapshot | REPORTS | no | no | |
| valuation-snapshot-weekly + valuation-on-demand (valuationSnapshot.ts:10,57) | Sun 03:00 UTC / event adminos/valuation.calculate | valuation snapshot | REPORTS | no | no | on-demand event has no emitter (section 2) |
| board-pack-generate + monthly (boardPack.ts:34,190) | event adminos/board_pack.generate / 1st 06:00 UTC | AI board pack | REPORTS | no | UNVERIFIED | budget metered per memory |
| compliance-calendar-roll (complianceCalendarRoll.ts:9) | 1st 05:00 SAST + event adminos/compliance.calendar.sync | rolls compliance items | ACTS | no | no | sync event has no emitter |
| license-reminders-cron (licenseRemindersCron.ts:6) | Mon 07:00 UTC | licence expiry reminders | NOTIFIES | no | UNVERIFIED | |
| sequences-cron (sequencesCron.ts:14) | hourly | marketing/nurture sequences | ACTS (WhatsApp) | POPIA consent layer per memory | UNVERIFIED | |
| reach-campaign-send (reachCampaignSend.ts:21) | event adminos/reach.campaign.send | sends campaign | ACTS | consent layer | UNVERIFIED | emitted by api/reach/campaigns/[id]/send:69 |
| doc-intelligence-pipeline (docIntelligence.ts:10) | event adminos/document.uploaded | classify/extract document | ACTS | no | UNVERIFIED | emitted api/documents/upload:94 |
| wellness fan-out (fanOutWellness.ts:6, wellnessFanOut.ts:7) | Mon 07:00 UTC / event | wellness check-in | ACTS | no | no | |
| nps-reminder-weekly + nps-survey-send (npsReminder.ts:10,62) | Wed 10:00 UTC / event adminos/nps.survey.created | NPS | ACTS | no | no | |
| trial-expiry-cron (trialExpiry.ts:12), trial-nudge (trialNudge.ts:6), onboarding-sequence (onboardingSequence.ts:11) | daily 03:00 UTC / events trial.expiring, subscription.activated | trial lifecycle | ACTS | no | no | trial-expiry-cron retries:0; the two events have no emitter in app/ or lib/ |
| account-deletion-purge (accountDeletionPurge.ts:11) | daily 02:30 UTC | POPIA purge | ACTS | no | UNVERIFIED | |
| formalization-nudge-weekly, sop-acknowledgement-weekly, benchmark-calculate-weekly, impact-snapshot-weekly, loyalty-expiry-year-end, streak-checker-daily, on-lesson-completed, contextual-trigger-academy, achievement-checker | various | academy / engagement / reporting | mixed | no | no | |
| social-sync-hourly (socialSync.ts:6) | hourly | STUB. Returns `note: 'stub - API calls not yet implemented'` (:51); runs every hour for nothing | none | no | no | register-and-forget; safe to disable |

Gated by tiers (7 of 8 catalogue decisions wired in inngest + 1 in lib): invoice_reminder, final_demand (debtRecovery), low_stock (opsAlerts), going_cold (salesColdLeads), booking_reminder, approval_reminder, deadline_alert; payment_receipt in lib/invoices/onPaid.ts:47.

Lack step isolation / try-catch (UNVERIFIED for those not opened): process-queue-cron fires all jobs in ONE step with allSettled (processQueue.ts:28-67, acceptable but a partial failure re-runs nothing); trialExpiry, impactSnapshot, loyaltyExpiry, benchmarkCalculate not opened. All tier-gated engines use `step.run`.

Risks found in the debt path (these matter for the "no WhatsApp yet" state):
- R1. No reminder cadence. `last_reminder_sent_at` is write-only (debtRecovery.ts:310; grep of inngest/ and app/api/money finds no read). Under tier A every daily sweep (fanOutDebtRecovery) re-sends to the same debtor every day once WhatsApp goes live, and the manual "Send reminders" button (app/api/money/remind/route.ts:57) re-sends on every click (only rate limited).
- R2. With WhatsApp not live, a tier A run still spends an AI call per invoice per day then fails in `send-message` and logs `debt_recovery_send_deferred` (:293) with no in-app fallback and no owner notice. Silent wasted spend and no proposal shown.
- R3. Held reminders (tier B/C, heldByAutonomy) store NO draft. The bell says "Reminder ready to send" (:163) but nothing was drafted (the draft step returns null when heldByAutonomy, :132). Invoice goes to `awaiting_owner_review`; the only owner actions are pause / resume / mark_handled (app/api/invoices/recovery/route.ts:36-38). Resume sets `auto` and the next sweep holds it again.
- R4. debtRecovery sends via `sendWhatsAppMessage(process.env.META_PHONE_NUMBER_ID...)` (:290) while onPaid/booking/cold-lead use `sendAsTenant`. Inconsistent sender identity.

## 2. Event bus

Emitters found (app/api, lib, inngest/functions):
- app/api: document.uploaded (documents/upload:94), reach.campaign.send (reach/campaigns/[id]/send:69), payroll.run.approved (payroll/[id]/distribute:54), booking.confirmed x3, board_pack.generate (board-pack:56), nps.survey.created (nps:54), invoice.overdue (money/remind:58), academy.lesson.completed (academy/lessons/[lessonId]:93).
- lib: business.event.fired (lib/academy/knowledgeGraph.ts:170, via fireBusinessEvent).
- inngest fan-outs: signals.refresh, brief.generate, health.score.calculate, wellness.checkin.due, invoice.overdue, ops.lowstock-check, sales.cold-lead-check, people.approval-check, governance.deadline-check, board_pack.generate (boardPack.ts:231).
- workflow_queue dispatcher (processQueue.ts:4-11): debt_recovery, wellness_checkin, daily_brief, doc_pipeline, onboarding, trial_nudge. Who INSERTS into workflow_queue: not found in app/api or lib (only a read in debtRecovery/dailyBrief). UNVERIFIED (may be DB triggers; see supabase/migrations/20260612_phase3_triggers_seed.sql, not opened).

Listeners with NO emitter found: `adminos/subscription.activated` (onboardingSequence), `adminos/trial.expiring` (trialNudge), `adminos/valuation.calculate` (valuation-on-demand), `adminos/achievement.check` (achievementChecker), `adminos/compliance.calendar.sync` (calendar roll event path). The first two may be reached only via workflow_queue (UNVERIFIED). Payment webhooks (PayFast/Paystack) were not opened, so subscription.activated may be emitted there: UNVERIFIED.

Orphaned emitted events (sent, no consumer): none found. The previously orphaned `adminos/push.send` was removed (payrollReminder.ts:11 comment).

Missing events that the target design needs and do not exist: `invoice.paid`, `invoice.overdue` as a per-invoice crossing event, `bank.import.committed`, `stock.low`, `payroll.run.finalised`. Today "invoice paid" is a direct function call (lib/invoices/onPaid.ts:24 handleInvoicePaid), not an event, so nothing downstream can subscribe.

## 3. Autonomy layer

- Config: lib/autonomy/tiers.ts (pure; DECISION_DEFAULTS :21-30, DECISION_CATALOGUE :33-42, resolveTier :44, quiet hours :58); lib/autonomy/config.ts:5 reads `tenant_autonomy_config` per call with the admin client (no caching; one query per decision per run).
- Decisions (8): money/invoice_reminder A, money/final_demand C, money/payment_receipt A, ops/low_stock_reorder_alert A, ops/booking_reminder A, sales/going_cold_nudge B, people/approval_reminder A, governance/deadline_alert A.
- UI: app/dashboard/settings/autonomy/page.tsx (reads table :25) + AutonomyControls.tsx (A "Auto" / B "Draft" / C "Off", optimistic save to /api/autonomy) + NotificationPreferences.tsx. Real.
- Where honoured: see section 1. Semantics are uneven: for owner-facing alerts (low stock, approvals, deadlines) the tier only toggles the WhatsApp mirror (`tierAllowsWhatsapp`, tiers.ts:55); in-app behaviour is identical for A/B/C. Real A/B/C divergence exists only for debt reminders, cold leads, booking reminders, payment receipt.
- Tier graduation: none. No code counts approvals/corrections or suggests moving a decision B -> A.
- Drafts / approvals storage:
  - `email_drafts` table (migrations/002_v2_architecture.sql:84; routes app/api/email-drafts, app/api/agents/pen). Used for email-studio authored drafts, NOT for autonomous proposals.
  - `invoices.recovery_status = 'awaiting_owner_review'` + `recovery_tier` is a status flag, not a draft store.
  - Cold-lead and final-demand drafts are embedded as text in a `notifications.body` (salesColdLeads.ts:107, debtRecovery.ts:164). Not actionable, not queryable, no send button.
  - `workflow_queue` is an internal job queue (pending/processing/complete/failed/cancelled), not an approval queue.
  - No `approvals`, `pending_actions` or `decision_queue` table exists in the migrations searched (grep of supabase/migrations for those names matched only email_drafts and unrelated files).
- Unified decision queue: NO. The nearest is "Needs You Now" on the dashboard (page.tsx:146-156) which is a client-computed list of COUNTS linking to other pages. Mobile has /approvals route (leave/expense push route) UNVERIFIED.
- Activity feed: partial. `audit_log` is the real record. Dashboard "Handled for you - 24h" regex-buckets audit rows (page.tsx:180-194) and loses tenant detail. components/dashboard/LiveActivityFeed.tsx is realtime but only conversation/document/invoice INSERTs (not what the machine did). /dashboard/workflow-monitor lists last 30 audit rows raw.
- Undo: NONE for autonomous actions. Only generic soft delete (lib/db/softDelete.ts). Payments recorded from bank matches cannot be reversed (recordPayment.ts:57 sets paid_at; no reverse path found).

## 4. In-app surfaces

| Surface | Verdict | Evidence / what is missing |
|---|---|---|
| Command Center (app/dashboard/page.tsx) | PARTIAL-REAL | Live queries on 12 tables per view. Needs You Now = counts of 8 things (:146) with deep links, no inline action, no reason text, no amounts, no ordering by value. Vital signs real. "Constraint" logic is a fixed priority list (:160-177). No projection, no "what the machine did and can undo". |
| MyDay (MyDay.tsx) | REAL | Role-scoped own tasks, bookings, shifts, leave, announcements, SOP acks. Staff-only; no proactive items (nothing like "your shift changed"). |
| BriefCard + brief | THIN | Text blob from Claude, Redis only, 30h TTL (brief.ts:20-25). Inputs are descriptive counts (dailyBrief.ts:48-62). No forecast, no per-item links, no actions. Brief not re-generated if budget blocked. |
| Notifications (lib/notifications/notify.ts, NotificationBell.tsx, /api/notifications) | PARTIAL | Bell polls every 60s (NotificationBell.tsx:33). Dedupe works. Tenant-level (`user_id: null`), so one user marking read hides it for the whole tenant. No actions on a notification besides a link. No categories/grouping/snooze. |
| Push (lib/notifications/push.ts) | PARTIAL | Expo push infrastructure is good (batching, dead token revoke). Used only for leave/expense approvals, staff notices, payroll reminder (usersWithPermission). `notifyTenant()` (every owner alert from the crons) does NOT push (notify.ts:75-89 only inserts a row and optionally WhatsApps). So recovery escalations, low stock, deadlines, cold leads never reach the owner's phone. Biggest cheap win. |
| RealtimeNotificationBar | THIN / has a bug | Subscribes to conversations, invoices, documents with no tenant filter in the channel (relies on RLS, UNVERIFIED). Overdue toast keys on stale `days_overdue` and `status === 'unpaid'` (:48), but the app creates invoices as `sent` (see fanOutDebtRecovery.ts:17-20) so it rarely fires. |
| Ops page / Sales cockpit | UNVERIFIED | app/dashboard/ops/page.tsx and sales/page.tsx exist; not opened. lib/ops/signal.ts buildOpsIntel (real data: low stock, bookings, tasks) feeds opsAlerts. |
| Health (app/dashboard/health/page.tsx) | REAL (descriptive) | Reads business_health_snapshots (six dimensions), radar + trend. Weekly snapshot. No link from low dimensions to concrete fixes (UNVERIFIED beyond first 60 lines). |
| Cashflow page | UNVERIFIED | Engine real (section 5). |
| Workflow monitor (app/dashboard/workflow-monitor/page.tsx) | PARTIAL, BUG | Counts `status === 'completed'` (:61) but the queue writes `'complete'` (processQueue.ts:48; debtRecovery.ts:330). Completed always shows 0. Raw audit rows, no per-function health. |
| Signal bus (lib/signals/bus.ts) | WRITE-ONLY | Five signals computed hourly per tenant and republished on every Command Center view (page.tsx:122-141, 5 Redis writes + 5 Supabase upserts, fire-and-forget `void`). `readAllSignals`/`readSignal` have NO caller in app/, lib/ (except bus.ts itself), inngest/, components/. The cost is paid, the benefit not. |
| Approvals-like pages | PARTIAL | Expenses, leave (/dashboard/team), recovery queue (/dashboard/invoices) each separate. Recovery review API: app/api/invoices/recovery/route.ts. |

## 5. Prediction / signal code

Exists:
- 90-day cashflow forecast: lib/intelligence/cashflowForecast.ts. Open invoices x FIXED payment-probability curve by days overdue (:38-45: 0.85 / 0.80 / 0.70 / 0.55 / 0.35 / 0.15), collection date heuristic (:115-117), approved expenses +5 days (:133), payroll sized on latest run for every pay day in horizon (:149-162), EMP201 via emp201DueDate. Weekly cron persists it (cashflowForecast.ts inngest). Cash on hand: `openingBalance` source not confirmed in lines read (UNVERIFIED).
- Health score: lib/intelligence/healthScore.ts calculateHealthScore :41, saveHealthSnapshot :333; six dimensions.
- Valuation: lib/intelligence/valuation.ts (not read).
- Money signal + financeMode (bus.ts:178): BUILD / STEADY / PROTECT from net position, runway, stuck AR.
- Debt tiers: debtRecovery.ts:77-86 (1: <=2d, 2: <=6, 3: <=13, 4: <=29, 5: <=60, 6: >60). lib/debt/overdue.ts, recoveryGuard.ts.
- Bank: lib/bank/reconcile.ts suggestMatches (score on invoice number 70 / tail 45, exact amount 50, payer name up to 35; high confidence at score>=95, not ambiguous, not partial, :116). categorise.ts + tenant rules; service.ts commitStatement/confirmMatch/confirmHighConfidence (:348, :377). Matching is suggested only; a person must press confirm. Bank lines arrive only by manual CSV upload (parseStatement.ts, MAX 2 MB / 5000 rows, service.ts:11-12). No bank feed.
- Reorder: opsAlerts + lib/ops/signal.ts flag `current_stock <= reorder_level`. No quantity, supplier, or lead time logic. A `suppliers` table exists (migrations/20260612_phase6_operations.sql:218). No purchase_orders table found in migrations searched.

NOT captured, needed for the target features:
- Likely-to-pay-late: per-customer payment history. `invoices.paid_at` is set (recordPayment.ts:57) and `due_date` exists, so days-to-pay per contact is derivable now WITHOUT new capture, but no code derives it. Not captured: promise-to-pay dates, dispute reasons, reminder sent/opened/replied timestamps (reminder sends are only an audit row and a write-only last_reminder_sent_at), part-payment timing (amount_paid is a running total, no payments ledger; only the last `payment_method` is kept), customer sector/credit terms.
- 30-day projection that is trustworthy: a real opening bank balance (bank_transactions has `balance` per line but nothing uses the latest one), recurring bills (only approved expense claims + payroll are modelled; no recurring supplier payments/rent/VAT201 outflow), VAT payable amount, sales run-rate for non-invoiced income (Quick Sale cash sales exist but are not in the forecast, UNVERIFIED).
- Reorder draft: reorder quantity (EOQ or par level), preferred supplier per product (suppliers table exists, product->supplier link not verified), unit lead time, sales velocity per product (stock transactions exist via RecordTransactionModal, velocity not computed), a purchase order object.
- Compliance amounts: payroll_runs totals exist (PAYE/UIF/SDL) so EMP201 can be quantified (the forecast already does this), VAT201 period math exists (per memory sitting 3) but governanceDeadlines alerts carry no amounts (:57).
- Learning from corrections: bank category rule save is the ONE learned loop (service.ts:307-326 `remember`). No generalisation to reminders, drafts, match overrides, or tier graduation. Rejected suggestions are not recorded.

## 6. Cockpit performance (layout + page)

Observed sequence on every /dashboard/* navigation (layout is `force-dynamic`, layout.tsx:1):
1. layout.tsx:18 `supabase.auth.getUser()` (network call to Supabase Auth).
2. layout.tsx:23-27 tenants select (admin) - SEQUENTIAL after step 1.
3. layout.tsx:33 `getContext()` which calls `getUser()` AGAIN (context.ts:76), then `checkSuperAdmin` (admins table, :85/:155) then `getUserPermissions` (user_roles + roles) SEQUENTIALLY (:89). 
4. page.tsx:34 `getUser()` a third time, then page.tsx:37 `getContext()` again (a fourth getUser + 2-3 more DB reads). Layout and page do not share results, so the auth chain runs twice per page load.
5. page.tsx:55-72 12-way Promise.all (good), but invoices and expenses use `allRows` which pages through ALL rows (unbounded for big tenants); the 200-row audit pull is JS-bucketed.
6. page.tsx:121 `getDailyBrief` + `getSetupState` in a second wave after the big await.
7. page.tsx:122-141 five `publishSignal` fire-and-forget writes (Redis + Supabase upsert each) on every view.
8. TrialBanner, RealtimeNotificationBar, NotificationBell (60s poll) fetch independently on the client.

Concrete refactors, ordered by payoff / effort:
- P1 (S): wrap `getContext` in React `cache()` (lib/auth/context.ts) so layout + page + nested server components resolve it once per request; pass `user` out of it so page.tsx stops calling `getUser()` directly. Removes ~2 auth round trips + 4-6 DB reads per load.
- P2 (S): inside getContext run `checkSuperAdmin` and `getUserPermissions` with `Promise.all` (context.ts:85-89 are independent); start the tenants business_type read in parallel with them (layout.tsx:23).
- P3 (S): remove the five `publishSignal` calls from the page render (page.tsx:122-141); the hourly signalRefresh already does it. Saves 10 writes per view. Or, better, read signals for the strip and compute only the "Needs You" list live.
- P4 (M): cache the cockpit aggregate in Redis for 60-120s keyed by tenant (the signal bus already exists for this purpose, bus.ts header) and revalidate on writes; first paint then reads 1-2 keys instead of 12 queries.
- P5 (M): replace `allRows` full scans of invoices/expenses with SQL aggregates (a Postgres view or RPC returning sum(outstanding), sum overdue, sum > 60d, count by status). Today cost grows with invoice count.
- P6 (M): stream the page. Render the Pulse header from cached signals, wrap Needs You Now / Vital Signs / Goals in `<Suspense>` with skeletons so the shell paints on slow 3G (CLAUDE.md requirement).
- P7 (S): switch `autonomy/config.ts` to one cached read per request; each tier-gated function currently queries it per call.
- P8 (S): `NotificationBell` polling at 60s on every page is fine; add Supabase realtime on `notifications` instead (RealtimeNotificationBar already holds a socket) and drop the poll.

## 7. Gap analysis vs target design

| Target | Status | What exists | Files to extend | Effort | Value |
|---|---|---|---|---|---|
| (a) One decision queue: every autonomous action DONE+logged or PROPOSED one-tap with reason and undo | MISSING (parts exist) | audit_log, notifications, recovery_status flag, email_drafts | NEW table `agent_actions` (id, tenant_id, kind, status proposed/done/dismissed/undone, payload jsonb, reason, undo jsonb, created_at, resolved_at, deleted_at) + `lib/actions/queue.ts` (propose / execute / undo); `app/api/actions/*`; replace the counts block in app/dashboard/page.tsx:146 with queue rows; migrate debtRecovery.ts:156, salesColdLeads.ts:100, bookingReminder.ts:120 to `propose()` | L | 5 |
| (b1) Bank import -> match -> invoice paid -> stop chasing | PARTIAL | suggest + confirm + paid side effects (bank/service.ts:348, recordPayment.ts:69). Chasing stops implicitly because `isOpen()` is re-checked at send time (debtRecovery.ts:67) | auto-confirm high-confidence matches behind a new autonomy decision `money/bank_auto_match` (tiers.ts catalogue), call `confirmHighConfidence` from commit path (bank/service.ts:208) and write action rows; emit `adminos/invoice.paid` from handleInvoicePaid (onPaid.ts:24) | M | 5 |
| (b2) Invoice overdue -> draft reminder | PARTIAL | tier 1-3 auto-send, tier 4+ flagged | store the AI draft (move draft step out of the final-demand branch, debtRecovery.ts:131) as a proposed action with Send / Edit / Pause buttons; add cadence check using last_reminder_sent_at (debtRecovery.ts:63) | M | 5 |
| (b3) Low stock -> draft PO | MISSING | low stock alert only (opsAlerts.ts) | add reorder_qty + preferred supplier columns on products, `purchase_orders` table, proposal action, draft PO text/PDF; velocity from stock transactions | L | 3 |
| (b4) Compliance due -> amount from real payroll/VAT | PARTIAL | amounts computed in cashflowForecast.ts:157-169 and VAT201 code (per memory) but alert text static (governanceDeadlines.ts:57) | in `deadlineAlertEngine` attach amount from latest payroll_run (EMP201) / VAT201 calc; link to prefilled filing page | M | 4 |
| (c) Predictive morning brief | PARTIAL / THIN | Brief + forecast both exist but are disconnected: dailyBrief.ts:25-62 never reads the saved forecast | read latest saved cashflow forecast + per-customer late-pay list into `aggregate-data`; add "next 7 days cash in/out, lowest point, who is likely to pay late" sections; surface as structured JSON (not just text) in BriefCard | M | 4 |
| (d1) Activity feed | PARTIAL | audit_log; "Handled for you" regex counts (page.tsx:180) | real feed page over `agent_actions` + audit_log with human sentences | S-M | 4 |
| (d2) Reversibility | MISSING | soft-delete only | `undo` payload per action type (reverse a payment, restore recovery_status, cancel queued send); a 15-min undo window for sends that have not left | M | 4 |
| (d3) Tier graduation | MISSING | tiers static | count approve-without-edit streak per decision; suggest B -> A after N; store in tenant_autonomy_config; show in settings (AutonomyControls.tsx) | M | 3 |
| (e) Learn from owner corrections | PARTIAL (bank categories only) | bank_category_rules via setCategory (service.ts:294-329) | record edits to drafts (diff), rejected suggestions, overridden matches in action rows; feed few-shot examples into draftRecoveryMessage / draftColdLeadMessage (lib/ai/callClaude) | M-L | 3 |
| (f) Job-health strip | PARTIAL | workflow-monitor page (buggy status count :61) | per-function last run / failure from `agent_actions` or audit rows; a heartbeat table written by each cron (`job_runs`); strip in TopBar | M | 4 |
| Owner push for tenant alerts | MISSING | push infra in push.ts | add push to `notifyTenant` (notify.ts:75) via `usersWithPermission(tenantId, 'view_analytics')`, honouring quiet hours (delivery.ts) | S | 5 |

## RANKED recommended build order

Principle: in-app and push first, no WhatsApp dependency; each step is shippable alone; fix correctness bugs before adding autonomy that amplifies them.

1. Hardening fixes that make later autonomy safe (S, risk low)
   - What: (i) cadence guard for reminders (read last_reminder_sent_at; min gap per tier; apply to manual button too), (ii) when WhatsApp is not sendable, skip the AI call and create an in-app proposal instead of burning budget then silently deferring (R2), (iii) fix workflow-monitor 'completed' vs 'complete' (workflow-monitor/page.tsx:61), (iv) fix RealtimeNotificationBar overdue condition (:48), (v) disable or gate social-sync stub.
   - Files: inngest/functions/debtRecovery.ts, app/api/money/remind/route.ts, app/dashboard/workflow-monitor/page.tsx, components/dashboard/RealtimeNotificationBar.tsx, inngest/functions/socialSync.ts, app/api/inngest/route.ts.
   - Depends on: nothing. Risk: low; touches money chasing logic, add tests.

2. Cockpit first-load speed (S-M, risk low)
   - What: P1, P2, P3, P7 from section 6 now; P4/P6 after.
   - Files: lib/auth/context.ts (React cache + Promise.all), app/dashboard/layout.tsx, app/dashboard/page.tsx (drop publishSignal, reuse ctx), lib/autonomy/config.ts.
   - Depends on: nothing. Risk: low. Must keep the fail-closed property of getContext (do not cache across requests).

3. Owner push for all tenant alerts (S, value 5)
   - What: `notifyTenant` also calls `pushToUsers` for users holding the relevant permission, respecting quiet hours and per-type opt-out.
   - Files: lib/notifications/notify.ts, lib/notifications/push.ts, lib/notifications/delivery.ts, expo-app route handling (route field).
   - Depends on: nothing. Risk: low-medium (alert fatigue; keep the existing dedupe).

4. Decision queue + activity feed (L, value 5; the centre of the target)
   - What: `agent_actions` table (RLS + soft delete + UTC), `lib/actions/queue.ts`, `/api/actions` (list, approve, dismiss, undo), new "Needs You Now" panel that renders proposed rows with reason + one-tap, and a "Done for you" feed with Undo. Start by routing three producers into it: held debt reminders (store the draft), cold-lead drafts, booking-reminder drafts. Retire the "draft inside notification body" pattern.
   - Files: supabase/migrations (new), lib/actions/*, inngest/functions/debtRecovery.ts, salesColdLeads.ts, bookingReminder.ts, app/dashboard/page.tsx, app/api/invoices/recovery/route.ts (becomes a thin adapter), settings/autonomy.
   - Depends on: 1. Risk: medium (new write path, authz matrix and persona-walk gate need entries; migration to production needs Nanda's approval per CLAUDE.md).

5. Bank-to-paid closed loop with auto-match tier (M, value 5)
   - What: new autonomy decision `money/bank_auto_match`; on statement commit, high-confidence matches are applied (tier A) or queued as proposals (tier B) in the decision queue; emit `adminos/invoice.paid` event so reminders in flight stop and receipts go out. Undo = reverse payment (needs a payments ledger or an inverse of recordInvoicePayment).
   - Files: lib/autonomy/tiers.ts, lib/bank/service.ts, lib/invoices/recordPayment.ts, lib/invoices/onPaid.ts, app/api/bank/*, queue from item 4.
   - Depends on: 4. Risk: medium-high (money); keep tier B default and only `high` confidence; add payments ledger first (see 6).

6. Payments ledger + customer payment-behaviour (M, value 4)
   - What: `invoice_payments` rows (amount, date, method, source bank_transaction_id) written by recordInvoicePayment; derive per-contact median days-to-pay, late rate; use it to replace the fixed probability curve in cashflowForecast.ts:38 and to rank the debtor list.
   - Files: migration, lib/invoices/recordPayment.ts, lib/intelligence/cashflowForecast.ts, new lib/intelligence/paymentBehaviour.ts.
   - Depends on: none technically, pairs with 5. Risk: medium (backfill from invoices.paid_at/due_date for history; accuracy needs volume, label as estimate).

7. Predictive morning brief with structured items (M, value 4)
   - What: feed saved forecast, lowest point date, likely-late payers, compliance amounts, queue counts into dailyBrief; store structured JSON (not just text) so BriefCard renders actionable rows linking to queue items. Also attach amounts to deadline alerts.
   - Files: inngest/functions/dailyBrief.ts, lib/signals/brief.ts, app/dashboard/BriefCard.tsx, inngest/functions/governanceDeadlines.ts, lib/intelligence/cashflowForecast.ts.
   - Depends on: 6 for the late-payer part; the rest can ship after 4. Risk: low-medium (AI cost metered; keep the budget check).

8. Job-health strip (M, value 4)
   - What: `job_runs` heartbeat written by a small wrapper around each cron, strip on the dashboard and the fixed workflow-monitor; alert the operator when a daily cron misses its window.
   - Files: inngest/client wrapper, workflow-monitor page, components/dashboard/TopBar.tsx.
   - Depends on: 1. Risk: low.

9. Low-stock to draft PO (L, value 3) and tier graduation + learning from corrections (M-L, value 3)
   - What: product reorder qty + supplier link, purchase_orders table, velocity; then graduation prompts and correction capture once the queue has real approve/edit data (needs weeks of data to be meaningful).
   - Depends on: 4. Risk: medium; do last.

## UNVERIFIED list
Ops page, sales page, cashflow page contents; mobile /approvals; who inserts workflow_queue rows (possible DB triggers); emitters of subscription.activated and trial.expiring (payment webhooks not opened); whether `openingBalance` in the forecast comes from real data; audit coverage in peopleApprovals, payslipDistribution, sequencesCron, reachCampaignSend, docIntelligence, boardPack, licenseRemindersCron; step isolation in trialExpiry, impactSnapshot, loyaltyExpiry, benchmarkCalculate; RLS on realtime channels; absence of other callers of `readSignal` inside app/ subfolders beyond the grep (grep covered app/, lib/, inngest/, components/ and found none).
