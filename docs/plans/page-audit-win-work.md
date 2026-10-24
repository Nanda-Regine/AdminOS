# Page audit: Win Work cluster (Sales, Inbox, Contacts, Reach, Ring, Sequences, Email Studio)

Audited 2026-10-24, read-only, by reading code. Nothing was run, built or queried against the live database. Schema checked against `supabase/migrations/*.sql`; where the base tables only exist in `supabase/schema.sql` / `master_schema.sql` (contacts, conversations, messages) that is noted. Anything I could not prove from the repo is marked UNVERIFIED.

Reading guide: "works today" means works in-app with no WhatsApp and no email. WhatsApp sending is not live (Meta verification pending) and email delivery is down (Resend key revoked).

## Summary table

| Page | Verdict | Critical bugs | Top gap |
|---|---|---|---|
| Sales (`/dashboard/sales`) | PARTIAL (read-only dashboard, numbers partly wrong) | Pipeline value includes drafts/cancelled/in_collections; "Going cold" depends on a column nothing writes; lifetime revenue depends on contact totals nothing maintains | One-tap "win back" on each cold contact with rand value and reason (draft + enrol, no navigation) |
| Inbox (`/dashboard/inbox`) | PARTIAL (real, but WhatsApp-dependent for sending) | None Critical; High: reply does not store WhatsApp message id; `?conv=` deep link ignored; email-channel replies dead-end | "Reply for me" with reason shown and rand value of the open invoice/lead attached |
| Contacts (`/dashboard/contacts`, `[id]`) | PARTIAL | Money columns (balance_owed, total_paid, total_invoiced) have no writer in the repo; list silently caps at 1000 rows; detail page misses invoices linked by contact_id | Explainable money: click balance to see the invoices behind it |
| Reach (`/dashboard/reach`, `/new`) | PARTIAL (consent layer is solid; sending unproven) | Campaign can stick in `sending` forever; no cancel/edit/delete; free-form text broadcasts will fail outside the 24h window once live | Cost and expected-return line in rands before "Confirm send" |
| Ring (`/dashboard/ring`) | THIN (read-only call log) | Unknown Twilio statuses display as "Completed"; follow-up WhatsApp can double-send on Twilio retry | Missed call -> one-tap callback task / WhatsApp with reason |
| Sequences (`/dashboard/sequences`, `/new`) | PARTIAL | Hourly cron cancels every enrolment when tenant has no WhatsApp number; `{{name}}` never personalised; default contact_type 'client' makes everyone marketable | Edit steps / dry-run preview ("shadow mode") of who would get what |
| Email Studio (`/dashboard/email-studio`) | PARTIAL (drafting works; delivery down) | Edits in the textarea are never saved or sent; the sent email repeats the "Subject:" line in the body; drafts list shows no body | Send via the contact's invoice context: draft with real invoice figures |

---

## 1. Sales cockpit

Files: `app/dashboard/sales/page.tsx`, `lib/sales/signal.ts`, `inngest/functions/salesColdLeads.ts`.

### Purpose and data
- Server component, gated by `view_analytics` (page.tsx:24). Calls `buildSalesIntel(tenantId)` (signal.ts:24) which reads `conversations` (open only), `contacts` (top 2000 by `total_paid`), `invoices` (everything not paid).
- Columns used all exist: contacts `full_name, contact_type, total_paid, last_contacted_at, phone, wa_id` (002_v2_architecture.sql:144-147, sprint_v3:22-25); conversations `contact_name, sentiment, status, updated_at` (conversation_status enum: open/auto_resolved/escalated/closed, schema.sql:32). Status filter `'open'` matches the enum.
- Publishes a signal to the bus on every render (page.tsx:29, `void publishSignal`), a fire-and-forget write inside a render. Low risk, but on serverless it can be dropped.

### Actions
- None. Every control is a `Link`. No mutations, so no role/zod/audit/rate-limit question on this page itself.
- The weekly cold-lead cron (salesColdLeads.ts) is the only "action" and it is gated by tenant autonomy tier: C = notify only, B = draft (default), A = send. Tier A does check `phoneMayBeMarketed` and adds the opt-out footer (salesColdLeads.ts:124-126), and it excludes staff/supplier (signal.ts:49). Good.

### Verdict: PARTIAL
Real queries, honest empty states, but the three headline numbers rest on weak foundations (see bugs). No in-page action.

### States
- Empty: handled for no contacts (page.tsx:34), no attention list, no cold list.
- Loading/error: server-rendered, no skeleton, no error boundary visible in this file (UNVERIFIED whether a route-level `error.tsx` exists).
- Unbounded: the open-conversations query has no range (signal.ts:28), so `openConversations` stops at 1000 (PostgREST cap). The contacts query is correctly paged via `allRows` but deliberately capped at 2000 by spend; "Contacts" count and "lifetime" are therefore capped at 2000 (signal.ts:30-31) and the card says `totalContacts` as if it were the full count.

### Mobile / accessibility
- Cards use `grid-cols-2`, fine at 360px. Vital cards are whole-card links (large tap target). Arsenal links are ~36px high (`py-2`, page.tsx:163), below 44px. "Respond first" rows are 44px+.
- Rows use `key={i}` and every attention row links to the generic `/dashboard/inbox`, not the conversation.

### Bugs
1. **High** - `pipelineValue` filters `.neq('status','paid')` (signal.ts:32), so drafts, cancelled and in_collections invoices are counted as "won, awaiting pay". `lib/invoices/status.ts` exists precisely to prevent this (`OPEN_INVOICE_STATUSES`, `outstanding()`), and is not used here. Money overstated on the page's headline card.
2. **High** - "Going cold" and "never contacted" are driven by `contacts.last_contacted_at`. The only code in the repo that writes that column is the Tier-A cold-lead sender (salesColdLeads.ts:127). Inbound WhatsApp, manual replies (`app/api/conversations/reply/route.ts:51-65` updates only the conversation), Ring calls and sent emails never update it. Result: nearly every contact is "never contacted" or stale, and a customer you replied to this morning still shows as cold. Grep of `app/api`, `lib`, `inngest` found no other writer.
3. **High (UNVERIFIED in production)** - `contacts.total_paid`, `balance_owed`, `total_invoiced`, `lifetime_value` have no writer in the repo (no trigger in any migration, no route; only `contacts/merge` sums them). If production has no out-of-band trigger, "Lifetime revenue", the cold-list value ranking, and the 2000-row "top by spend" ordering are all zero/arbitrary. Needs a live check: `select count(*) from contacts where total_paid > 0`.
4. **Medium** - A contact created today has `last_contacted_at = null`, so it appears in "Going cold... never contacted" on day zero (signal.ts:48).
5. **Medium** - Contacts beyond the top 2000 by `total_paid` (i.e. all zero-spend leads once a tenant is large) can never appear in "Going cold".
6. **Low** - `conversations` select has no `limit`/range (cap 1000, see above).

Tenant isolation: every query has `.eq('tenant_id', tenantId)`. Uses `supabaseAdmin` (service role), so the explicit filter is the only guard; it is present.

### Gaps to "ahead of its time"
| Gap | Files to extend | Effort | Value |
|---|---|---|---|
| (a) One-tap "Win back" on each cold contact: AI draft shown inline with reason ("quiet 41 days, paid R12 400 lifetime"), Send / Enrol in sequence buttons. Reuse `draftColdLeadMessage` and `enrolInSequence`. | `app/dashboard/sales/page.tsx` (+ small client component), new `app/api/sales/nudge/route.ts` with `withRoute`, `lib/ai/callClaude.ts` | M | 5 |
| (b) State consequence in rands: "R38 200 of won work unpaid; R12 400 of customers going quiet". Needs fixing bug 1 first. | `lib/sales/signal.ts`, page.tsx | S | 4 |
| (c) Every number clickable to its records: Pipeline -> filtered invoices list; Need attention -> the specific conversations; Contacts -> list. Today Pipeline links to the whole invoices page and attention rows link to generic inbox. | page.tsx, `app/dashboard/inbox/page.tsx` (read `?conv=`), `app/dashboard/invoices` filter params | S | 4 |
| (d) Shadow mode for Tier A: log what would have been sent for a week before enabling auto-send, plus an undo/"stop this sequence" link in the notification. | `inngest/functions/salesColdLeads.ts`, `lib/autonomy/*`, new table or `audit_log` rows | M | 4 |

---

## 2. Inbox

Files: `app/dashboard/inbox/page.tsx`, `layout.tsx`, `app/api/conversations/{route,reply,status,[id]/messages}/route.ts`, `app/api/agents/[agentType]/route.ts`.

### Purpose and data
- Client component. Layout gates on `view_communications` (layout.tsx:7).
- Reads `conversations` and `messages` **directly from the browser Supabase client** (page.tsx:32-37, 45-49), relying on RLS, not the `/api/conversations` routes. Messages query has no `tenant_id` filter (RLS only) and no limit.
- Realtime subscriptions on `conversations` (tenant-filtered) and `messages` (conversation-filtered).
- Columns/status values match the migration: `status` in open/auto_resolved/escalated/closed, `resolved_by text`, `messages.role in (user, assistant, system)`.

### Actions
| Button | Route | Role | zod | Audit | Rate limit | Notes |
|---|---|---|---|---|---|---|
| Send reply | POST `/api/conversations/reply` | `communications.reply` via withRoute | yes (reply/route.ts:6-12) | yes `conversation.manual_reply` | yes `whatsapp` | recipient taken from DB, not client (good). Not a marketing message, so POPIA s69 consent does not apply. |
| Resolve / Escalate / Close | POST `/api/conversations/status` | `communications.reply` | yes | yes | none | The UI never offers "Reopen" although the API accepts `open`. |
| AI agent buttons (draft, summarise, lookup, escalation, advisor) | POST `/api/agents/[agentType]` | `communications.read` / `analytics.read` via manual `can()` | yes | yes (`agent.<name>.called`) | yes `agents` + budget check | Not withRoute, but equivalent checks done by hand. `conversationId` is not sent by the page, so the audit row has no resource id. |
- No hard deletes. Nothing is deleted here.

### Verdict: PARTIAL
The read path, realtime, status changes and AI draft are real and work today without WhatsApp (conversations arrive only via the webhook, which needs WhatsApp live, so the list will be empty for most tenants until Meta approves). Sending a reply depends on WhatsApp; email replies are explicitly 501 (reply/route.ts:47-48).

### States
- Empty: "No conversations yet" / "No conversations match" (page.tsx:276-279), and a placeholder when nothing is selected. No loading skeleton: the list is blank until the fetch returns, indistinguishable from empty. No error state on the Supabase fetches (errors ignored, page.tsx:32-43).
- Unbounded: conversations `.limit(100)` and search is client-side over those 100 only, so older conversations cannot be found. Messages are unbounded per conversation.
- Errors shown with `alert()` (page.tsx:184, 201).

### Mobile / accessibility
- Good: one-pane-at-a-time on mobile with a labelled Back button (page.tsx:291-297). 
- Back button `p-2` around a text arrow is about 32px. Header action buttons are `size="sm"`, three in a row beside a truncating title: likely cramped at 360px (UNVERIFIED visually). Message bubbles `max-w-xs` (320px) can overflow a 360px viewport with padding; use `max-w-[85%]`.
- Textarea has no label, placeholder only. Conversation list items are `<button>` with good semantics but no `aria-current`. `h-screen` breaks on mobile browser chrome (use `dvh`). Emoji used as icons in buttons ("✓", "⚠").
- No `role="log"`/live region for incoming messages.

### Bugs
1. **High** - `/dashboard/contacts/[id]` links to `/dashboard/inbox?conv=<id>` (contacts/[id]/page.tsx:321) but the Inbox page never reads `conv` (grep: no `useSearchParams` in inbox). The deep link opens the list with nothing selected. Same for Sales "Respond first".
2. **High** - Manual reply discards the WhatsApp message id: `sendAsTenant` returns `{ messageId }` (tenantSender.ts:20) but reply/route.ts:42 ignores it and the inserted `messages` row has no `whatsapp_message_id`. The webhook updates delivery/read only `.eq('whatsapp_message_id', s.id)` (webhook/whatsapp/route.ts:157-161), so manual replies never show delivered/read.
3. **Medium** - Reply ordering risk: WhatsApp is sent first, then the DB insert (reply/route.ts:41-59). If the insert fails the customer got the message but the thread has no record, and the UI shows an error so the user retries and double-sends.
4. **Medium** - Email- and dashboard-channel conversations show an identical reply box. Email returns 501 after the user types; dashboard channel stores a message that is sent nowhere.
5. **Medium** - Human replies and AI auto-replies are both `role='assistant'` and render identically; the owner cannot tell who said what. `resolved_by` is the only trace.
6. **Medium** - Reply falls back to the shared platform WhatsApp number when the tenant has none (tenantSender.ts:17), so the customer sees AdminOS's number, not the business's. Intentional per comments, but surprising.
7. **Low** - Realtime UPDATE replaces the list item but not `selected`, so the header status badge can lag. `loadMessages` plus the realtime INSERT can race and duplicate a message.
8. **Low** - Opt-out/STOP handling is correct upstream (webhook:85), but Inbox shows no marker that a contact has opted out of marketing.

### Gaps to "ahead of its time"
| Gap | Files | Effort | Value |
|---|---|---|---|
| (a) "Reply for me": preselect the AI draft, show the reason ("angry about invoice INV-0042, R4 800 overdue") and a single Send. Today the user must click an agent, then "Use AI draft", then Send. | inbox page, `lib/ai/agents.ts` (`buildAgentContext` already pulls DB context), pass `conversationId` | M | 5 |
| (b) Consequence in rands: show the contact's open invoices and lifetime value on the conversation header. | inbox page, `app/api/contacts/[id]/route.ts` (already returns invoices) | S | 4 |
| (c) Link header name to the contact; link "R4 800 owed" to the invoice. | inbox page | S | 4 |
| (d) Undo: delay send by 10 seconds with an "Undo" toast; "Reopen" button. | inbox page, reply route (queue instead of immediate) | M | 3 |

---

## 3. Contacts and Contact detail

Files: `app/dashboard/contacts/{page,ContactsTable,CreateContactModal}.tsx`, `contacts/[id]/{page,ContactActions,EditContactModal,MarketingConsent}.tsx`, `app/api/contacts/{route,[id]/route,merge/route}.ts`, `lib/contacts/upsert.ts`, `lib/contacts/phone.ts`.

### Purpose and data
- Server pages gated by `manage_contacts`. List reads `contacts` with a 2000 limit (page.tsx:22-27). Detail reads `contacts`, `conversations` (limit 20), `invoices` (limit 20).
- All columns exist: `popia_consent, popia_consent_at` (master_schema.sql:156-157), `marketing_opt_out_at` (20261007 migration), `deleted_at` (20261005_soft_delete_columns.sql:25), `source, external_id, lifetime_value, wa_id` (20260505_sprint_v3). `balance_owed/total_*` exist in schema but have no writer (see Sales bug 3).
- Conversation status colour map uses `resolved` and `pending` (detail page.tsx:77-82), which are not enum values (`auto_resolved`, `closed`); those fall through to grey. Invoice status map lacks `sent`, `in_collections`, `cancelled` (page.tsx:84-90), which fall back to the "draft" grey, so a sent/unpaid invoice looks like a draft.

### Actions
| UI | Route | Guard | zod | Audit | Rate limit | Soft delete |
|---|---|---|---|---|---|---|
| New Contact | POST `/api/contacts` | `guard('contacts.write')` | yes | **none** | none | n/a |
| Edit contact, consent, opt-out | PATCH `/api/contacts/[id]` | `guard` | yes | yes (`contact.updated`) | none | n/a |
| Delete | DELETE `/api/contacts/[id]` | `guard` | n/a | yes | none | yes (`deleted_at`, route:158-163), but **no UI button** calls it |
| Merge | POST `/api/contacts/merge` | `guard` | yes | yes | none | yes, but **no UI** calls it (grep of `app/dashboard` for `contacts/merge` found nothing) |
| "Message" button | `wa.me` external link | none | n/a | none | n/a | n/a |
- These routes use the older `guard()` helper, not `withRoute`, so there is no rate limit and no uniform DB error mapping; raw failure strings are generic ("Failed to create contact").
- POPIA: consent is recorded by the business via `MarketingConsent` and enforced downstream in Reach/sequences. PATCH sets `marketing_opt_out_at` and calls `recordOptOut`, which also cancels active sequence enrolments. Good.

### Verdict: PARTIAL
CRM list/detail/edit/consent work. Missing the money integrity, merge/delete UI, and an in-app messaging path.

### States
- Empty: `EmptyState` in table (ContactsTable.tsx:202-210). Detail has empty states for conversations and invoices.
- Loading: none (server render). Errors: modal shows error text (CreateContactModal:63-70).
- Unbounded/cap: `.limit(2000)` on the list (page.tsx:27). The comment in `lib/sales/signal.ts:29` states this exact pattern was silently cut to 1000 by PostgREST `max_rows`. So the four stat cards ("Total Contacts", "Total Outstanding", "Lifetime Revenue") stop at 1000 rows, and the subtitle says "N contacts in your CRM" with N <= 1000. **High** for any tenant above 1000 contacts. Fix with `allRows` as signal.ts does.
- Detail: invoices query is `limit(20)` filtered on `contact_phone` (page.tsx:123-129), so a customer with more than 20 invoices shows the latest 20 with the count in the header ("Invoices (20)") reading as the total.

### Mobile / accessibility
- `DataTable` renders a real `<table>` inside `overflow-x-auto` (DataTable.tsx:368) with 7 columns and no card fallback at 360px; horizontal scroll is required. It has `aria-label`s on search/filter/pagination and `aria-sort`.
- `ContactActions` Edit button is an icon-only `w-10 h-10` (40px) with no `aria-label` (ContactActions.tsx:32-38): fails both the 44px and the screen-reader rule. "View" column cell is text inside a row link; fine.
- Detail layout is `grid-cols-1 lg:grid-cols-3`, fine on mobile. Modal focus handling lives in `components/ui/Modal` (UNVERIFIED).

### Bugs
1. **High** - Detail page invoices are matched only by `contact_phone` (page.tsx:127) while the API route (`/api/contacts/[id]`) matches `contact_id` or phone. Invoices created from the "+ New Invoice" link (which passes `contact=<id>`) and not carrying the phone are not listed. Also the page makes a second query for the phone inside `Promise.all` (page.tsx:127), wasteful.
2. **High** - `GET /api/contacts/[id]` fetches the tenant's latest 50 invoices and filters in JS (route.ts:49-86), so a contact's older invoices disappear as soon as the tenant has more than 50 newer ones. Filter in SQL with `.or(contact_id.eq..., contact_phone.eq...)`.
3. **High (compliance)** - New contacts default to `contact_type = 'client'` in both the create form/API (route.ts:13) and `upsertContact` (upsert.ts:38, used for every inbound WhatsApp sender and public booking). `mayMarketTo` treats `client` as a customer with no consent needed (consent.ts:37). So any stranger who messages the business becomes marketable under POPIA s69(3) without having bought anything. A prospect should be `unknown` until they buy; recommend default `unknown` and promote to `client` on first paid invoice.
4. **Medium** - `POST /api/contacts` dedupes by exact phone string (route.ts:76) while the rest of the system matches by normalised digits (`samePhone`). "+27 82..." and "082..." create two contacts. It also stores the phone raw, not `toE164`, unlike `upsertContact`.
5. **Medium** - The unique constraint `contacts_tenant_phone_unique` (sprint_v3:32-34) is not partial, so a soft-deleted contact still holds its phone. Creating a contact with that phone returns a generic 500 "Failed to create contact" (route.ts:101). `upsertContact` handles this by reviving; the create route does not.
6. **Medium** - List search uses string interpolation into `.or(...)` (route.ts:43). Commas/parentheses in the search text break or alter the filter. Tenant scoping is a separate `.eq`, so this is not a leak, only a correctness/injection-of-filters issue.
7. **Medium** - `wa.me/<digits>` link uses the raw stored phone (ContactActions.tsx:24). A local number like `082 345 6789` produces `wa.me/0823456789`, which does not open a chat; need `toE164` first. It also bypasses Inbox, so nothing is logged and `last_contacted_at` is not set.
8. **Medium** - `contacts/merge` is a non-transactional sequence of 12 parallel updates then totals then soft delete (merge/route.ts:65-105). A mid-way failure leaves records split across contacts. The balance totals are summed, which double counts if the same invoice was already counted on both. Also no UI exists.
9. **Low** - Financials card shows `R{n.toLocaleString()}` instead of `formatZAR` and no timezone (detail page.tsx:258).
10. **Low** - `PATCH` of phone to an existing number returns 404 "Not found or update failed" rather than a duplicate message.

### Gaps
| Gap | Files | Effort | Value |
|---|---|---|---|
| (c) "Why R8 400?" - click Balance Owed to see the invoices behind it; compute balance live from invoices instead of an unmaintained column. | `app/dashboard/contacts/[id]/page.tsx`, `lib/invoices/status.ts` (`outstanding`), DB trigger or view for contacts totals | M | 5 |
| (a) Contact-level "Do it for me": Chase payment / Re-engage / Book follow-up, each with reason and rands at stake. | contacts/[id]/page.tsx, new `ContactActions` handlers, `withRoute` routes | M | 4 |
| Merge UI with duplicate detection (same normalised phone) and preview. | new modal on ContactsTable, `merge/route.ts` (make transactional via SQL function) | M | 3 |
| (d) Undo for delete/merge (soft delete already supports restore); add "Recently deleted" and Undo toast. | contacts routes, ContactsTable | S | 3 |
| Mobile card list for the table. | `components/ui/DataTable.tsx` (shared, affects every page) | M | 4 |

---

## 4. Reach (broadcasts)

Files: `app/dashboard/reach/{page,ReachCampaignTable,new/page}.tsx`, `components/reach/SendCampaignButton.tsx`, `app/api/reach/campaigns/{route,[id]/send/route}.ts`, `lib/reach/{audience,consent}.ts`, `inngest/functions/reachCampaignSend.ts`, `app/api/webhook/whatsapp/route.ts` (status callbacks).

### Purpose and data
- Page gated by `send_broadcasts` (page.tsx:23) and visually gated by the `reach` add-on overlay. Reads `broadcast_campaigns` (limit 200, `deleted_at is null`, tenant-filtered). Table/columns verified in `20260505_sprint_v3.sql:94-113` plus `deleted_at` (soft delete migration:22). `broadcast_recipients` verified (sprint_v3:129-142). Status values in code (draft, sending, sent, failed, scheduled) are free text, no check constraint.

### Actions
| UI | Route | Role | zod | Audit | Rate limit | Consent |
|---|---|---|---|---|---|---|
| Save Campaign | POST `/api/reach/campaigns` | withRoute `broadcasts.send` + add-on check | yes | yes `reach.campaign_created` | none | n/a (draft) |
| Send (step 1: preview) | GET `.../[id]/send` | withRoute `broadcasts.send` | n/a | none | none | shows eligible / held back counts |
| Confirm send | POST `.../[id]/send` | withRoute | n/a | yes `reach.campaign_sent` | yes (`agents`) | `resolveAudience` + `mayMarketTo` + opt-out footer + STOP, re-resolved inside the Inngest function at send time |
- Excellent: conditional claim prevents double send (send/route.ts:60-66), paged audience (no 1000 cap), POPIA s69 footer, STOP handling in webhook, per-batch Inngest steps, failure reverts to draft if the event cannot be queued.
- No edit, cancel, delete or duplicate for campaigns: there is no `[id]` route other than `send`. Soft delete is impossible from the UI.

### Verdict: PARTIAL
The consent engineering is the best in the cluster. The unproven part is sending itself (needs WhatsApp live + approved templates), and campaign lifecycle management is missing.

### States
- Empty state present. No loading state (server render). Errors per button, inline text.
- Reach stats are computed over the latest 200 campaigns only, labelled as totals (page.tsx:35-40). Low.
- Delivered/Read percentages are `delivered_count / sent_count`; counters come from the webhook (`refreshCampaignCounts`, webhook:186-203) which re-reads all recipients per status event: O(n) work per receipt, and `.select('status')` is capped at 1000 rows, so counters for campaigns above 1000 recipients stop at 1000. Medium.

### Mobile / accessibility
- Same DataTable horizontal scroll. The Send button is `px-2.5 py-1` (about 26px high): below 44px. Confirm/Cancel buttons likewise. No `aria-live` for the "Send to N contacts?" panel.
- New-campaign form: labels are `<label>` without `htmlFor`, audience chips are plain buttons with no `aria-pressed`.

### Bugs
1. **High** - Campaign can stick at `sending` forever. The Inngest function returns `{ skipped: true }` if the campaign is not `sending` or the tenant has no `meta_phone_number_id` (reachCampaignSend.ts:34, 44) without resetting status. The UI shows the Send button only for `draft` (ReachCampaignTable.tsx:148), so a stuck `sending` campaign has no recovery and no way to cancel. The `failed` status exists in the UI map but nothing ever sets it, even when every recipient fails (finish step always writes `sent`, line 74).
2. **High (once WhatsApp is live)** - Campaigns send free-form text (`sendWhatsAppMessage(..., personalise(plan.message))`, reachCampaignSend.ts:53). Meta only allows free-form business-initiated messages inside the 24h window; broadcasts to cold contacts require approved templates. `broadcast_campaigns.template_id` exists but is unused. The new-campaign page admits this in small print (new/page.tsx:130-133). Expect most sends to fail with `failed` recipients while the campaign reads "Sent".
3. **Medium** - `scheduled_at` is accepted by the API (route.ts:15) and the `scheduled` status is rendered, but the form never sets it and no cron picks up scheduled campaigns (no `scheduled` reference in `inngest/functions`). Dead feature.
4. **Medium** - "Send to all" precondition: if `meta_phone_number_id` is missing the send route says "Contact AdminOS support to connect it" (send/route.ts:50). Correct and honest while WhatsApp isn't live, but every tenant hits this today; the page gives no warning before they draft.
5. **Medium** - Retries (`retries: 2`) re-run a failed batch step that has already sent some messages in that step (messages are sent in a loop inside one `step.run`; a crash after message 30 of 50 resends 1-30). Duplicate sends to customers.
6. **Medium** - Add-on gating is partly client-side: the page renders the data inside `BillingGateOverlay` (UNVERIFIED whether the children are rendered when locked); `GET /api/reach/campaigns` (list) has no add-on check while POST does.
7. **Low** - Audience filter only supports contact type (strict zod); no tags, last-contacted, or balance filters.
8. **Low** - Sequences and Reach are separately gated (sequences are not add-on checked), inconsistent.

### Gaps
| Gap | Files | Effort | Value |
|---|---|---|---|
| (b) Cost and return in rands before send: "Reaches 142 people, about R0.31 each = R44; last campaign earned R3 200". Needs WhatsApp pricing constant plus attribution (payments within 14 days of send). | `components/reach/SendCampaignButton.tsx`, send GET route, new `lib/reach/attribution.ts` | M | 5 |
| (a) "Win back dormant customers" one-tap campaign built from the Sales cold list with the reason. | `app/dashboard/sales`, `reach/new/page.tsx` accepts `?audience=cold` | M | 4 |
| (d) Shadow/test mode: "Send to me first" test message and a scheduled-with-cancel window (also gives `scheduled` a real purpose). | new `inngest` scheduled-dispatch function, `reach/[id]` route (cancel/edit/soft delete) | M | 4 |
| (c) Clickable stats: Sent -> recipients table with per-contact status and failure reason (the data is already in `broadcast_recipients`). | new `reach/[id]/page.tsx` | M | 4 |
| Template support (approved templates, variables). | `lib/whatsapp/templates.ts`, campaign schema | L | 5 once Meta is live |

---

## 5. Ring (AI voice, Twilio)

Files: `app/dashboard/ring/{page,RingCallTable}.tsx`, `app/api/ring/calls/route.ts`, `app/api/voice/{inbound,status}/route.ts`.

### Purpose and data
- Server page, gated by `view_communications`. Reads `tenants.twilio_phone_number, twilio_twiml_app_sid` and `call_logs` (limit 500). `call_logs` verified (sprint_v3:154-173). `twilio_*` tenant columns: UNVERIFIED (not found in the migrations grep; may be in base schema; page would show the setup card regardless if the select errors).
- Status values written by the code: `initiated` (default), `in-progress`, `transferred`, `completed`, `no-answer`, `failed` (voice/inbound:104,156; status:23-30). The UI map covers exactly these. Consistent, no drift. But unknown Twilio values (e.g. `ringing`, `answered`) pass through (`statusMap[callStatus] ?? callStatus`) and render with the *Completed* style/label (RingCallTable.tsx:88).

### Actions
- None on the page. The dashboard is a read-only log; "Set up your number" links to settings. `GET /api/ring/calls` exists with `guard('communications.read')` and add-on check but the page does not use it (queries the DB directly). No mutations: nothing to rate limit, audit or soft delete.
- Webhooks (public, signature-verified with `verifyTwilioSignature`): the status callback sends an automatic WhatsApp follow-up to the caller on every `completed` call, from the tenant number (status/route.ts:45-64). This is a service message to someone who called, not marketing, so s69 consent is not required, but it has no idempotency (the code comment admits a Twilio retry re-sends) and no opt-out/identity beyond the business name.

### Verdict: THIN
A call-log viewer with real data once Twilio is wired. Nothing to do with the log: no call back, no link to the contact, no task. Depends on a Twilio number and the paid add-on; WhatsApp follow-up depends on WhatsApp.

### States
- Empty state present. Setup card handles the not-configured case well. No loading/skeleton, no error handling for the queries.
- "Total Calls", "AI Handled %" and "Avg Duration" are computed over only the latest 500 rows but labelled as totals (page.tsx:38-52). Avg duration divides by all rows including calls with no duration. The API route's `answered`/avg uses a different rule (divides by `completed` count but sums every row with a duration), another inconsistent definition (api/ring/calls/route.ts:43-48).

### Mobile / accessibility
- Seven-column DataTable with horizontal scroll, no card layout. Recording link is `text-xs` (small tap target). Transcript cell `max-w-xs`. `CopyButton` has unknown aria (UNVERIFIED).

### Bugs
1. **Medium** - Unknown/intermediate Twilio statuses are mislabelled "Completed" (see above).
2. **Medium** - Duplicate follow-up WhatsApp on webhook retry (no idempotency flag; needs a column, acknowledged in code).
3. **Medium** - `recording_url` is the raw Twilio URL stored and linked directly; Twilio recording URLs require account auth unless made public. UNVERIFIED; likely opens a login prompt for the tenant user. Also a PII risk if made public.
4. **Low** - A call stuck at `in-progress` (status callback lost) is shown as "Live" indefinitely.
5. **Low** - Stats over 500 rows presented as totals.

### Gaps
| Gap | Files | Effort | Value |
|---|---|---|---|
| (a) Missed call -> "Call back / WhatsApp / create task" with the reason ("missed call from existing client owing R4 800"). | `RingCallTable.tsx`, new route with withRoute, `tasks` | M | 4 |
| Link calls to contacts (the `contact_id` column exists but is never shown or populated here: UNVERIFIED in inbound route). | `voice/inbound/route.ts` (upsertContact), table | S | 4 |
| (b) Hours saved by AI call handling in rands. | page.tsx | S | 3 |
| (c) Clickable stats that filter the table. | RingCallTable | S | 2 |

---

## 6. Sequences

Files: `app/dashboard/sequences/{page,SequencesTable,new/page}.tsx`, `components/sequences/{SequenceToggle,EnrolButton}.tsx` (not read), `app/api/sequences/{route,[id]/route,[id]/enroll/route}.ts`, `lib/reach/{sequences,sequenceSchema,audience}.ts`, `inngest/functions/sequencesCron.ts`.

### Purpose and data
- Gated by `send_broadcasts`. Tables `whatsapp_sequences` (deleted_at added in soft-delete migration:56; steps jsonb) and `sequence_enrollments` (statuses used: active, completed, cancelled). Column names in code (`contact_identifier`, `current_step`, `next_step_at`, `sequence_id`) were checked only against `master_schema.sql`/`schema.sql` line 404/431, not a migration (the table is created in the base schema), so treat as UNVERIFIED against production. Status values written by the cron (`completed`, `cancelled`) and counted by the page (`active`) are consistent.

### Actions
| UI | Route | Role | zod | Audit | Rate limit | Soft delete / consent |
|---|---|---|---|---|---|---|
| Create sequence | POST `/api/sequences` | withRoute `broadcasts.send` | yes (`createSequenceSchema`) | yes | none | n/a |
| Toggle active | PATCH `/api/sequences/[id]` | withRoute | yes (`.strict()`) | yes | none | n/a |
| Enrol | POST `/api/sequences/[id]/enroll` | withRoute | yes | yes | none | `phoneMayBeMarketed` consent check, duplicate check, E.164 (sequences.ts:35-45) |
| Delete | DELETE `/api/sequences/[id]` | withRoute | n/a | yes | none | soft delete + cancels active enrolments. **No UI button calls it** (SequencesTable has no delete or edit). |
| Auto-enrol | `runSequenceTrigger` on new contact / new client | n/a | n/a | none | n/a | consent-checked per enrol |
- Steps cannot be edited after creation from the UI (the PATCH route supports it; no edit page).

### Verdict: PARTIAL
Well-engineered backend with POPIA enforced at enrol time and at every send. Missing edit/delete UI, and in the current environment (no WhatsApp number) it silently kills enrolments.

### States
- Empty state present. Counts per sequence are DB `head` counts (no 1000 cap). No loading state. Page-level `Promise.all` per sequence is N queries (limit 200 sequences).
- The cron fetches at most 200 due enrolments per hour (`.limit(200)`, sequencesCron.ts:23), no ordering and no tenant fairness: with more than 200 due, the rest wait for subsequent hours, and enrolments with the oldest `next_step_at` are not guaranteed to be processed first. Medium at scale.

### Mobile / accessibility
- DataTable horizontal scroll again. New-sequence form uses plain inputs; step delete is an icon button (Trash2): `aria-label` UNVERIFIED (new/page.tsx beyond line 120 not read). Labels have no `htmlFor`.

### Bugs
1. **High (current state)** - The hourly cron cancels an enrolment when the tenant has no `meta_phone_number_id` (sequencesCron.ts:51-57). While WhatsApp is not live, every new_contact / new_client enrolment is created at contact creation, then silently cancelled at its first due step, permanently. When WhatsApp goes live those people are lost from the sequence. Should leave the enrolment `active` and push `next_step_at`, or block enrolment up front with a clear message.
2. **High (compliance)** - Because new contacts default to `client`, `new_contact` sequences auto-enrol anyone who sent a WhatsApp message and `mayMarketTo` will pass them (see Contacts bug 3).
3. **Medium** - `{{name}}` is never personalised in sequences: the cron calls `personalise(step.message, null)` (sequencesCron.ts:83), so every recipient gets "Hi there". The new-sequence page / Reach page tell the user `{{name}}` becomes the first name (UNVERIFIED for the sequence form text).
4. **Medium** - No claim on the enrolment before sending: with `retries: 0` and a crash between `sendWhatsAppMessage` and the update, the next hourly run resends the same step. Failed sends retry every 2 hours with no attempt cap (sequencesCron.ts:87-92), so a permanently bad number is retried forever.
5. **Medium** - Cron enrolment/sequence tenant mismatch is not checked: `seqMap[enrollment.sequence_id]` is trusted without comparing `seq.tenant_id` to `enrollment.tenant_id`. Needs a tenant-id integrity assumption (low likelihood).
6. **Low** - No `requireAddon` check on sequences although they are the same capability as Reach.
7. **Low** - `completed` is set only after the last step is sent; an enrolment on step index beyond length is also marked completed and counted as processed.

### Gaps
| Gap | Files | Effort | Value |
|---|---|---|---|
| (d) Dry-run/shadow: "if I turned this on, 23 contacts would get message 1 tomorrow" with the list; edit steps. | new `sequences/[id]` page, `app/api/sequences/[id]/preview/route.ts`, `lib/reach/sequences.ts` | M | 5 |
| (c) Per-sequence funnel (step reached, replies, payments after) clickable to contacts. Needs a `sequence_events` log (none exists). | cron, new table | L | 4 |
| (a) Ready-made sequence templates (invoice reminder, quote follow-up, post-service review) with reason text. | `app/dashboard/sequences/new/page.tsx` | S | 4 |
| Delete/edit UI. | SequencesTable, new edit page | S | 3 |

---

## 7. Email Studio (Pen)

Files: `app/dashboard/email-studio/page.tsx` (+ layout), `app/api/agents/pen/route.ts`, `app/api/email-drafts/{route,[id]/route}.ts`, `lib/email/send.ts` (not read).

### Purpose and data
- Client page. `email_drafts` table verified (002_v2_architecture.sql:84-106): status check allows `draft,sent,saved_template,archived`; code uses `draft` and `sent` only (fine). `deleted_at` added by soft-delete migration:32. `email_type` and `category` are NOT NULL; the Pen route sets both (pen/route.ts:110-111). `language_used` exists.
- The page does not itself check a permission (layout.tsx exists, content UNVERIFIED but the API checks `email.drafts`).

### Actions
| UI | Route | Guard | zod | Audit | Rate limit |
|---|---|---|---|---|---|
| Generate with Pen | POST `/api/agents/pen` | manual `getContext` + `can('email.drafts')` | yes | **none** (no audit row for AI generation or draft creation) | yes `agents` + daily AI budget |
| Load drafts | GET `/api/email-drafts` | withRoute `email.drafts` | yes | n/a | none |
| Send | POST `/api/email-drafts/[id]` `{action:'send'}` | withRoute | yes | yes `email_draft.sent` | yes `agents` |
| Delete | DELETE `/api/email-drafts/[id]` | withRoute | n/a | yes | none; soft delete (deleted_at) |
| Copy | clipboard only | | | | |
- Send is honest while email is down: it returns 503 "Email sending is not set up... nothing was sent" and only marks `sent` after the provider accepts (drafts/[id]/route.ts:64-79). The UI surfaces that message in a toast. Good.
- Marketing consent: emails here are one-to-one correspondence typed by the owner, not bulk marketing, so s69 consent is not enforced. There is no check that the recipient has not opted out of marketing, and "Welcome / Onboarding" and "Proposal" types could be marketing. Low.

### Verdict: PARTIAL
Generation (streaming) and draft storage genuinely work today and do not depend on email delivery. Sending depends on Resend and is currently dead (message shown). The editing story is broken.

### States
- Empty: yes for both panes. Loading: "Loading drafts..." text; generating shows spinner. Error: toast with `role="alert"`; generation failure writes the error text into the email box (page.tsx:88, 115), so an error string looks like email content and can be copied.
- Unbounded: drafts page is 20 per page, but the UI never requests page 2 (loadDrafts calls `/api/email-drafts` once, page.tsx:125), so only the latest 20 drafts are ever reachable.

### Mobile / accessibility
- Form is `grid-cols-1 lg:grid-cols-2`; fine. Tone/language chips are `px-3 py-1.5` (about 30px): under 44px. Labels are `<label>` without `htmlFor`. Delete is an icon-only `p-1.5` button with no `aria-label` (page.tsx:407-412). The confirmation dialog has `role="dialog" aria-modal` but no focus trap, no initial focus, no Escape handler. Textarea `h-96` fixed.

### Bugs
1. **High** - Edits are never persisted. The generated text is editable in a textarea (page.tsx:334-338) and a note says "Auto-saved as draft. Edit freely above" (line 339), but the draft was saved from the streamed text on the server (pen/route.ts:85-118) and nothing calls `PATCH /api/email-drafts/[id]`. Sending later mails the unedited AI text. The user believes their edits are sent.
2. **High** - The saved `body` is the entire model output including the `Subject:` line (pen/route.ts:107), while `subject` is stored separately. The send route mails `subject` plus `text: draft.body`, so the recipient sees "Subject: ..." repeated as the first line of the body. Strip the subject line before saving.
3. **Medium** - Drafts list shows subject and recipient only; there is no way to read or edit the body, and the send confirmation shows only the subject (page.tsx:441-447). The owner can email a customer without ever seeing the final text in-app after leaving Compose.
4. **Medium** - Draft id is not returned to the client, so the page cannot PATCH the draft it just created (a prerequisite for fixing bug 1).
5. **Medium** - No link between an invoice/contact and a draft: the "Invoice / Payment Request" type depends on the user typing the amount and invoice number from memory in free text, so figures can be wrong (AI will happily write R12,500 from the placeholder). `context_type`/`context_id` columns exist on `email_drafts` and are unused.
6. **Low** - Save-in-flush design: if the client disconnects mid-stream, `flush()` never runs and no draft is saved (pen/route.ts:100). Acceptable but undocumented.
7. **Low** - No audit row for generation (cost and content trail).

### Gaps
| Gap | Files | Effort | Value |
|---|---|---|---|
| (a)+(b)+(c) "Chase this invoice": open from an invoice or contact with real figures prefilled (amount owed in rands, days overdue, invoice number, link), reason shown, one-tap send via email or WhatsApp. Uses `context_type='invoice'`/`context_id`. | email-studio page (accept `?invoice=`), `app/api/agents/pen/route.ts` (load invoice), `lib/invoices/status.ts`, `app/dashboard/invoices` button | M | 5 |
| Persist edits (return draft id, debounced PATCH) and a body preview in the drafts list. | page.tsx, pen route (emit id in an SSE event) | S | 5 |
| (d) "Send in 30 seconds, undo" and a copy-to-clipboard fallback while Resend is down (already partly implied by error text). | page.tsx | S | 3 |

---

## Cross-page loops

Existing:
- Contact created -> `runSequenceTrigger` -> sequence enrolment (consent-checked) -> hourly cron message. Works in code; dead until WhatsApp number is connected.
- Inbound STOP -> `recordOptOut` -> contact opted out and active enrolments cancelled -> Reach/sequence audiences exclude them. Closed loop, well done.
- Contact detail -> "+ New Invoice" (prefills contact) and "Open ->" to a conversation (broken, see Inbox bug 1).
- Weekly cold-lead cron -> notification with draft or auto-send -> `last_contacted_at` update (only on Tier A auto-send).
- Call completes -> automatic WhatsApp summary to the caller (not retry-safe).

Missing:
1. Reply / call / email / campaign -> `contacts.last_contacted_at`. Without it the whole "going cold" idea is unreliable. Single shared helper `touchContact(tenantId, contactId)` called from reply, sendAsTenant, voice status, email-draft send, campaign recipient send.
2. Cold lead -> task (no "follow up" task creation anywhere in the cluster) -> quote/invoice. Sales shows the lead and stops.
3. Conversation -> contact -> booking/invoice: Inbox does not show or link the contact, open invoices, or a "create invoice / book" action even though `conversations.contact_id` exists.
4. Missed call (Ring) -> contact -> task / WhatsApp callback.
5. Invoice paid -> contact totals -> "lifetime revenue" -> cold list ranking: the contact money columns have no writer, so this loop is open (UNVERIFIED in prod).
6. Campaign -> attribution (payments after send) -> Reach "return" figure. No attribution data exists.
7. Overdue invoice -> Pen email draft with real figures (the debt-recovery engine exists elsewhere; Email Studio is not connected to it).
8. Email Studio send -> `contacts.last_contacted_at` / conversation record (emails leave no trace in the CRM).

---

## RANKED fix-and-build list for the cluster

### Bugs first (ordered by severity then by cost)
1. **Critical/High** Verify and fix contact money columns: confirm in production whether `balance_owed/total_paid/total_invoiced/lifetime_value` are maintained; if not, add a trigger or compute from invoices. Touches Sales, Contacts, cold-list ranking. (S to verify, M to fix)
2. **High** Sales pipeline value: use `OPEN_INVOICE_STATUSES` and `outstanding()` from `lib/invoices/status.ts` in `lib/sales/signal.ts:32`. (S)
3. **High** Write `last_contacted_at` from every outbound/inbound touch (shared helper) and exclude contacts created in the last N days from "never contacted". (M)
4. **High** Sequences cron must not cancel enrolments when the tenant has no WhatsApp number: defer instead. (S)
5. **High** Email Studio: persist edits (return draft id, PATCH on edit/blur), strip the `Subject:` line from the saved body, and show the body in the drafts list/confirmation. (S-M)
6. **High** Contacts list: replace `.limit(2000)` with `allRows` so stats do not stop at 1000. (S)
7. **High** Contact detail invoices: query by `contact_id` OR phone in SQL (page and `/api/contacts/[id]`), remove the JS filter over 50 rows. (S)
8. **High** Inbox: honour `?conv=` and link attention rows to the exact conversation; store `whatsapp_message_id` on manual replies. (S)
9. **High (compliance)** Change default `contact_type` for new/inbound contacts from `client` to `unknown`; promote to `client` on first paid invoice. Review who is currently marketable. (S code, needs a data decision from Nanda)
10. **High** Reach campaign lifecycle: reset or fail the campaign when the Inngest function skips; set `failed` when all recipients fail; add cancel/soft-delete/edit routes; make batch sends idempotent per recipient (check `broadcast_recipients` before send). (M)
11. **High (when live)** Reach/sequences: template-based sending for business-initiated messages. (L)
12. **Medium** Sequence `{{name}}` personalisation (look up contact name by phone in the cron); cap retries; claim-before-send. (M)
13. **Medium** `POST /api/contacts`: normalise phone with `toE164`, dedupe with `samePhone`, revive/handle soft-deleted holder of the phone, return 409 not 500 on unique violation, write an audit row, add rate limiting; consider moving to `withRoute`. (M)
14. **Medium** Fix `wa.me` link to use E.164; or replace with an in-app Inbox "start conversation". (S)
15. **Medium** Ring: map unknown statuses; idempotency flag for the follow-up WhatsApp (migration); contact_id linking; verify recording URL access. (M)
16. **Medium** Inbox: hide the reply box (or explain) for email/dashboard channels; add Reopen; fix bubble width and add error/loading states; replace `alert()`. (S)
17. **Medium** Status colour maps: contacts/[id] conversation (`auto_resolved`, `closed`) and invoice (`sent`, `in_collections`, `cancelled`); Ring fallback. (S)
18. **Medium** Contact merge: wrap in a SQL function (transaction), add a UI, avoid double counting totals. (M)
19. **Medium** Reach counters beyond 1000 recipients (`refreshCampaignCounts` count in SQL). Scheduled campaigns: build the dispatcher or remove the dead option. (M)
20. **Low** Escape search in the `.or()` filter; ensure `formatZAR` and SAST dates on the contact detail; accessibility pass (aria-labels on icon-only buttons: contact Edit, email Delete, sequence step delete; 44px tap targets on Send, chips, Arsenal links; focus trap in the Email Studio dialog; `htmlFor` on labels). (S-M)
21. **Low** `DataTable` mobile card fallback at 360px (shared component; benefits all seven pages). (M)

### Gaps (build order by value and cost)
1. **Chase-with-real-numbers** (Email Studio + Inbox + Contacts): invoice-context drafts with rands, reason, one tap. Value 5, M.
2. **Win back from the Sales page**: per-contact AI draft + send/enrol with reason and rand value; click-through numbers. Value 5, M.
3. **Explainable money** on Contacts and Sales: click Balance/Pipeline to see the invoices; live computation. Value 5, M.
4. **Reach cost and return in rands**, recipients drill-down, "send test to me", cancel window. Value 5 (4 for drill-down), M.
5. **Sequence dry-run / preview and edit** (shadow mode), ready-made sequence templates. Value 5, M.
6. **Inbox "Reply for me"** with contact + open-invoice context and undo-send. Value 5, M.
7. **Ring missed-call -> task/callback** and contact linking. Value 4, M.
8. **Cross-page touch tracking** (shared `touchContact`) and attribution data for Reach. Value 4, M-L.

### Not verified (list)
- Production state of contact money columns and any out-of-repo triggers.
- `twilio_phone_number`/`twilio_twiml_app_sid` tenant columns and `sequence_enrollments` column definitions against a migration (only base schema files found).
- `components/sequences/*`, `components/ui/Modal`, `BillingGateOverlay` behaviour, `lib/email/send.ts`, `voice/inbound` contact linking.
- Visual 360px behaviour (code-level only), and whether route-level `error.tsx`/`loading.tsx` exist for these pages.
