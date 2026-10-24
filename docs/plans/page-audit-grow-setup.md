# Page audit: the "Grow and Setup" cluster

Date 2026-10-24. Read-only, code-level audit. Nothing was run; no live DB, no browser, no network, no Paystack/PayFast/hub contact. Everything below is from reading source and `supabase/migrations/*.sql`. Items I could not prove from the repo are marked **UNVERIFIED**. Anything about law or payment-provider rules is from memory and also UNVERIFIED.

Scope: `app/dashboard/{langa,knowledge-base,community,stokvel,integrations}`, `app/dashboard/settings/{autonomy,billing}`, and their API routes (`api/langa`, `api/agents/langa`, `api/kb`, `api/community`, `api/stokvel`, `api/autonomy`, `api/integrations/*`, `api/billing/*`, `api/paystack/webhook`), `lib/ai/agents/langa.ts`, `lib/ai/costControls.ts`, `lib/autonomy/*`, `lib/billing/*`, and the Inngest functions that read autonomy tiers. Note: "KB" is `/dashboard/knowledge-base`; "Autonomy" and "Billing" live under `/dashboard/settings/`.

## Top 5 defects (read these first)

1. **Billing never takes access away, and the live payment path has no amount check and no idempotency.** (a) The only thing that downgrades `tenants.plan` is the immediate self-service downgrade route and the trial cron. `subscription.disable` / `not_renew` only set `subscriptions.status='cancelled'` (`paystack/webhook/route.ts:89-91`); `tenants.plan` is never reverted and nothing reads `current_period_end` to expire it (grep: only written). A tenant who cancels, or whose card fails, keeps Scale/Partner forever. There is no handler for `charge.failed` / `invoice.payment_failed` at all. (b) `charge.success` is applied on the hub secret alone: the amount (`data.amount`, `:76`) is stored but never compared to the plan price, currency is never checked, there is no event/reference dedupe, and no `payment_events` row is written for Paystack (the billing page's Payment History reads that table, so it only shows legacy PayFast rows). Replays are harmless for the plan flag but each one re-extends the period (`:59-60`, `:70-71`). (c) DB errors are swallowed: supabase returns `{error}` rather than throwing, nothing checks it, and the catch returns 200 (`:95-98`), so a paying customer whose upsert fails is never activated and never retried. The PayFast `billing/webhook` swallows the same way (`.then(() => {}, () => {})`, `:89,109,127`).
2. **Langa (the streaming route the page uses) has an input-token budget bypass and unsanitised history.** `api/agents/langa/route.ts:16-19` accepts 20 000 chars x 20 turns, `streamLanga` only pre-checks 1 500 tokens (`lib/ai/agents/langa.ts:249`), and history is passed to the model with no `sanitizeForAI` (`:262-279`; only the latest message is sanitised, `:261`). One request can carry about 100k input tokens against a 50k/day Solo budget; `recordUsage` then books the overshoot after the fact. Client-supplied `assistant` turns also allow prefill-style injection. `recordUsage` runs after the last `controller.enqueue` (`:285-297`); if the client disconnects mid-stream, the enqueue throws, the catch runs, and usage is never recorded.
3. **Stokvel contributions cannot be recorded from the UI, so pool, "Paid" and status are permanently empty.** `StokvelActions.tsx` only calls `POST /api/stokvel` and `?action=add_member`; the `record_contribution` action (`stokvel/[id]/route.ts:71-107`) has no caller anywhere. Every member shows `pending`, pool is R0.00. Behind that: the page checks for an `overdue` status that the DB CHECK forbids (`page.tsx:60,175`; allowed: pending/paid/late/excused), and "current status" is the latest row regardless of period (`:111-117`), so a member who paid in January and nothing since shows "paid".
4. **Community: anonymous posts can be de-anonymised straight from the database, and there is no moderation or reply loop.** RLS policy `community_posts_read` is `FOR SELECT USING (status = 'active')` with no role and no tenant (`20260612_phase7_ubuntu.sql:103`; untouched by `20260814_phase0_followup_legacy_policies.sql:93-94`). If table SELECT is still granted to `anon`/`authenticated` (the 20260816 revoke migration only mentions client writes; **UNVERIFIED** against live grants), anyone with the public anon key can read every post including `tenant_id` of "anonymous" posts, bypassing the API's `tenant_id: null` strip (`api/community/route.ts:46-50`) and ignoring `deleted_at`. In the product, `replies_count` and `helpful_count` have no writer, there is no reply or like action, no report/delete of own post, and a `supplier_review` category (named, possibly defamatory reviews of third parties) has no moderation. Legal exposure is UNVERIFIED.
5. **KB is a write-only notebook: nothing reads it, and the create form silently drops its category.** `grep kb_articles` finds only the KB page, its API and migrations: not Langa, not the WhatsApp bot, not any widget or public route, no Inngest function. `view_count` has no writer. The Create modal sends `category`/`slug` that the schema strips (the comment at `CreateArticleModal.tsx:56-70` admits it), so every article gets `category_id = null` and shows "General"; there is no API to create `kb_categories`. There is no edit, delete or publish toggle in the UI although PATCH/DELETE exist.

Honourable mentions: (6) Autonomy fails open: `getTenantAutonomy` swallows DB errors and returns `[]` (`lib/autonomy/config.ts:6-13`), so a transient error makes every decision fall back to its default, which is `A` (auto-send) for invoice reminders, receipts, booking reminders. (7) `POST /api/billing/plan` downgrades `tenants.plan` immediately (`:88-93`) without touching the Paystack subscription, so the customer is downgraded but keeps being billed the higher price. (8) Special-pricing is half-built: apply and admin-approve exist, but the checkout redirect has no discount path, and no UI links to apply.

## Summary table

| Page | Verdict | Critical / High | Top gap |
|---|---|---|---|
| Langa `/dashboard/langa` | PARTIAL (real chat, thin grounding) | High: history bypass of budget + sanitiser; usage lost on disconnect; "full access to business data" is 5 small facts; no persistence | Ground Langa in real numbers (debtors, cash, payroll, KB) with a per-request token cap |
| Knowledge base `/dashboard/knowledge-base` | THIN | High: no consumer; category dropped; no edit/delete UI | Make KB answer questions (Langa + WhatsApp bot) |
| Community `/dashboard/community` | THIN | Critical (UNVERIFIED grants): anon-readable `tenant_id` on anonymous posts; no replies/likes/moderation | Lock RLS, then replies + report + moderation |
| Stokvel `/dashboard/stokvel` | PARTIAL | Critical for the page's purpose: no record-contribution UI; wrong status logic; mutable ledger | Contribution grid per period + overdue reminders |
| Autonomy `/dashboard/settings/autonomy` | REAL (8/8 wired) with defects | High: fails open on DB error; "Draft" tier promises drafts that do not exist for two decisions | Fail closed + real drafts |
| Integrations `/dashboard/integrations` | THIN (read-only widgets) | Medium: no connect flow exists; weather hard-coded to Johannesburg; nothing consumes the data | Rename or build the real connections (WhatsApp, bank, accounting) |
| Billing `/dashboard/settings/billing` | PARTIAL | Critical: no period/failure enforcement, no amount re-check, no idempotency, errors swallowed; High: downgrade without cancelling | Entitlement lifecycle: renewal, failure, grace, expiry |

## 1. Langa (`/dashboard/langa`)

**Purpose / data**: Streaming AI business mentor. Page is a client component (`page.tsx`) calling `POST /api/agents/langa`, which calls `streamLanga`. A second route `POST/GET /api/langa` (non-streaming, persists to `langa_conversations`) has no client (its own comment, `api/langa/route.ts:41-43`). Gates: layout `view_analytics`; both routes `analytics.read` via `getContext` with a tenant-claim check; rate limit `agents`; `checkBudget` before the call.

**What works end to end**: owner/manager opens the page, picks a starter prompt or types, SSE tokens render as markdown with links forced to `rel=noopener`; budget-exceeded returns a plain 429 JSON that the UI displays; prompt caching on the system prompt; plan-based model routing via `getModelForFeature`; model ids live in `costControls`.

**Defects**
- High (cost bypass): history limit described in Top 5 #2. File `app/api/agents/langa/route.ts:16-19`; `lib/ai/agents/langa.ts:249,262-279`. Failure scenario: a manager (or a script with their cookie) posts 20 turns of 20 000 chars; one call burns roughly 100k input tokens on a 50k/day plan before the meter notices; the 'agents' rate limiter bounds frequency but not size. Fix: sum history chars, cap total tokens per request, and `checkBudget` with the real estimate.
- High (prompt injection): client-supplied history is trusted (roles and content). `sanitizeForAI` is a regex blacklist (`lib/security/sanitize.ts`) and does not stop paraphrased injection; it also mangles legitimate text ("act as an accountant" becomes `[filtered]`). Mitigation is limited because Langa has no tools and no writes, so the blast radius is wrong advice and token spend, not data exfiltration. `tenant.name` and goal titles go into the system prompt unsanitised (`langa.ts:96,121,131`); `sanitizeSystemPromptValue` exists and is not used here.
- Medium (silent failure / usage): usage not recorded on client abort (Top 5 #2). `recordUsage` also runs after `controller.close()`, so a Redis error there is only `void`-swallowed.
- Medium (grounding is thin, copy over-claims): the prompt says Langa has "full access to the tenant's real business data" and "ground ALL advice in their real business data". The context (`buildLangaContext`, `langa.ts:38-107`) is: tenant name, `settings.business_type`, plan, latest health score, counts of overdue/paid invoices from the last 7 days (max 20 rows), up to 5 active goal titles, and a lessons-completed count. No amounts, debtors, cash, payroll, stock, KB. The API comments (`api/agents/langa/route.ts:41-43`) say it reads "financials, debtors and payroll"; it does not. `settings.business_type` is likely always empty (memory says `business_type` is a `tenants` column; **UNVERIFIED** which one holds the value), so businessType is probably always `general`.
- Medium: web conversation is not persisted at all. Reload loses it. `/api/langa` persists but is unused and overlaps in role (an unused duplicate agent route is a drift risk). `api/langa/route.ts:49` returns the raw zod error object in a 400 (`detail: e`); the GET swallows any DB error into `[]` (`:135-138`).
- Low: `body.history` stored without sanitising (`api/langa/route.ts:97`); `upsert(...).select()` result ignored so a failed save is silent.
- Low: page header says "Online" statically; no way to start a new conversation; no stop button; no copy button; starter prompt "How do I handle a disciplinary hearing fairly?" invites specific legal advice that the prompt says to avoid (policy tension, no disclaimer beyond the footer).
- Low (language): `settings.preferred_language` read from `tenants.settings`; no UI found that writes it (not searched exhaustively).

**Missing loops**: Langa cannot act (no create task/draft invoice/follow-up); no link from an answer to the page it concerns; no KB retrieval; no thumbs up/down; the 15-turn "mentor" has no memory across sessions.

**Highest-value gap**: ground it. Feed top debtors with amounts (from `lib/money` signal), cash position, payroll due date, overdue compliance, plus KB articles, behind one capped context builder, and fix the input-size cap at the same time.

## 2. Knowledge base (`/dashboard/knowledge-base`)

**Purpose / data**: `kb_articles` (title, content, tags, `published`, `view_count`, `helpful_count`, `category_id`), `kb_categories`. Page is a server component (`getContext`, read for everyone, write button for `kb.write`); API `guard('kb.read'|'kb.write')`; search RPC `search_kb_articles` (SECURITY DEFINER, restored with `deleted_at IS NULL`, execute revoked from anon, `20261006_revoke_public_definer_rpcs.sql:15-32`).

**What works end to end**: staff create a (draft or published) article; list shows title, category, status, views, date, client-side search over content, CSV export, read modal; soft delete (`kb/[id]/route.ts:88`); audit log on create/update/delete; tenant scoping on every read/write; RLS re-keyed to `current_tenant_id()`.

**Defects**
- High: nothing consumes the KB (grep: `lib`, `inngest`, `app` outside the KB page/API, `components`). No public help-centre route, no widget (migration comment `20260612_phase10_helpers.sql:67-70` mentions a "Phase 11 public widget"; **UNVERIFIED** whether `app/api/widget` or `app/widget` reads it: a grep of `kb_articles` in `app` finds only the KB files, so no). `published` therefore has no meaning, `view_count` has no writer and the "Total Views" tile is always 0.
- High: category lost. `CreateArticleModal.tsx:73-82` sends `category` + `slug`; `createSchema` (`api/kb/route.ts:9-15`) has `categoryId` (uuid) only, and zod strips unknown keys without error. Result: all articles `category_id = null`, "General", category filter never populates.
- Medium: PATCH/DELETE exist but the UI has no Edit, Delete or Publish/Unpublish control (`KnowledgeBaseTable.tsx`). An article can never be corrected from the product.
- Medium: PATCH does not exclude soft-deleted rows (`kb/[id]/route.ts:62-68` has no `.is('deleted_at', null)`), so a deleted article can be edited (not resurrected, but updated). Also `.single()` on zero rows returns a DB error through `dbError` rather than a clean 404.
- Medium: `sanitizeForAI` is applied to the stored content (`api/kb/route.ts:90-91`, PATCH `:56-57`). That permanently rewrites staff-authored text (`act as`, `you must now` become `[filtered]`) in documents meant for humans, and is not a defence anyway (the right place is at retrieval/prompt time). Data corruption of legitimate SOP wording is plausible.
- Medium: search fallback uses `ilike('%q%')` with unescaped `%`/`_` (`kb/route.ts:46`), title only; the page ignores the API search and filters client-side over all rows with no pagination (`page.tsx:20-24`, no `.range`, no `allRows`; the 1000-row cap applies).
- Low: `tags` accepted but the modal always sends `[]` and the table never shows tags; `content` is rendered in a `whitespace-pre-wrap` div (no HTML, safe from XSS); `limit` NaN if `?limit=abc` (`parseInt` not guarded, `kb/route.ts:30`).
- Low: `helpful_count` has no writer or UI.

**Missing loops**: KB to Langa/bot answers; staff onboarding to "read these articles" tasks (the handbook in the Team cluster does acknowledgement; KB does not); category management; version history (POPIA and policy content changes are unaudited beyond the "updated" row).

**Highest-value gap**: make the KB a retrieval source. Wire `search_kb_articles` into Langa and the WhatsApp auto-reply, count a view when it is used, and offer "answered from KB" back-links; without a reader, articles are dead weight. Fix the category plumbing first (small).

## 3. Community (`/dashboard/community`)

**Purpose / data**: `community_posts` (category enum, title, body, anonymous, sector, province, counters, status). Page is a client component under a `view_analytics` layout gate; API `guard('analytics.read')`.

**Is it cross-tenant on purpose? Yes, and the design intent is sound, but the implementation is leaky.** Intent: a peer network across all AdminOS businesses (matches the "Ubuntu" phase 7 comment and `community_posts_read` using no tenant filter). The route reads `community_posts` with `supabaseAdmin`, no `tenant_id` filter, `status='active'` only (`route.ts:32-37`), which is consistent with the intent. Problems:
- The API strips `tenant_id` only for anonymous posts, and for non-anonymous posts returns the raw UUID (`:46-50`) while the UI never shows a business name. So non-anonymous posts have no usable attribution (nobody knows who posted), and the raw tenant UUID is leaked to every tenant. The UUID alone is low harm, but it is a cross-tenant identifier you do not need to ship.
- The direct-DB path in Top 5 #4: RLS `SELECT USING (status='active')` allows reading `tenant_id` of anonymous posts to anyone holding the anon key unless table grants were revoked. This voids "post anonymously". UNVERIFIED against live grants; check `has_table_privilege('anon','community_posts','SELECT')`.
- Anonymous posts still carry `sector` and `province` (not collected by the UI, but allowed by the API), which with small cohorts can identify an author.
- `deleted_at` was added by the soft-delete migration (`20261005_soft_delete_columns.sql:23`) and the API filters it, but there is no way to set it from the product, and no policy/RLS awareness of it.

**What works end to end**: post a message (title, body, category, anonymous toggle), list latest 30, filter by category tab (client-side), plain-text rendering (React escapes; no XSS), audit log on post.

**Defects**
- High: no reply, helpful, report, edit or delete. `replies_count` and `helpful_count` are stored-but-never-written counters (shown as "0 helpful / 0 replies" forever). A post cannot be removed by its author or by an operator from the product.
- High: no moderation. Free text from any paying owner is shown to all tenants. `supplier_review` posts name suppliers; no report button, no flagged state, no admin tool (`status` only ever `active`). Defamation/POPIA exposure (naming individuals) is UNVERIFIED but plausible.
- Medium: no rate limit and no length-based spam control on POST (`guard` only). Gate is `analytics.read`, so only owners/managers can post or read, which is a deliberate narrowing, but a staff member cannot see the network at all.
- Medium: `sanitizeForAI` mangles legitimate post text (same issue as KB).
- Medium: pagination is offset-based and the UI never pages (`/api/community?limit=30`, no "load more"), so older posts are unreachable; category filter is client-side on the 30 fetched rows, so a filter with no match among the latest 30 shows "No ... posts yet" although older ones exist (`page.tsx:64,99`).
- Low: `parseInt(offset)` unguarded NaN; `timeAgo` uses client time (fine); the compose form's `sector`/`province` fields are accepted by the API but not offered in the UI; failed fetch silently leaves an empty feed (no error state, `page.tsx:65-67`).

**Missing loops**: replies and notification of the poster; "Can help" matched to "Need help" by sector/province; link to mentorship (phase 7 mentorship tables exist, not audited here).

**Highest-value gap**: first, verify and close the direct-read hole (a migration that revokes anon SELECT and removes `tenant_id` from any client-visible view); then add replies + report + operator hide so the page can safely stay cross-tenant.

## 4. Stokvel (`/dashboard/stokvel`)

**Purpose / data**: `stokvel_groups`, `stokvel_members` (phone NOT NULL), `stokvel_contributions` (no `tenant_id`, unique per group+member+month+year). Page gate `view_financials`; API `withRoute` with `money.read` / `money.write`, audited, tenant-scoped; the contribution path verifies the member belongs to this group and tenant (`[id]/route.ts:78-86`).

**What works end to end**: create a group (name, amount, frequency, payout order, start date, rules); add members with a phone; list groups and members; tenant isolation is correct on every route and RLS is tenant-keyed (`20260814_phase0_followup_legacy_policies.sql:72-84`).

**Defects**
- Critical to purpose: no UI to record a contribution (Top 5 #3). The API is there; `StokvelActions.tsx` has no form for it. So "Combined Pool" and per-member status can never leave zero/pending.
- High (wrong derived value): status model mismatch. DB allows `pending/paid/late/excused`; the page maps `overdue` to red and counts `overdue` (`page.tsx:60,175`), a value that can never exist; `late` renders gray. "Latest contribution per member" ignores which period it is, so a stale payment reads as current (`:111-117`). There is no "expected this period" concept, so nobody can ever be "behind".
- High (ledger integrity): contributions are upserted by (group, member, month, year), overwriting status, amount and `paid_at` in place (`[id]/route.ts:88-100`); the old value is only visible in the audit log (only status/amount are logged, `:105`). A paid row can be silently flipped to `pending`, `paid_at` becomes null, and the amount is free (not tied to the group's `contribution_amount`; no partial-payment model). For a pot of members' money this is a mutable ledger with no reversal entry. Group money-handling rules (e.g. any registration/FSCA position for stokvels, NASASA code) are UNVERIFIED and not assessed.
- Medium: pool counts contributions of soft-deleted members (`page.tsx:102-107` selects by group only; members list filters `deleted_at`, contributions do not). There is no member removal route anyway; `stokvel_members.deleted_at` has no writer in the product.
- Medium: the group `status` (active/paused/closed), payout order, start date and rules have no edit; there is no payout recording or rotation tracker (`payout_order`, `payout_position` are stored; nothing uses them), so the central stokvel loop (who gets paid when) does not exist.
- Medium: `startDate` is only a date string (fine) but `frequency` is never used to compute due dates; there is no contribution reminder to members (grep: no stokvel code in `inngest/` or `lib/` apart from `impactSnapshot.ts` and `lib/academy/checkAchievements.ts`). `frequencyLabel` maps `biweekly` but the DB value is `fortnightly` (displays the raw word, `page.tsx:67-70`).
- Medium (POPIA): members are third parties; names and phone numbers are stored with no consent record and no way to delete a member.
- Low: `contributionStatusColor` default gray; amounts use `toLocaleString('en-ZA')` fine; the page uses `view_financials` and the API `money.*`, mapping equivalence UNVERIFIED; `fireBusinessEvent` calls are unawaited with errors unobserved.

**Missing loops**: period grid (members x months) with one-click "mark paid", overdue calculation from `frequency` + `start_date`, WhatsApp reminder via `sendAsTenant`, payout schedule and payout recording, member statement/receipt, group closing.

**Highest-value gap**: a per-period contribution grid driven by `frequency/start_date` that (a) records payments append-only, (b) derives "behind" correctly, and (c) feeds a reminder.

## 5. Autonomy (`/dashboard/settings/autonomy`)

**Purpose / data**: `tenant_autonomy_config` (tenant, domain, decision_type, tier A/B/C, unique per tenant+decision); a fixed 8-item catalogue in `lib/autonomy/tiers.ts`. Page gate `manage_settings`; API `withRoute` `settings.read/write`, validates the decision against the catalogue, audits `autonomy.tier_changed`, and refuses `money/final_demand` = `A` (`route.ts:38-41`). The page also hosts notification preferences and quiet hours (`/api/settings/notifications`).

**Do the toggles change behaviour? Yes, all eight.** Verified call sites that read the tier:
- `money/invoice_reminder`: `inngest/functions/debtRecovery.ts:91-111` (non-A is held and the owner is notified; a manual "Send reminders" click bypasses it by design).
- `money/final_demand`: `debtRecovery.ts:133-135` (only controls whether an AI draft is prepared for the owner; auto-send never occurs).
- `money/payment_receipt`: `lib/invoices/onPaid.ts:47-48` (A sends the thank-you; non-A skips).
- `ops/booking_reminder`: `inngest/functions/bookingReminder.ts:115-133` (non-A is surfaced to the owner).
- `sales/going_cold_nudge`: `salesColdLeads.ts:57-73` (C surfaces only, B drafts).
- `ops/low_stock_reorder_alert`, `people/approval_reminder`, `governance/deadline_alert`: `opsAlerts.ts:50-60`, `peopleApprovals.ts:54-66`, `governanceDeadlines.ts:50-61` (C turns off the WhatsApp mirror, still in-app).

**Defects**
- High (fail-open): `getTenantAutonomy` (`lib/autonomy/config.ts:6-13`) never inspects the supabase `{error}` and returns `[]` on any failure, so the code falls to `DECISION_DEFAULTS`, which is `A` for six decisions. An owner who set "Off/Draft" for customer-facing messages can have WhatsApp sent to customers during a DB hiccup or an RLS/auth error. For anything customer-facing, an error must resolve to `C`.
- High (promise not kept): the UI label for tier B says "Prepared, you send". For `money/invoice_reminder` a held reminder only sets `recovery_status='awaiting_owner_review'` and notifies; no reminder draft is produced for tier B (the `finalDemandDraft` step is skipped when `heldByAutonomy`, `debtRecovery.ts:139`). For `ops/booking_reminder` tier B the notification says "Reminder drafted" (`bookingReminder.ts:125`) but no draft text is stored or shown. For `money/payment_receipt` B and C behave identically (skip). The three-way control is two-way in practice for those items.
- Medium: UI offers "Auto" on Final demands and relies on a server 400 plus a UI revert (`AutonomyControls.tsx:43-46`); the card should disable that option. A guard at the write path exists but the read side has none: a row inserted by any other writer (service role, SQL) with `A` for `final_demand` is honoured only to the extent that the code never auto-sends (it does not), so low risk.
- Medium: defaults of `A` are applied to a brand-new tenant without an explicit opt-in. The page text says "AdminOS handles what you allow - and only what you allow", but until the owner touches the page, reminders, receipts and booking reminders go out automatically to customers. That is a deliberate "preserve today's behaviour" choice (`tiers.ts:22-26`) that contradicts the copy. POPIA/direct-marketing position of unsolicited customer messages is UNVERIFIED.
- Medium: the effective tier is re-read per run with no cache and no visibility: there is no "what did AdminOS do on its own this week" log on this page (the audit rows exist for debt recovery; others only log through notifications).
- Low: quiet hours are stored under `settings.quiet_hours` and applied in `lib/notifications/delivery.ts` (**UNVERIFIED** whether customer-facing sends, not just owner alerts, honour them); the catalogue is hard-coded in TS (adding a decision needs a deploy; fine).
- Low: the page reads the table directly with `supabaseAdmin` rather than the API; two copies of the "effective tier" merge logic (page and `GET /api/autonomy`).

**Missing loops**: weekly "AdminOS did X on its own" digest per tier; undo/hold window for tier A sends; per-contact exclusions (e.g. "never auto-message this customer"); autonomy for Langa or payroll is deliberately absent.

**Highest-value gap**: fail closed on read errors, then make tier B produce a real stored draft that the owner can send in one tap from the invoice/booking, so B is not a synonym for C.

## 6. Integrations (`/dashboard/integrations`)

**Purpose / data**: a server page (gate `manage_settings`, 5-minute revalidate) that renders four widgets: load-shedding stage (Eskom endpoint), weather (Open-Meteo, hard-coded `johannesburg`), FX rates (open.er-api.com), and a phone-number validator. API routes under `api/integrations/*` use `withRoute` `profile.own` (any signed-in member), zod-validated query params (good: the `base` currency and `city` are regex-constrained).

**Is there a connect flow? No.** There is no OAuth, no API key, no store, no table, no webhook registration anywhere on this page. Nothing here "connects". WhatsApp (360dialog / Meta), social, email inbound and bank import live elsewhere (`api/webhook/*`, `api/bank`, `api/social`) and are not surfaced on this page. The title "Integrations" and subtitle "Live data feeds" are accurate; a user expecting to connect Xero, Sage or a bank will find none.

**What works end to end**: all four widgets render with graceful fallback (`Status Unavailable` for load shedding; FX shows a dash if a rate is missing); the phone validator POST works and yields E.164 for WhatsApp.

**Defects**
- Medium: nothing consumes the feeds. Grep: `lib/integrations/{loadshedding,weather,fx-rates}` are imported only by this page and their own API routes. Load-shedding stage does not feed shift planning, notifications, the daily brief or invoice scheduling; FX does not feed any invoice in a foreign currency. A dashboard of facts with no downstream behaviour.
- Medium: the load-shedding source is `loadshedding.eskom.co.za/LoadShedding/GetStatus` parsed as an integer string (`lib/integrations/loadshedding.ts:15-24`). If the endpoint returns HTML, an error page with HTTP 200, or a Cloudflare challenge, `parseInt` gives `NaN` and the code reports stage 0 "No Load Shedding" with a green tick and source `eskom`, which is a false "all clear". Only the thrown path shows "Status Unavailable". It also ignores `res.ok`. Endpoint reliability from a datacentre IP is UNVERIFIED.
- Medium: weather is hard-coded to Johannesburg for every tenant (`page.tsx:22`), although the tenant's province/city is known elsewhere. A business in East London sees Joburg weather.
- Low: `profile.own` on the data routes means any member (not just settings admins) can call them; harmless but the page itself requires `manage_settings`, so staff are blocked from a read-only feed with no sensitive data.
- Low: free upstream quota (the FX comment says 1 500 calls/month): the page is cached 5 minutes server-side so quota use is bounded for the page, but the API route is open to any signed-in member (rate limiting only via `withRoute`; **UNVERIFIED** if `withRoute` rate-limits `profile.own`).
- Low: copy lists "5 min cache" / "10 min cache" statically; actual revalidate for weather/FX is inside their lib (not checked).

**Missing loops**: a real Connections section (WhatsApp number status, bank feed status, email inbound, accounting export) showing connected / needs attention, with the reconnect action; FX conversion on invoices; load-shedding stage into staff shift reminders and the 06:00 daily brief.

**Highest-value gap**: decide what the page is. Either rename it "Live data" and wire load shedding into the daily brief and shift alerts, or turn it into the Connections hub (WhatsApp Tech Provider flow per the plan in memory is the first real connector). As built it implies connections it does not have.

## 7. Billing (`/dashboard/settings/billing`)

**Purpose / data**: `tenants.plan`, `subscriptions` (plan, status, period fields, `addon_<slug>` booleans + `_expires_at`), `payment_events`, `plan_catalogue`, `addon_catalogue`, `plan_changes`, `special_pricing_applications`. Page gate `manage_billing`; write routes all check `manage_billing`. Live payment path is **Paystack through the Mirembe hub at `jarvis.mirembemuse.co.za`**: checkout redirects there (`checkout/route.ts:76-112`), the hub forwards verified events to `POST /api/paystack/webhook` authenticated with `x-hub-secret`. PayFast code (`billing/webhook`, `billing/payfast-itn`, the checkout form) is the legacy/fallback.

**What works end to end**: view plan and catalogue prices from the DB; Start/Switch plan and Add-on buttons redirect to the hub checkout with `ref=<tenant_id>`; after payment the hub forwards `charge.success` and the webhook sets `tenants.plan` (so gates and the UI agree); cancel plan / cancel add-on call the hub with session-derived email (never client-supplied); upgrade via `POST /api/billing/plan` no longer flips the plan without payment (good, see the comment `:70-79`); add-on entitlement is derived at read time from `subscriptions.addon_*` + `_expires_at` + plan bundle (`lib/billing/addonLogic.ts`, `addons.ts`), so add-on expiry is enforced on read.

**Defects**
- Critical: no access lifecycle (Top 5 #1a). `tenants.plan` is set once on `charge.success` and thereafter never reduced by any cron, failed charge, or the cancel route. File: `app/api/paystack/webhook/route.ts:68-93`; `inngest/functions/trialExpiry.ts` only touches `trialing` rows. Failure scenario: customer on Partner (R9 999) cancels; Paystack stops billing; AdminOS keeps `plan=partner` and `status=cancelled` indefinitely, with Partner AI budget (2M tokens/day) and gates open. Revenue leakage and a cost exposure.
- Critical: no amount/currency re-check, no idempotency, no payment record for the live path (Top 5 #1b). `meta.tier` and `meta.ref` come from the hub's checkout query; the AdminOS side treats the hub secret as proof of everything. Suggested checks: `data.currency === 'ZAR'`, `data.amount/100 >= plan_catalogue.price_monthly` (or the discounted price), `data.reference` unique (add a UNIQUE index on `payment_events(reference)`), record every event.
- High: tenant impersonation at the hub boundary (**UNVERIFIED**, the hub is in the JarvisOS repo and was not read). `ref` is a plain tenant UUID in a query string built here and passed through a redirect the user can edit; if the hub does not bind `ref` to an authenticated AdminOS session, anyone knowing a tenant UUID can pay for the cheapest plan with `ref=<victim>` and have `tenants.plan` set to Solo (downgrading the victim) because the webhook sets plan from `meta.tier` unconditionally and never compares rank.
- High: payment webhook error handling (Top 5 #1c): `paystack/webhook/route.ts:61-66,72-79` ignore `{error}`; the outer catch returns 200 (`:95-98`), and the legacy PayFast handler `billing/webhook/route.ts:79-89,99-127` swallows with `.then(() => {}, () => {})`. Paid-but-not-activated cases are invisible and never retried (provider sees 200). (`billing/payfast-itn/route.ts` does return 500 on DB error, which is the right pattern, so it is the better of the two PayFast handlers and the only one that retries.)
- High: legacy PayFast handlers have no amount, merchant-id or currency check, no PayFast server-side validation postback, no idempotency (`payment_events` has only non-unique indexes, `20260505_sprint_v3.sql:222-224`), and trust any `custom_str2` plan string signed or hub-forwarded (`billing/webhook/route.ts:111-115` writes `plan` straight into `tenants.plan`; no enum check). `billing/webhook` skips signature and IP entirely for requests carrying `x-hub-secret` (`:52-67`). Both also compute the signature with `encodeURIComponent`, which differs from PHP `urlencode` for `! ' ( ) *` (the checkout file has the correct `phpUrlencode`), so legit ITNs with such characters in item names would be rejected. They also depend on `x-forwarded-for` and a Google DNS lookup for the PayFast IP allow-list; behind Cloudflare the client-IP header changes, so this must be revisited at the Cloudflare cutover. All of this is dead code while Paystack is the live path; either delete it (quarantine per repo rules) or harden it, because it is still routable.
- High: downgrade without cancel (Top 5 #8 second item): `api/billing/plan/route.ts:88-93` sets `tenants.plan` and never calls the hub to change/disable the Paystack subscription, and the UI's "Switch plan" link goes to checkout, which creates a new subscription (double billing risk: switching Grow to Operate via the page does not cancel the Grow subscription; nothing in the code reconciles two active Paystack subscriptions for one email). **UNVERIFIED** how the hub handles an existing subscription.
- Medium: period maths: `periodEnd.setMonth(+1)` overflows at month end (31 Jan becomes 3 Mar) and is computed from "now" on each event instead of from the paid-through date (`paystack/webhook:59-60,70-71`, PayFast handlers likewise). Renewals arriving early shorten rather than extend the period; replayed events extend it.
- Medium: cancellation semantics disagree: plan cancel says access continues until period end, but the add-on cancel route flips `addon_<slug>` to false immediately (`addons/cancel/route.ts:61-65`) and the `subscription.disable` handler does the same (`webhook:84-86`), so a customer loses a paid-for month of the add-on.
- Medium: Payment History is empty for all Paystack payments (no `payment_events` writes in `paystack/webhook`), and shows "Pending" for rows with `processed=false` (the ITN handler inserts without `processed`). Customers have no receipt/invoice for their subscription in-app (VAT invoice duties for a VAT-registered vendor are UNVERIFIED).
- Medium: UI copy "Annual billing saves 2 months" (`page.tsx:225`) has no mechanism: no annual option in checkout or the hub call; `billingCycle: 'annual'` is accepted by `plan/route.ts:14` and ignored. "Secured by Paystack" fine.
- Medium: special pricing is orphaned: `/api/billing/special-pricing` (apply) and `/api/admin/special-pricing` (approve, stores `discount_pct`) exist, no UI on the billing page links to them (grep), the checkout redirect never applies a discount, and the approval text says "tenant will see on next invoice" (`admin/special-pricing/route.ts:83`) though no invoice engine consumes it. Discount rates and eligibility claims are hard-coded; the discount is unverifiable and a manual process today.
- Medium: plan/price drift. The billing page shows `plan_catalogue.price_monthly` from the DB; what is charged is the amount on the Paystack plan (hub env). Nothing checks they match. The dead PayFast block carries a third hard-coded price table (`checkout/route.ts:7-24`).
- Low: plan switch/purchase is a plain `GET` link (`page.tsx:214,282`) that redirects to a payment flow; any link or image on another page could trigger the redirect (low severity: the user still has to pay), but state-changing GETs for a purchase start are poor practice.
- Low: trial maths uses `Date.now()`-based `daysRemaining` with SAST date display (fine). `tenant.created_at + 14 days` fallback hard-coded.
- Low: `plan_changes.insert` result ignored (`plan/route.ts:70`); `detail: e` leaks the zod error object (`:48`).

**Missing loops**: failed-payment dunning and grace period; automatic downgrade at period end after cancel; "payment received" email/WhatsApp receipt; seat/usage meter versus plan limits (`max_staff`, `max_conversations_monthly` shown in cards; `lib/billing/usage.ts` exists; enforcement not audited here); pro-rata on plan change; annual plan.

**Highest-value gap**: an entitlement ledger driven by verified events: record every Paystack event (UNIQUE on reference), re-check amount/currency, derive "paid through" per tenant, and a nightly job that downgrades to the free/lapsed state when `paid_through` plus grace has passed or on `subscription.disable` with period elapsed. This closes Top 5 #1 and the leakage in one design.

## Cross-page loops (what is stored but not closed)

| Stored value | Writer | Reader | Gap |
|---|---|---|---|
| `kb_articles.view_count`, `helpful_count` | none | KB tile | Dead counters; no consumer of the KB at all |
| `community_posts.replies_count`, `helpful_count` | none | Community feed | Dead counters; no reply/like action |
| `stokvel_contributions.*` | API only (no UI) | Stokvel page | Page always shows zero pool |
| `tenants.plan` (downgrade) | Webhook (up), plan route (down) | All gates and the AI budget | No expiry/failure/cancel path reverts it |
| `subscriptions.current_period_end` | Webhooks | nothing | Written, never read |
| `payment_events` | Legacy PayFast only | Billing history | Live Paystack path writes nothing |
| `special_pricing_applications.discount_pct` | Admin approve | `tenant/me` echo | Never applied to a charge |
| `langa_conversations` | `/api/langa` (no client) | `/api/langa` GET (no client) | Web Langa persists nothing |
| `tenant_autonomy_config` | Autonomy page | 8 Inngest/lib call sites | Works; fails open on read error; tier B drafts missing for 2 items |
| Load-shedding, weather, FX | Fetched live | Integrations page | Feeds no behaviour |

Other cross-page observations:
- Langa, KB, Community and Billing all depend on the same `sanitizeForAI` regex as a security control. It is not a boundary; it corrupts staff-authored text (KB, Community) and is skipped on history (Langa). Move the defence to prompt construction (delimiting untrusted text, no tool access) and stop mutating stored content.
- Cost control: Langa's streaming route, Autonomy-governed drafts and KB-to-Langa grounding (once built) must share one per-request token cap so the daily budget is a real limit; today only the Redis counter on completion protects it, and `checkBudget` fails open on Redis errors (`costControls.ts:233-238`, deliberate).
- Billing, Autonomy and Langa share the plan dimension: Langa budget uses `tenants.plan` (via `tenantAI`), which is exactly why unreverted plans on cancelled tenants (Top 5 #1) are a direct AI cost leak.
- Dates: the audited pages mostly use SAST formatting (`timeZone: 'Africa/Johannesburg'`); non-SAST or fragile spots: `periodEnd.setMonth` in UTC server time (billing), `timeAgo` (client clock), Langa `sevenDaysAgo` rolling window (acceptable). No hard deletes found in these pages' code: KB, stokvel and community use `deleted_at` columns (community and stokvel have no delete route at all).

## Ranked fix-and-build list

Fixes (small, do first):
1. Paystack webhook: check `{error}` on every write and return 5xx on failure so the hub retries; add `payment_events` insert with a UNIQUE reference; verify `currency` and `amount` against `plan_catalogue`/`addon_catalogue`; guard `plan` rank so a lower-tier event cannot silently downgrade (S/M).
2. Langa: cap total history size, `checkBudget` with a real estimate, sanitise or strictly delimit history, stop trusting client `assistant` turns, record usage in a `finally`/on cancel (S).
3. `getTenantAutonomy`: return a sentinel on error and have customer-facing call sites treat it as `C` (S).
4. Community RLS: verify live grants; if open, add a migration revoking anon/authenticated SELECT on `community_posts` (service role is used by the API), then drop `tenant_id` from non-anonymous responses (S, needs your approval to apply to prod).
5. KB: send `categoryId` from a real category list (or drop the field), add Edit/Delete/Publish to the table, add `.is('deleted_at', null)` to PATCH, stop sanitising stored content (M).
6. Stokvel: statuses (`late`, not `overdue`), period-aware current status, exclude soft-deleted members' contributions (S).
7. Cancelling a plan: on `subscription.disable` set an `access_until` from the paid-through date and downgrade after it; fix the immediate add-on cutoff (M, part of build 1).
8. Delete or harden the two legacy PayFast handlers; remove the duplicate `api/langa` non-streaming route or merge persistence into the streaming one (S).

Builds (larger, value order):
1. **Entitlement ledger and dunning** (Billing): paid-through per tenant, grace, nightly expiry, failed-payment notifications, payment history from verified events, receipts (L).
2. **Grounded Langa**: debtors with amounts, cash position, payroll date, compliance deadlines, KB retrieval, persisted conversations (M/L).
3. **Stokvel contribution grid and reminders**: UI, expected-period logic, append-only ledger, payout tracker (M/L).
4. **KB as retrieval source**: public help centre or WhatsApp auto-answer using `search_kb_articles`, with view counting (M).
5. **Community replies, report and operator hide** (M).
6. **Autonomy tier B drafts** stored and sendable in one tap, plus an "AdminOS did this on its own" weekly digest (M).
7. **Connections hub** replacing or beside the Integrations widgets (WhatsApp status, bank, email inbound); wire load shedding into the daily brief and shifts (M).
8. **Special pricing end to end**: apply UI, discount applied through a coupon/plan on the hub, expiry (M).

## What was not verified

- Code-level only. Nothing ran: no live DB, so live RLS policies, table grants (especially `community_posts`), triggers and column defaults are as per migrations, not confirmed. The `current_tenant_id()` swap is taken from the follow-up migration.
- The Mirembe hub (`jarvis.mirembemuse.co.za`, JarvisOS repo) was not read: how it signs/binds `ref`, how it handles an existing subscription on plan switch, whether it dedupes events, what it forwards on `charge.failed`, and how Paystack plan amounts relate to `plan_catalogue`. Paystack and PayFast behaviour is from memory.
- `withRoute` internals (rate limits, error shapes), `guard()` action-to-permission mapping (`kb.read`, `analytics.read`, `billing.manage`), `lib/auth/roleMatrix.ts` role tables, `lib/notifications/delivery.ts`, `lib/billing/addonLogic.ts` internals and `lib/billing/usage.ts` limit enforcement were not read line by line.
- Mobile (Expo) consumers of these APIs, the operator console (`/operator/billing`, `admin/billing-catalogue`) and WhatsApp bot code paths were not audited, so "nothing reads the KB" is based on grep of `app/`, `lib/`, `inngest/`, `components/` for `kb_articles`; `expo-app/` and `supabase/functions` were not searched.
- Legal and compliance statements (POPIA for community/stokvel member data, unsolicited customer messaging, defamation in supplier reviews, stokvel regulation, VAT invoicing for subscriptions, Debt Collectors Act position on final demands) are from memory and UNVERIFIED; take them to a professional before relying on them.
- No typecheck, test or build was run (the laptop rule bans them); nothing in the repo was edited.
