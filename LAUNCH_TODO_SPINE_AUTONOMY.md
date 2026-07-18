# Launch TODO — Block 1 (Alert Spine) + Block 2 (Cron + Autonomy)

The connective tissue that makes the cockpits *act*, not just show. Grounded in what already exists.

**Existing assets (reuse, don't rebuild):**
- `notifications` table → `id, user_id, tenant_id, type, title, body, read, action_url, data, created_at`
- `lib/whatsapp/send.ts` → `sendWhatsApp({to, message})` (Meta Cloud API; `sendWhatsAppMessage`, `sendWhatsAppTemplate`)
- `components/dashboard/RealtimeNotificationBar.tsx` → the bell/bar UI (already realtime)
- Workers already inserting notifications: `formalizationNudge`, `loyaltyExpiry`, `sopAcknowledgement`, `npsReminder`, `licenseRemindersCron`
- Signal bus `lib/signals/bus.ts` + six `refresh{Domain}Signal()` in `lib/{domain}/signal.ts`
- Recovery: `inngest/functions/debtRecovery.ts` (`AUTO_SEND_MAX_TIER`, `recovery_status:'awaiting_owner_review'`) + `lib/debt/recoveryGuard.ts`
- `tenant_autonomy_config` — **does NOT exist yet** (Block 2 creates it)

---

## BLOCK 1 — Notification + WhatsApp alert spine
> Best-effort, never-throws fan-out: writes an in-app `notifications` row **and** mirrors to WhatsApp. Called from workers + cockpit actions. (BB-MotherShip `lib/notifications/notify.ts` pattern.)

### 1.1 The spine module — `lib/notifications/notify.ts`
- [ ] `notify(opts)` — `{ tenantId, userId?, type, title, body, actionUrl?, data?, whatsapp?: { to, text }, dedupeKey? }`. Writes a `notifications` row via `supabaseAdmin`; if `whatsapp` set → `sendWhatsApp`. **Wrap the whole thing in try/catch — must NEVER throw into the caller** (a notification failing can't break the primary action).
- [ ] `notifyOwners(tenantId, opts)` — resolve the tenant's owner/manager users (see 1.2) → one `notify` per user (in-app) + WhatsApp to each phone on file + the business `tenants.whatsapp_number`.
- [ ] `notifyContact(tenantId, contactId, opts)` — resolve the contact's phone → WhatsApp; in-app only if they have a portal user.
- [ ] **Config-guard:** if `META_PHONE_NUMBER_ID` / `META_WHATSAPP_ACCESS_TOKEN` unset → skip WhatsApp cleanly (verify `sendWhatsApp` already no-ops; if not, guard here). Identical behaviour dev/prod.
- [ ] **Dedupe/idempotency:** if `dedupeKey` given, skip when an unread `notifications` row with the same `data.dedupe_key` exists in the last N hours (mirrors the dunning idempotency pattern).

### 1.2 Owner/recipient resolution — `lib/notifications/recipients.ts`
- [ ] `getTenantOwners(tenantId)` → `{ userId, phone }[]`. Source: `supabaseAdmin.auth.admin.listUsers()` filtered by `app_metadata.tenant_id === tenantId` and role ∈ {owner, admin, manager} — OR a `profiles`/members table if one exists (confirm first). Cache per request.
- [ ] `getContactPhone(tenantId, contactId)` → `contacts.phone` / `wa_id`.

### 1.3 Alert templates — extend `lib/whatsapp/templates.ts`
- [ ] Owner alerts (in-session / free-form): `payment_received`, `approval_needed`, `recovery_escalation`.
- [ ] Customer alerts (**business-initiated outside 24h window → needs a Meta-APPROVED template**): `booking_reminder`, `invoice_reminder`. ⚠️ Flag: submit these for Meta template approval early; owner-facing in-app has no such limit.

### 1.4 Wire the spine into existing workers
- [ ] `debtRecovery.ts`: on auto-sent reminder → `notifyOwners('recovery.sent', "Reminder sent to {contact} for {amount}")`; on tier-4+ → `notifyOwners('recovery.escalation', "Needs your review")` (this replaces the silent `awaiting_owner_review`).
- [ ] Payment webhook (Paystack/PayFast handlers) → `notifyOwners('payment.received', "R{amount} received from {contact}")`.
- [ ] `bookingReminder.ts` → `notifyContact` (customer WhatsApp booking reminder) — the "cut no-shows" win.
- [ ] On expense-submit / leave-submit → `notifyOwners('approval.needed', ...)`.
- [ ] Standardise `formalizationNudge` / `loyaltyExpiry` / `npsReminder` / `licenseRemindersCron` to call `notify()` (they hand-roll inserts today).

### 1.5 Cockpit one-click actions → real sends
- [ ] `POST /api/money/remind` — for overdue invoices, enqueue reminders via the recovery engine **gated by the autonomy tier (Block 2)**; write a notification per send. Wire the Money cockpit "Send reminders" button (make it a small client action component).
- [ ] People cockpit approve/reject → fire `notify` to the staff member on decision.

### 1.6 In-app bell — `RealtimeNotificationBar.tsx` + API
- [ ] `GET /api/notifications?unread=1` (tenant+user scoped) and `PATCH /api/notifications/[id]/read` (+ "mark all read"). Confirm the component consumes these + the Supabase realtime channel.
- [ ] Unread badge count in the TopBar; clicking a notification routes to `action_url`.

### 1.7 Preferences (optional for launch)
- [ ] `notification_preferences` (tenant_id, type, in_app bool, whatsapp bool) OR a `tenants.settings.notify` map; default all-on. `notify()` checks it before the WhatsApp mirror.

### 1.8 Verify
- [ ] Unit tests (node:test, laptop-safe): dedupe logic + config-guard never-throws.
- [ ] Manual: real WhatsApp send to a test number (or dry-run with env unset → no throw); bell shows + marks read; a worker still succeeds with WhatsApp env removed.

**Block 1 acceptance:** owner gets in-app + WhatsApp on payment-received, approval-needed, recovery-escalation; customer gets a booking reminder; nothing throws when WhatsApp is unavailable.

---

## BLOCK 2 — Signal-refresh cron + tenant autonomy config
> (A) keep every domain signal warm without a page load; (B) a per-tenant tier governing what AdminOS may do unattended.

### Part A — Signal refresh cron
### 2.1 `inngest/functions/signalRefresh.ts`
- [ ] Cron `{ cron: 'TZ=Africa/Johannesburg 0 * * * *' }` (hourly; tighten later). Step 1: `SELECT id FROM tenants WHERE active AND NOT suspended`. Step 2: per-tenant `step.run('refresh-{id}')` → `Promise.all([refreshMoneySignal, refreshOpsSignal, refreshSalesSignal, refreshPeopleSignal, refreshGovernanceSignal])(tenantId)`. Best-effort per tenant (wrap so one failure doesn't sink the batch).
- [ ] Register in `inngest/index.ts` `functions[]` + it's served by `app/api/inngest/route.ts`.
### 2.2 Fold into the daily brief
- [ ] The `fanOutBrief`/`dailyBrief` cron already fans over tenants at 06:00 — also call the refreshers there so brief + signals compute together.
### 2.3 Durable mirror (fast-follow, JarvisOS dual-write)
- [ ] Migration `domain_signals(tenant_id, domain, payload jsonb, health text, updated_at, unique(tenant_id,domain))` + RLS; upsert alongside the Redis write in `publishSignal`. Survives Redis eviction + RLS-safe reads. *Redis-only is acceptable for launch.*
### 2.4 Verify
- [ ] Trigger the cron manually; confirm `adminos:signal:*:{tenant}` keys populate; Command Center + cockpits read warm signals when opened.

### Part B — Tenant autonomy config (the trust backbone)
### 2.5 Migration — `tenant_autonomy_config`
- [ ] `(id, tenant_id, domain, decision_type, tier char check in ('A','B','C'), updated_at, unique(tenant_id,domain,decision_type))` + RLS via `current_tenant_id()`. No seed needed — **unconfigured defaults to Tier C (surface-only)**, the safe default.
### 2.6 `lib/autonomy/tiers.ts` (port JarvisOS `os/autonomy.ts`)
- [ ] Pure: `resolveTier(rows, domain, decisionType): 'A'|'B'|'C'` (unconfigured → `'C'`); `canAutoAct(t)` (=A), `shouldDraftAndAwait(t)` (=B), `isSurfaceOnly(t)` (=C); `isWithinQuietHours(nowMinutes, {start,end})` handling overnight wrap. Unit-tested.
- [ ] Tiers: **A** = auto-act · **B** = auto-draft + wait for owner · **C** = surface-only (notify, don't act).
### 2.7 Decision-type registry — `lib/autonomy/decisions.ts`
- [ ] Enumerate auto-actionable decisions + sensible default tier: `money/invoice_reminder` (A), `money/final_demand` (C), `ops/low_stock_reorder_alert` (A), `sales/going_cold_nudge` (B), `people/approval_reminder` (A), `governance/deadline_alert` (A). Used to render the settings UI + resolve at runtime.
### 2.8 Gate the recovery engine
- [ ] In `debtRecovery.ts`, replace the hardcoded `AUTO_SEND_MAX_TIER` gate with `resolveTier(tenant, 'money', 'invoice_reminder')`: **A** auto-send (keep `recoveryGuard` text-safety on top), **B** draft + `notifyOwners`, **C** surface-only. This safely *arms* recovery per tenant.
### 2.9 Gate the spine's customer-facing sends
- [ ] `notify()` / `POST /api/money/remind`: for customer-facing proactive actions, check the tenant tier for that `decision_type` (auto-send vs draft-for-owner). Owner-facing alerts always allowed.
### 2.10 Per-tenant AI cost ceiling (JarvisOS #3 — protect launch)
- [ ] In `lib/ai/costControls.ts`: accumulate `ai:spend:day:{tenant}:{YYYY-MM-DD}`; before each Claude call check vs a plan-based ceiling — **fail-closed on ceiling, fail-open on Redis error**. Add a global backstop.
### 2.11 Settings UI — `/dashboard/settings/autonomy`
- [ ] Per-decision toggle (Auto / Draft / Off → A/B/C) writing `tenant_autonomy_config`, grouped by domain; a "quiet hours" control. Register in the nav registry under **Setup**. This is the owner's control surface — the "you stay in control" trust moment.
### 2.12 Verify
- [ ] Unit tests: `resolveTier` (incl. unconfigured→C) + quiet-hours wrap.
- [ ] Integration: tenant Tier A for reminders → debtRecovery auto-sends + notifies; Tier C → only surfaces. Cost ceiling trips at the cap.

**Block 2 acceptance:** signals stay warm without opening pages; the owner can set per-action whether AdminOS acts / drafts / stays silent, and recovery honours it; AI spend can't run away.

---

## Recommended launch sequence (dependencies)
1. **2A signal-refresh cron** — fast, low-risk, independent. *(warm signals everywhere)*
2. **1.1–1.4, 1.6 spine core + owner-facing alerts + bell** — no gating needed for owner-facing. *(the "it's working for me" feeling)*
3. **2.5–2.8 autonomy config + gate recovery** — arms recovery safely. *(trust backbone)*
4. **1.5 + 1.3 customer-facing sends (gated) + Meta template approval** — *(no-shows / collections wins)*
5. **2.10 cost ceiling**, then **2.11 + 1.7 settings UIs**. *(polish + protection)*

Blocks 1 and 2A can run in parallel. 2B must precede step 4.
