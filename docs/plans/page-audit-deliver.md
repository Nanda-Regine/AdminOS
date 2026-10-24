# Page audit: the "Deliver" cluster

Date 2026-10-24. Read-only, code-level audit. Nothing was run; no live DB, no browser, no network. Everything below is from reading source and `supabase/migrations/*.sql` (not the stale `master_schema`). Items I could not prove from the repo are marked **UNVERIFIED**.

Scope: `app/dashboard/{ops,bookings,calendar,suppliers,inventory,inventory/[id],tasks,documents,creative-assets}`, their API routes, `lib/ops`, `lib/inventory`, `lib/calendar`, `lib/documents`, and `inngest/functions/{bookingReminder,opsAlerts,docIntelligence,processQueue}`.

Judging rule: WhatsApp sending is not live and email is down, so anything that only works by sending a WhatsApp or email is called out as "depends on WhatsApp/email".

## Summary table

| Page | Verdict | Critical bugs | Top gap |
|---|---|---|---|
| Ops cockpit `/dashboard/ops` | REAL (read-only dashboard, thin) | none Critical; High: "low stock" counts never-stocked SKUs and cancelled bookings counted as "today" | One-tap "reorder these 5" with R value at risk |
| Bookings `/dashboard/bookings` | THIN | Critical: there is no way to create a booking or a service from the UI, and the public booking link has no page; High: no availability/hours/capacity checks on the public API | Create-booking + public booking page with real slot generation |
| Calendar `/dashboard/calendar` | REAL (read-only aggregator) | none Critical; Medium: clicking an empty day snaps back to today | Add tasks, supplier-payment and stock-out dates; clickable records |
| Suppliers `/dashboard/suppliers` | THIN | none Critical; High: no edit/delete, nothing links a supplier to a product or spend | Supplier-to-product link, lead time, then draft purchase order |
| Inventory `/dashboard/inventory` (+ `[id]`) | PARTIAL | High: no edit/delete product; invoice cancel never restores stock; opening stock has no ledger row; stock list capped at 1000 rows | Low stock to draft purchase order |
| Tasks `/dashboard/tasks` | PARTIAL | High: tasks in `review` or `cancelled` vanish from the board; Medium: "overdue" starts at 02:00 on the due date | Money-ranked tasks (value at stake from linked invoice/contact) |
| Documents `/dashboard/documents` | PARTIAL, with a dead end | High: UI accepts 9 file types the server rejects; contract-with-expiry likely fails processing (UNVERIFIED live); extracted invoice data has no consumer | "Turn this into a bill / invoice" action the pipeline comments promise |
| Creative assets `/dashboard/creative-assets` | PARTIAL | High: no audit rows on any mutation; Medium: unvalidated URL scheme and no server-side size cap | Delivered asset to invoice / client notification |

## Cross-cutting facts (apply to several pages)

- **Auth pattern**: the newer routes (`inventory`, `inventory/transactions`, `suppliers`, `tasks`, `tasks/[id]`, `documents/*`, `bookings/[id]/confirm|cancel`) use `withRoute` with an action mapped in `lib/auth/roleMatrix.ts:99-148`. The older routes (`bookings` GET/POST, `bookings/[id]` PATCH, `bookings/services`) use `guard()` and hand-rolled zod. The three `creative-assets` routes use `requireContext()` and a hand-rolled try/catch.
- **Rate limiting is opt-in** in `withRoute` (`rateLimit:` option, `lib/api/withRoute.ts:59`). Only `tasks` POST and `documents/upload` set it. `inventory`, `inventory/transactions`, `suppliers`, `bookings/*` internal routes have none.
- **1000-row PostgREST cap**: `inventory/page.tsx:25`, `suppliers/page.tsx:36`, `lib/ops/signal.ts:37`, `documents/page.tsx:48` (browser client) and the creative-assets list and contacts dropdown select without `.range()`/`allRows()`. Totals (stock value, low-stock count) silently truncate above 1000 rows. `lib/supabase/fetchAll.ts` (`allRows`) exists and is used correctly in `lib/calendar/events.ts:67`.
- **Soft delete**: columns exist for all of these tables (`20261005_soft_delete_columns.sql`). Where delete exists it is soft (tasks, documents, creative assets). Products, suppliers and bookings have no delete path at all.
- **Modal**: `components/ui/modal.tsx` uses native `<dialog>.showModal()`, so focus trap, Escape and aria-modal come from the browser. Only gap: the icon-only close button (`modal.tsx:51`) has no `aria-label`. Edge case: pressing Escape while a form is `loading` closes the dialog natively but `handleClose` refuses, so React `open` stays true and the "open" button then does nothing until reload (Low).
- **No stored derived total is wrong in the contacts.total_paid sense on these pages**, but see "Derived columns" under Inventory: `products.current_stock` is a stored counter with one atomic writer and several gaps.

---

## 1. Ops cockpit

**Purpose / data**: `app/dashboard/ops/page.tsx` calls `buildOpsIntel` (`lib/ops/signal.ts:31`). Reads `products(name,current_stock,reorder_level,cost_price,unit_price)`, `bookings(start_at,status,contact,service)` for the next 7 days, `tasks(status,due_date)`. All column names verified against `20260612_phase6_operations.sql`. Task status filter `not in (done,completed,cancelled)` is harmless: `completed` is not a valid task status (CHECK: todo/in_progress/review/done/cancelled), so it is dead but not wrong. `publishSignal('ops',...)` fires on every page render (`page.tsx:29`).

**Actions**: none. Pure links (Arsenal: "New booking" and "Add task" just navigate; "New booking" lands on a page that cannot create one, see Bookings).

**Verdict**: REAL as a read-only summary; the "Operator" lead line is a fixed if/else ladder (`page.tsx:34-44`), not AI and not actionable beyond a link.

**States**: no loading skeleton (server component, fine); no error handling: if any of the three queries errors, `data ?? []` makes the page say "Operations are smooth" (`signal.ts:48-50`, `page.tsx:43`). That is a false all-clear on DB failure (Medium; this repo has had auto-pausing DBs).

**Mobile/a11y**: vitals grid `grid-cols-2`, links are large blocks, OK. Arsenal links `py-2` (~36px, under 44px).

**Bugs**
- High: `lowStockItems` uses `current_stock <= reorder_level` with no `reorder_level > 0` guard (`signal.ts:54`). A product with stock 0 and reorder 0 (a service, a never-stocked item, the default for every new product) counts as "low stock" and turns health to `bad`. The API (`app/api/inventory/route.ts:41`) correctly requires `reorder_level > 0`, so Ops, the inventory page (`inventory/page.tsx:34`), the table badge (`InventoryTable.tsx:22`), the detail page (`[id]/page.tsx:82`) and the daily alert all disagree with the API. Also includes `active=false` products. This also drives the 06:30 notification (`opsAlerts.ts`) so owners get false alerts.
- Medium: `todayISO = now.toISOString().slice(0,10)` is the UTC date (`signal.ts:33`). Between 00:00 and 02:00 SAST "today" is yesterday, and `bookingsToday` filters on UTC date (`signal.ts:67`). Every other page uses `lib/time/sast`.
- Medium: bookings query includes `cancelled`/`no_show`/`completed` (`signal.ts:38-44`), so "Bookings today" and "next 7 days" count cancelled bookings, and the schedule shows them (page colours cancelled red, but the headline numbers still count them).
- Medium: `overdueTasks = new Date(due_date) < now` where due dates saved by the UI are midnight UTC of the picked date (02:00 SAST), so a task due today is "overdue" from 02:00 today.
- Medium: the "Open tasks" tile counts `review` as open (`signal.ts:79`) but the Tasks page does not show `review` tasks, so the tile and the board disagree.
- Low: `stockValueCost` treats null `cost_price` as R0, understating value without saying so.

**Gaps vs "ahead of its time"**
- (a) One-tap: the lead line says "Reorder before you run dry" but the button only navigates. Extend `app/dashboard/ops/page.tsx`, `lib/ops/signal.ts`. Effort M, value 5 (depends on the purchase-order build below).
- (b) Rands: no rand consequence anywhere ("stockout stops sales" with no figure). Compute `(unit_price - cost_price) * daily velocity * days to stock-out` in `signal.ts`. Effort S once velocity exists, value 4.
- (c) Explainability: tiles link to the page, not to the exact records ("3 low stock" should deep-link to a filtered list: the inventory table has a `low` filter but no URL param). Extend `InventoryTable.tsx` filter initial state from searchParams. Effort S, value 3.
- (d) Shadow mode / undo: none. `getTenantAutonomy` tiers exist (`lib/autonomy/tiers.ts`) for `low_stock_reorder_alert`; extend the tier to B (draft PO awaiting approval). Effort M, value 4.

---

## 2. Bookings

**Purpose / data**: `app/dashboard/bookings/page.tsx` shows this SAST week's bookings (Mon-Sun) from `bookings` joined to `booking_services`, `contacts(full_name)`, `staff(full_name)`, plus a services list. Columns and statuses match `20260612_phase6_operations.sql:154-170` (`pending|confirmed|cancelled|completed|no_show`; `source manual|widget|whatsapp|portal`). `deleted_at` added by `20261005_soft_delete_columns.sql`. Week bounds are SAST-correct (`page.tsx:22-42`), a good fix.

**Actions** (button -> route -> table)
- Confirm: form POST -> `/api/bookings/[id]/confirm` -> `bookings.status`. `withRoute`, role check (`bookings.write` = `manage_contacts`), audit `booking.confirmed`, tenant-scoped, only from `pending`, fires `adminos/booking.confirmed` once. No zod body (none needed). No rate limit.
- Cancel: form POST -> `/api/bookings/[id]/cancel` -> `bookings.status='cancelled'` only from pending/confirmed. `withRoute`, audit, tenant-scoped. No `cancelled_reason`, no customer notice (the dialog admits "The customer should be notified separately", `page.tsx:214`), no waitlist, no slot release logic.
- **There is no create-booking button, no create-service, no reschedule, no complete/no-show action in the UI.** `grep` of `app/` and `components/` for the bookings and services APIs finds only the API routes, `MyDay.tsx`, and this page. The ops "New booking" arsenal link and the empty state ("Set up bookings" -> `/dashboard/settings/onboarding`) lead nowhere that creates one. `bookings` rows can only come from the API (`POST /api/bookings`, `POST /api/book/[slug]`), i.e. from the mobile app (UNVERIFIED, not read) or WhatsApp (not live).
- API-only mutations: `POST /api/bookings` (`app/api/bookings/route.ts:54`), `PATCH /api/bookings/[id]` (can set any status incl. `completed`/`no_show`), `POST /api/bookings/services`. These use `guard()` and manual zod, and `PATCH`/`POST` write audit. `PATCH` has **no** `deleted_at` filter and **no** status-transition guard (can flip `cancelled` back to `confirmed` with no reminder; `bookings/[id]/route.ts:37-43`), and `.single()` on zero rows returns a DB error rather than 404. No rate limit.

**Public widget `POST /api/book/[slug]`** (`app/api/book/[slug]/route.ts`)
- Controls present: rate limit by slug+IP (`:57-59`, uses the shared `'api'` limiter, limit value UNVERIFIED), zod, phone validation, service must belong to tenant and be active, staff must belong to tenant, contact upsert, audit row.
- **No UI exists**: no page under `app/` calls `/api/book/`; middleware whitelists it (`middleware.ts:35`) but there is no `/book/[slug]` page. The "booking link" promised in copy has no landing page. (`app/api/widget/*` is the chat widget, not booking.)
- Missing controls: the client chooses `startAt` and `endAt` (no server-side duration from `booking_services.duration_minutes`, no `buffer_minutes`), so anyone can book 3 a.m., the past, next year, or a 10-year span. No business-hours or availability model exists anywhere (no table). `max_bookings_per_slot` is never read. Conflict check runs only when `staffId` is supplied (`:134`) and is check-then-insert with no DB exclusion constraint (no `EXCLUDE`/`btree_gist` in any migration), so two simultaneous requests double-book. Unassigned bookings never conflict at all. Status is `confirmed` immediately (no owner approval), so a bot can fill a week of calendar. No captcha/honeypot/per-phone throttle, no per-tenant cap; one IP rotation defeats the limiter. Each submission upserts a contact (spam pollutes CRM) and enqueues an Inngest function that sleeps until 24h before start.
- `POST /api/bookings`: same double-booking race, same unassigned-staff gap; `serviceId`/`contactId`/`staffId` are not checked to belong to the tenant (`bookings/route.ts:92-104`), unlike the public route. A cross-tenant UUID would be embedded back through the join on read (Medium; needs a known UUID).

**Timezone**: display is SAST-correct (`formatTime`, `sastDate`). Storage is `timestamptz`. The API trusts `z.string().datetime()` (UTC offsets). OK. Exceptions: Ops uses UTC date (see above). The reminder text says "tomorrow" regardless of actual distance (`bookingReminder.ts:107`); for a booking made 2 hours ahead the "24h reminder" fires immediately (sleep <= 0) and says "tomorrow".

**Reminder function** (`inngest/functions/bookingReminder.ts`): sleeps then re-checks status, good. Bugs: line 87-91 reads `contact.whatsapp_number`, which is not selected and not a column (the code comment at `:69` says `wa_id` is the identifier). Contacts with only `wa_id` (WhatsApp-origin contacts) are skipped as `no_phone_number`; `wa_id` is never used. High (affects exactly the WhatsApp-first customers). The fresh re-fetch at `:51-57` has no tenant filter (id is a UUID; Low). Default autonomy tier A sends via `sendAsTenant` (WhatsApp, not live): the send step will fail and retry twice (outcome depends on `sendAsTenant`, UNVERIFIED). Tier B/C use `notifyTenant` (in-app, works without WhatsApp), but tier B also sets `whatsapp: true`.

**Verdict: THIN.** Read/confirm/cancel is real; creating and managing bookings has no UI; the public widget is an API with no front end and no availability engine.

**States**: empty state exists (`:225-237`). No skeleton needed (server). Query has no `.limit`; a week of bookings will not hit 1000, but `/api/bookings` GET has no limit and defaults to now..+7 days with caller-supplied range. Errors: `bookingsResult.error` is ignored, so a DB error shows "No bookings this week" (the exact failure class the file comment describes). The Confirm/Cancel form posts navigate to the API URL; when a route throws (403, DB error) the user sees raw JSON on a blank page, and a successful no-op (already cancelled) gives no feedback.

**Week-only**: no previous/next week navigation, no past bookings view, no month. "This Week" counts include cancelled; no `completed`/`no_show` tiles even though the status variants exist.

**Mobile/a11y**: 6-column table in `overflow-x-auto` with no card fallback at 360px; Confirm/Cancel are `text-xs` links (~16px tall), well under 44px; `ConfirmSubmit` behaviour UNVERIFIED (component not read).

**Bugs ranked**
- Critical: no UI path to create a booking or a service; public booking link is a dead end. A product tab that cannot receive its core input.
- High: public API accepts arbitrary start/end/duration, no availability/capacity/hours; check-then-insert race; unassigned bookings never conflict; no `EXCLUDE` constraint.
- High: reminder skips `wa_id`-only contacts (`bookingReminder.ts:87,91`).
- High (dependency): tier-A reminders depend on WhatsApp.
- Medium: `PATCH /api/bookings/[id]` no transition guard, no soft-delete filter; ids in POST not tenant-verified; no `cancelled_reason` captured; raw JSON error pages from form posts; DB error looks like empty week; "tomorrow" text wrong for short notice.
- Medium: nothing ever moves a past `confirmed` booking to `completed`/`no_show`; UI cannot do it either, so the status data that a no-show feature needs does not exist.
- Low: Cancel offered on past bookings.

**Gaps**
- (a) One-tap: confirm-all-pending and "send reminder now" buttons; "this slot just freed up, offer to waitlist". Files: `bookings/page.tsx`, new `app/api/bookings/[id]/complete|no-show/route.ts`. Effort M, value 4.
- (b) Rands: show `booking_services.price` at risk for pending/unconfirmed and no-shows ("R1 450 of this week is unconfirmed"). The price is already joined (`page.tsx:77`). Effort S, value 4.
- (c) Explainability: counts are not clickable. Effort S, value 2.
- (d) Undo: cancel is final; add "restore" (status back, only if no conflict). Effort S, value 3.
- **No-show risk**: data to compute it: `contact_id` plus historic `bookings.status` per contact, `source`, lead time (`created_at` vs `start_at`), `reminder_sent_at`. Blocking issue: nothing can set `no_show`/`completed` in the UI and nothing auto-completes, so today the history is empty. Build order: (1) complete / no-show buttons, (2) nightly job marking past confirmed as `completed` unless flagged, (3) risk score = no-show rate of contact + short-notice + never-confirmed, shown as chip with rand value at risk, (4) tier-B action "send confirm-or-cancel nudge" (WhatsApp, so depends on WhatsApp). Files: `bookings/page.tsx`, new `lib/ops/noShowRisk.ts`, `inngest/functions/bookingReminder.ts`. Effort M-L, value 4.
- **Waitlist fill**: no table (`waitlist`) exists. Needs a `booking_waitlist(tenant_id, service_id, contact_id, wanted_from, wanted_to, status, deleted_at)` migration, an insert from the public route when a slot is full (requires the availability engine first), and a hook in `cancel/route.ts` that offers the freed slot to the first waiting contact. Depends on WhatsApp/email to notify, so in-app only today. Effort L, value 3.

---

## 3. Calendar

**Purpose / data**: `app/dashboard/calendar/page.tsx` + `lib/calendar/events.ts` aggregate `leave_requests`, `invoices` (via `OWED_INVOICE_STATUSES`), `bookings` (not cancelled), `compliance_items` (status `upcoming|due|overdue`), `professional_licenses`, `contracts` (signed/partially_signed). Column names look consistent with migrations I read (phase 6/8, compliance activation). `compliance_items.status` values `upcoming|due|overdue` could not be verified from the migration I read (it shows `completed`, `not_applicable` as terminal values only); **UNVERIFIED**. Invoices use `allRows` paging correctly. Bookings are SAST-bounded correctly.

**Actions**: none (read-only). Month nav via links with `aria-label`. Gate: `approve_leave` permission (`page.tsx:36`), so a manager with `manage_inventory`/`manage_contacts` but not `approve_leave` is told the page does not exist. Intent is documented; acceptable but surprising.

**Verdict**: REAL (read-only). Not a scheduler: nothing can be added from here.

**States**: no error handling: a failed source query silently contributes zero events (all `Promise.all` results use `?.data ?? []`). No loading skeleton (server). Empty day text exists.

**Bugs**
- Medium: selecting a day that has no events snaps back to today/1st of month: `params.day && byDate.has(params.day) ? ... : today` (`page.tsx:50-52`). Clicking an empty day shows the wrong day's events. Fix: validate the date format, not `byDate.has`.
- Medium: tasks (with `due_date`), supplier payments and stock-out dates are not on the calendar; documents with `expiry_date` (contract documents from the pipeline) are not either; `contracts` is a different table from contract `documents`.
- Low: leave events have `href: '/dashboard/calendar'` (self-link); the unified view loses the record link.
- Low: invoice subtitle uses `amount`, not `amount_due`, so a partly-paid invoice shows the full amount (`events.ts:130`). Rand consequence is overstated.

**Mobile/a11y**: grid is `min-w-[640px]` inside `overflow-x-auto`: horizontally scrolls at 360px by design (comment at `page.tsx:84`), no agenda/list fallback. Day cells are `<Link>` with no accessible name beyond the number and event dots (screen reader hears only the day number). Month arrows are `p-2` icons (~32px, below 44px).

**Gaps**: (a) "Add booking/task on this day" from the day panel. Effort M, value 3. (b) Rands: show total invoice value due per day. Effort S, value 3. (c) already clickable per event (good) but leave events are not. Effort S. (d) none. Files: `lib/calendar/events.ts`, `calendar/page.tsx`.

---

## 4. Suppliers

**Purpose / data**: `suppliers` table (`20260612_phase6_operations.sql:218-235`): name, category, phone, email, contact_person, `payment_terms`, rating, `is_community_verified`, `bbbbee_level`, `women_owned`, `youth_owned`. `deleted_at` added. Page selects exactly these (`suppliers/page.tsx:38`). All names verified. Stats tiles are computed in the page from the rows (no stored totals, so no derived-column drift). `rating` and `is_community_verified` have no writer in any UI or API (the create schema omits them): permanently null/false (Low, but the "Community" badge and filter can never appear). The create API's field `bbbbeeLlevel` has a typo kept as a "shipped contract" (`route.ts:15`).

**Actions**: Add supplier (`AddSupplierModal` -> `POST /api/suppliers`): `withRoute`, `suppliers.write`, zod, audit `supplier.created`, tenant-scoped insert. No rate limit. **No edit, no delete, no archive** (no PATCH/DELETE route exists; hard delete not offered either). A typo in a supplier's B-BBEE level can never be corrected. The page's empty-state action `?new=1` is handled by `useOpenOnParam` in the modal (UNVERIFIED, not read).

**Verdict: THIN.** A well-modelled address book with SA procurement flags. It is not connected to anything: no product link, no spend (no `supplier_id` in any migration; `grep supplier_id|purchase_order|lead_time` over migrations returns nothing), no expense link. The B-BBEE message ("what that spend does for your scorecard") claims a spend relationship that does not exist; the tiles count suppliers, not spend (misleading copy, Medium).

**States**: empty state good; no pagination (list capped by PostgREST 1000, API caps 500); `overflow-x-auto` table without card fallback.

**Bugs**: High: cannot edit or archive. Medium: B-BBEE copy implies spend tracking. Low: duplicate suppliers not prevented (no unique key); `website` accepts any URL scheme via `z.string().url()` (rendered nowhere on the page, but returned by API).

**Gaps**
- Link `products.supplier_id` + `products.lead_time_days` + `suppliers.lead_time_days`; add `purchase_orders` + `purchase_order_lines` (see Inventory). Effort M, value 5.
- (b) Rands: spend per supplier from expenses/POs and B-BBEE recognition value ("R84 000 spent with level 1-4 suppliers"). Needs a supplier link on `expenses` (not read; UNVERIFIED whether a column exists). Effort M, value 4.
- (c)/(d): n/a until spend exists.

---

## 5. Inventory (+ `[id]`)

**Purpose / data**: `products` (`name,sku,category,unit,current_stock,reorder_level,reorder_quantity,cost_price,unit_price,active,deleted_at`) and `inventory_transactions` (type CHECK `receive|sell|adjust|return|damage|transfer`). All names verified. List page shows KPIs (SKUs, low-stock count, stock value at cost and retail) computed in the page; table via `DataTable` (client-side search, filter, sort, CSV, `pageSize=25`). Detail page shows the last 50 ledger rows.

**Derived columns audit**
- `products.current_stock`: stored counter. Single writer `adjust_product_stock` (`20261005_money_sweep.sql:20-33`), called from `lib/inventory/stock.ts`, `app/api/inventory/transactions/route.ts:55`, `app/api/invoices/route.ts:148`. No trigger keeps it in step with `inventory_transactions` (no triggers on either table in any migration). Divergence paths:
  1. Product created with `currentStock > 0` writes **no ledger row** (`inventory/route.ts:59-71`), so ledger sum never equals stock. No "opening balance" transaction.
  2. Invoice route: stock is decremented, then the ledger insert failure is only `console.error`ed (`invoices/route.ts:231-235`): stock moved, no ledger row.
  3. Manual transaction compensation (`transactions/route.ts:78-82`) swallows its own failure (`.catch(() => null)`), leaving stock changed with no ledger row.
  4. Cancelling, voiding or deleting an invoice never calls `adjustStock` (`grep adjustStock` finds only the two writers above), so stock sold on a cancelled invoice is lost permanently until someone books a manual "return".
  5. Quick Sale and a manual `sell` transaction both exist as independent decrement paths with no shared reference. Recording a sale in both double-decrements; nothing links the two or warns (Medium).
  6. There is no reconcile job comparing stock to the ledger sum.
- `unit_cost` on `receive` is stored on the ledger row but never updates `products.cost_price`, so "Stock value (cost)" uses a stale price. No weighted average.
- `reorder_quantity`: accepted by `POST /api/inventory` (`route.ts:17`) but the Create modal never sends it (`CreateProductModal.tsx:35-44`) and no code reads it (`grep` over `lib/` and `app/` finds only the schema line). It is a dead column today.
- Stock value and low-stock counts are computed live from rows, not stored (good), but truncate at 1000 products.

**Actions**
- New product: modal -> `POST /api/inventory`: `withRoute`, `inventory.write`, zod (non-negative ints, max), audit `product.created`, tenant-scoped. No rate limit. Duplicate SKU: `UNIQUE(tenant_id, sku)` is not partial on `deleted_at`, so a soft-deleted SKU can never be reused (Low; and no delete exists anyway).
- Record transaction: modal -> `POST /api/inventory/transactions`: `withRoute`, zod (`quantity != 0`, `|q| <= 1,000,000`), audit `inventory.moved`. **Atomic**: `adjustStock` does the arithmetic and `>= 0` check in one `UPDATE ... WHERE current_stock + delta >= 0` (race-free; negative stock impossible). Ledger row follows, with rollback of the stock move on insert failure. Types sign handling: `OUT = sell|damage|transfer`, `IN = receive|return`, `adjust` keeps sign (`transactions/route.ts:36-49`). The UI sends a positive qty for non-adjust types and a signed qty for adjust, matching. Good. No rate limit.
- **No edit product, no delete product, no deactivate.** There is no `PATCH /api/inventory/[id]`, no `DELETE`. Prices, reorder level, name, category cannot be changed after creation. The `products.active` column exists and `GET` filters on it but nothing sets it.
- `GET /api/inventory`: `.limit(1000)`, no pagination. `GET /api/inventory/transactions`: limit 200, no cursor; `from`/`to` are strings compared to `created_at` (OK).
- Race / double-decrement summary: concurrent sales are safe; the double count risks are logical (manual sell + Quick Sale), not concurrency.

**Verdict: PARTIAL.** Stock arithmetic is the best-engineered part of this cluster. The product catalogue is create-only, the reorder fields are not usable, and the ledger/counter can drift.

**States**: empty state good (`InventoryTable.tsx:121-129`; its action `href: '?new=1'` relies on the modal's URL hook). No loading skeleton (server). `rawItems` error is ignored (`inventory/page.tsx:25`): a DB error renders "No products yet". The detail page uses `.single()` and `notFound()` on any error, hiding DB errors as 404. Unbounded product query (1000 cap). The detail page ledger is cut at 50 rows with no "load more".

**Mobile/a11y**: `DataTable` has `overflow-x-auto` (line 368), no card fallback; 8 columns at 360px scroll horizontally. "New product" and "Record Transaction" buttons are `py-1.5` (~30px, below 44px). `DataTable` has aria-labels for search, filters and pagination (good). Colour-only low-stock cue is backed by a text badge (good).

**Bugs ranked**
- High: no edit/delete/deactivate product.
- High: invoice cancel/void/delete does not restock; opening stock and failed ledger inserts desync ledger from counter.
- High (shared with Ops): low-stock rule flags `reorder_level = 0` items and inactive items; disagrees with the API.
- Medium: `receive` cost does not feed `cost_price`; `transfer` just subtracts (no destination); `reorder_quantity` unreachable; truncation at 1000; DB errors look like empty/404.
- Low: SKU reuse after soft delete; no rate limit.

**Gaps**
- **Low stock -> draft purchase order** (the headline). Data that exists: `products.reorder_level`, `products.reorder_quantity` (never read), `cost_price`, `current_stock`, `inventory_transactions` rows of type `sell` with timestamps (sales velocity), invoice `line_items` (also velocity), `suppliers.email/phone/payment_terms`, daily alert cron (`opsAlerts.ts`), autonomy tier `low_stock_reorder_alert` (alert-only, tier A). Data that does **not** exist: product-to-supplier link, supplier lead time, supplier price per product, any `purchase_orders` table, a way to print/send a PO (email is down; WhatsApp not live; a PDF/print/copy-text PO works in-app). Build: migration adding `products.supplier_id`, `products.lead_time_days`, `purchase_orders`, `purchase_order_lines` (with `deleted_at`, `status draft|sent|received`); `lib/inventory/reorder.ts` computing velocity over the last 30 days from `inventory_transactions`, suggested qty = `max(reorder_quantity, velocity * (lead_time + cover_days) - on_hand)`; a "Draft PO" button on the low-stock card that creates a draft per supplier, shows the reason ("sold 42 in 30 days; 3 left = 2 days cover; supplier lead time 5 days") and the rand cost (qty x cost_price) and rand revenue at risk; "Receive PO" writes `receive` transactions through `adjustStock`. Files to extend: `app/dashboard/inventory/page.tsx`, `InventoryTable.tsx`, `CreateProductModal.tsx` (send `reorderQuantity`, supplier), new `app/api/purchase-orders/*`, `inngest/functions/opsAlerts.ts` (tier B: create draft instead of just a notice), `lib/ops/signal.ts`. Effort L, value 5. Shadow mode comes free: PO created as `draft`, tier B means owner approves; undo = delete draft (soft).
- (b) Rands: "R12 400 of stock sits below reorder" and "R3 100 margin at risk this week". Effort S, value 4.
- (c) Make each KPI clickable to the exact filtered rows and show the formula. Effort S, value 3.
- (d) Undo for a stock movement: a reversing transaction with `reference = original id` (nothing today; `adjust` is the manual route). Effort S, value 3.
- Stocktake mode, product edit, restock-on-cancel: required fixes before any of the above (see ranked list).

---

## 6. Tasks

**Purpose / data**: `tasks` (`title,description,status todo|in_progress|review|done|cancelled,priority urgent|high|medium|low,due_date timestamptz,assigned_to -> staff(id),source,project_id,contact_id,invoice_id,document_id,completed_at,created_by,deleted_at`). `assigned_to` FK was corrected to `staff(id)` in `20260918_fix_tasks_assigned_to_fkey.sql`; code uses staff ids consistently. Columns verified. Page: server component, `limit(1000)` ordered by newest, sorted in JS by `compareTasks` (urgent first, soonest due).

**Derived columns**: none stored (counts computed live). `completed_at` is maintained by the PATCH route (`tasks/[id]/route.ts:61-64`). Good.

**Actions**
- New Task: modal -> `POST /api/tasks`: `withRoute`, `tasks.write` (= any member), zod, rate limit `api`, audit `task.created`, assignee verified as tenant staff, notify via `after()`. `contactId`/`invoiceId`/`projectId` are accepted and **not** verified to belong to the tenant (`tasks/route.ts:76-91`; Medium). `source` is client-settable to values like `agent_chase`, so a user can forge system-originated tasks (Low).
- Move: `MoveTaskButton` -> `PATCH /api/tasks/[id]`: `withRoute`, audit `task.updated`, ownership check (`loadEditable`: manager, creator or assignee), tenant-scoped, soft-delete aware.
- Delete: `DELETE /api/tasks/[id]` exists, soft delete, audited, but **no UI** calls it. No edit UI either (title, priority, due date, assignee cannot be changed from the board though the API supports it). Comments route exists (`tasks/[id]/comments`, not read; **UNVERIFIED**), no UI.
- Nothing creates tasks automatically in app code: `from('tasks')` appears only in the tasks routes, `me/route.ts` and the Ops signal (read). The schema's `source` values `agent_chase`, `document_expiry`, `contract_expiry`, `payroll`, `onboarding` have no producer in `inngest/` or `lib/` (UNVERIFIED for `app/api/langa|agents`, not read). So "ones Langa raises for you" (empty-state copy, `tasks/page.tsx:224`) is unproven here.

**Verdict: PARTIAL.** A usable personal kanban; no automation, no money, no edit/delete UI.

**States**: empty state exists. No loading skeleton (server). Move failures are `console.error` only; the user sees nothing (`TaskActions.tsx:222-226`). Create error is shown in the modal. Query limit 1000 sorted newest-first: with more than 1000 historical tasks, old but still-open tasks fall off the board.

**Bugs ranked**
- High: tasks with status `review` or `cancelled` are loaded and counted in the subtitle total (`allTasks.length`, `page.tsx:188`) but displayed in none of the three columns (`:175-177`). They disappear. `review` is a legal status the API and Ops treat as open. Also `todo + inProgress` "open" excludes review, so Tasks and Ops tile disagree.
- Medium: the move button cycles `done -> todo` (`TaskActions.tsx:21-25`): one mis-tap on a Done card reopens it (and nulls `completed_at`).
- Medium: overdue from 02:00 SAST on the due date (UI converts a date to UTC midnight, `TaskActions.tsx:75`; page compares to `now`, `page.tsx:75,181`). Should compare against SAST end of due day.
- Medium: ids not tenant-verified on create (above).
- Medium: no feedback on failed move.
- Low: a "!" banner uses `text-red-400` on `bg-red-50` (low contrast; forced `on-light` class suggests intentional light-surface styling, UNVERIFIED). Move button `py-1 px-2` ~24px tall, under 44px; `title` only (no aria-label). Assignee name `max-w-[80px]` truncates.

**Mobile**: single column `grid-cols-1` on phones (good, no table).

**Gaps**
- Tasks created and ranked by money at stake: `tasks.invoice_id` and `tasks.contact_id` exist but are never populated by the UI or shown. Add: (1) accept `invoiceId` in the modal (pick an overdue invoice), (2) in `compareTasks` (`lib/ops/tasks.ts`) rank by priority then rand value at stake joined from `invoices.amount_due`, (3) show "R4 200 at stake" chip on cards, (4) producers: debt recovery, low stock, booking no-show, expiring document each insert a task with the rand value (source enum already supports `agent_chase`, `document_expiry`, `contract_expiry`; add `stock_reorder`, `booking_followup`). Needs a nullable `value_at_stake numeric` column for non-invoice sources. Files: `lib/ops/tasks.ts`, `app/api/tasks/route.ts`, `tasks/page.tsx`, `TaskActions.tsx`, new migration. Effort M, value 5.
- (a) One-tap: "Do it" on a task, e.g. chase invoice task -> opens prefilled reminder (WhatsApp dependent) or marks promised. Effort M, value 4.
- (c) Chip links to the invoice/contact/product. Effort S, value 3.
- (d) Undo toast on move/delete (soft delete exists). Effort S, value 3.

---

## 7. Documents

**Purpose / data**: `documents` (`original_filename,file_type enum,storage_url,extracted_text,doc_category enum,document_type text,ai_summary,extracted_goals,extracted_data jsonb,expiry_date,key_parties,key_obligations,processing_status enum pending|processing|done|failed,is_reference,uploaded_by,deleted_at`). Base columns in `supabase/schema.sql:274-287`; extras added by `002_v2_architecture.sql:130-136`; `file_type` enum extended with `'text'` by `20261006_document_file_type_text.sql` (**UNVERIFIED that it is applied to prod**; without it every txt/md/rtf/json/xml/pptx would hit an invalid enum value). `goals` panel reads `goals`. The page is a client component using the **browser Supabase client** (RLS, not `supabaseAdmin`) for list queries (`documents/page.tsx:48-49`), so tenant isolation rests on RLS; layout gates on `manage_documents` (`layout.tsx`).

**Actions**
- Upload (drag/drop or choose) -> `POST /api/documents/upload`: `withRoute`, `documents.write`, rate limit `api`, audit `document.uploaded`, 10 MB cap, MIME allow-list, tenant-namespaced storage path, safe filename. Under 5 MB it processes inline (awaits AI within `maxDuration=60`); larger goes to Inngest `docIntelligencePipeline`. Pipeline is metered (`checkBudget`), validates JSON output, does not auto-create receivables. Good.
- Open file -> `GET /api/documents/upload?path=` -> signed URL 1h, verified to be a live row of the tenant (good).
- Delete: `DELETE /api/documents/[id]` soft delete + audit, **no UI button**.
- No rename, categorise, tag, link-to-contact, or search.

**Verdict: PARTIAL with a dead end.**

**Bugs ranked**
- High: file-type promise mismatch. `ACCEPTED` and the info cards list `.doc .xls .pptx .md .rtf .gif .heic .json .xml` and "Numbers" (`page.tsx:30-34,173-177`), but the server allow-list (`upload/route.ts:15-24`) permits only pdf, docx, xlsx, csv, txt, jpeg, png, webp. Everything else returns 415. The page's own comment says the lists must match; they do not. Also the server trusts the browser-reported `file.type`; on Windows with Excel installed `.csv` often arrives as `application/vnd.ms-excel` and `.md` as `text/markdown`, both 415 (Medium, UNVERIFIED in browser).
- High (likely, UNVERIFIED against live DB): `trg_contract_expiry` (`002_v2_architecture.sql:300-324`) fires `AFTER INSERT OR UPDATE OF expiry_date` and its body reads `NEW.file_name`, a column `documents` does not have (it is `original_filename`). The pipeline sets `expiry_date` and `document_type='contract'` in one update (`pipeline.ts:262,277-286`), so for any contract where the model finds an end/renewal date, the trigger should raise `record "new" has no field "file_name"`, the update rolls back, and the document ends `failed` ("Processing failed"). The sibling `fn_trigger_doc_pipeline` had exactly this bug and was patched live on 2026-08-19 (`20260819_fix_doc_pipeline_trigger.sql`); no migration patches the contract one. It may have been fixed directly in prod; verify with `SELECT prosrc FROM pg_proc WHERE proname='fn_trigger_contract_expiry'`.
- High (dead end): the pipeline header says the owner "chooses what it is (a bill to pay -> expense, or an invoice they issued -> AR) from the Documents page" (`pipeline.ts:20-22`). The Documents page has no such control; `extracted_data` and `documents.expiry_date` are read nowhere in `app/` (only `licenses` use an `expiry_date` of their own) or `inngest/`. Extracted invoice amounts, contract end dates and obligations are stored and never surfaced or acted on. The contract-expiry alert queued by the trigger uses `workflow_type='contract_expiry_alert'`, which `processQueue.ts` `EVENT_MAP` does not contain, so it would fail even if it fired.
- Medium: every upload also enqueues a `workflow_queue` row of type `document_uploaded` from `trg_document_processing` (`20260819_fix_doc_pipeline_trigger.sql:23-46`), but `processQueue.ts` maps only `doc_pipeline` (`EVENT_MAP`, line 8). Each upload therefore leaves a `failed` queue row with "Unknown workflow_type: document_uploaded" (noise that can trip the workflow monitor). If someone "fixes" the map name, the document would be processed twice (inline plus Inngest). Also `processQueue` writes status `complete`; confirm the monitor counts `complete` not `completed` (not read; **UNVERIFIED**).
- Medium: stuck `processing` rows poll every 4 s forever (`page.tsx:66-72`), no timeout; a stuck row also keeps firing network requests on a phone.
- Medium: `uploaded_by` shows the raw user UUID (`page.tsx:242`).
- Low: files are accepted on declared MIME only (no magic-byte check, no virus scan); no pagination (1000 cap) and no search or filter for a document store; image preview uses an emoji. Download button text is the filename, a `<button>` (OK), no aria text.
- Low: upload drop-zone is a clickable `div` with no keyboard role; a separate "Choose file" button is the keyboard path (acceptable).

**States**: empty state good; upload progress text; failure text. No loading state on first fetch (blank list before data; shows the "No documents yet" empty state while loading, a flash). Error on `loadData` ignored.

**Mobile/a11y**: list is block-based (no table), good. Drag-and-drop zone padding ok. Tap target of "Choose file" is `size="sm"`.

**Gaps**
- (a) "Turn this into a bill / an invoice": from a processed invoice document show counterparty, amount, due date, direction guess, and two buttons (Record as expense to pay / Create receivable), reason shown ("addressed to you, from Acme, R12 400 due 30 Oct"). Files: `documents/page.tsx` (split to a server list + client row actions), new `app/api/documents/[id]/convert/route.ts`, reuse expense and invoice creators. Effort M, value 5.
- (b) Rands: show amount and due date on the row; total "R48 000 of bills awaiting a decision". Effort S, value 4.
- (c) Link each extracted number to its source document and highlighted text. Effort L, value 2.
- (d) Shadow/undo: "convert" creates a draft expense; undo = soft delete. Effort S, value 3.
- Document -> contact link: no `contact_id` on documents. Add and fill from `counterparty` via fuzzy match. Effort M, value 3.
- Contract expiry -> calendar + task: write `expiry_date` onto `compliance_items` or emit a task `source='contract_expiry'` from `pipeline.ts`, and show on `lib/calendar/events.ts`. Effort S-M, value 4.

---

## 8. Creative assets

**Purpose / data**: `creative_assets` (`20260814_creative_assets.sql`, not re-read in full): title, category (`audio|voice_over|soundtrack|video_long|video_short|finished_work`), status (`draft|in_review|approved|delivered`), `storage_mode hosted|external`, Cloudinary fields or external URL/provider, `contact_id`, notes, `deleted_at`. Page and Zod enums agree on category/status/provider values (I did not open the migration CHECKs; **UNVERIFIED** that they match). Contacts dropdown uses the browser client with `name:full_name` alias (correct) and no limit.

**Actions**
- Upload: page requests `/api/creative-assets/upload-signature` -> uploads **directly browser -> Cloudinary** -> `POST /api/creative-assets` to record. Link-instead mode records an external URL. Status `<select>` -> `PATCH`. Remove `✕` -> `DELETE` (soft delete, `[id]/route.ts:58`).
- Route pattern: `requireContext` + `ctx.require('manage_documents')`, zod, tenant scope via `ctx.db` (RLS) on PATCH/DELETE and explicit `tenant_id` on GET/POST. **No `withRoute`, and no audit rows on create, update, status change or delete**; no rate limit on PATCH/DELETE (POST and signature have `api`).

**Verdict: PARTIAL.** Real bookkeeping of deliverables (tracking, not delivery). "Delivered" is a label: nothing is sent, invoiced or notified.

**Bugs ranked**
- High: no audit trail for deliverable status changes or deletions (the status "delivered/approved" is a business-critical record for creators).
- Medium: `external_url`/`cloudinary_url` use `z.string().url()` with no scheme restriction and no check that a hosted URL points at this tenant's folder (`adminos/{tenantId}/creative-assets`). A `javascript:` URL saved by one user is opened with `window.open(url)` by another (`page.tsx:193-196`). Zod's `url()` accepts any parseable scheme (**UNVERIFIED** for the installed zod version; check `package.json`). Restrict to `https:` and, for hosted, require the Cloudinary host and tenant folder prefix.
- Medium: no server-side size limit; the signature signs only `folder` and `timestamp` (`lib/cloudinary/signature.ts:55`), so the 100 MB cap is client-side only. A hostile or buggy client can upload any size to your Cloudinary account.
- Medium: `load()` does `fetch(...).then(r => r.json())` (`page.tsx:57`); the API returns plain text for 401/403 (`'Forbidden'`), so `.json()` throws, `load` rejects and `loading` stays true forever (blank list, no error). Same pattern on status updates: results ignored, no error shown.
- Medium: `contact_id` not verified to be a tenant contact on POST/PATCH (RLS only guards `tenant_id` of the row itself).
- Low: remove button is an unlabeled `✕` (title only, no `aria-label`), no confirmation; status `<select>` has no label; filter pills ~30px tall; the `PATCH` returns 500 via `.single()` when the row id is not visible.
- Low: whole list unpaginated; `DELETE` returns 204 even for ids that match nothing.

**States**: empty state good; `loading` hides the list but shows no skeleton or spinner; errors shown for upload; not for list or status.

**Mobile**: card list, no table; add form is `grid-cols-1 md:grid-cols-2`. OK.

**Gaps**
- (a) "Mark delivered and invoice/notify the client" (one tap, reason shown: "linked to Contact X, quote R8 500"). Needs `creative_assets.invoice_id` or contact -> open invoice lookup. Files: `creative-assets/page.tsx`, `app/api/creative-assets/[id]/route.ts`, invoice creation helper. Effort M, value 4 (delivery without invoice is the core leak for creators; depends on email/WhatsApp to notify, but the invoice itself is in-app).
- (b) Rands: show project value per asset and "R x delivered but not invoiced". Effort S, value 3.
- (c)/(d): audit rows give undo history; add restore. Effort S, value 2.

---

## Cross-page loops

Exist today
- Invoice / Quick Sale -> stock decrement (atomic) + ledger row (`invoices/route.ts:140-155,229-236`).
- Low stock -> daily in-app notification (`opsAlerts.ts`, 06:30 SAST), with WhatsApp only when tier allows (not live).
- Booking created/confirmed -> 24 h reminder function (reminder send depends on WhatsApp).
- Calendar aggregates bookings, invoices due, leave, compliance, licences, contracts.
- Ops cockpit aggregates stock, bookings, tasks.

Missing
- Low stock -> task (no producer) -> supplier -> purchase order -> receive stock -> expense.
- Supplier -> product / spend / B-BBEE recognition (no link).
- Booking completed -> invoice (no link; `bookings` has no `invoice_id`); booking no-show -> follow-up task; booking cancel -> waitlist.
- Invoice cancel / void -> restock.
- Document (invoice) -> expense or receivable (promised, absent); document (contract) -> calendar and task; document -> contact.
- Task -> invoice / contact (columns exist, UI absent); task due dates not on Calendar.
- Creative asset delivered -> invoice / client notification.
- Public booking page -> bookings (API exists, page does not).

---

## RANKED fix-and-build list

### A. Bugs (fix first)

| # | Sev | Item | Files | Effort |
|---|---|---|---|---|
| 1 | Critical | No UI to create a booking or service; public booking link has no page. Build "New booking" (contact, service, staff, time with duration from the service) and a services settings form; then the public `/book/[slug]` page | `app/dashboard/bookings/page.tsx` (+ new client components), `app/api/bookings/services/route.ts`, new `app/book/[slug]/page.tsx` | L |
| 2 | High | Public booking API accepts any start/end; no hours, capacity, duration, buffer; check-then-insert double-booking (also `POST /api/bookings`). Server computes `end_at` from the service, validates against availability, add `EXCLUDE USING gist` (staff_id, tstzrange) migration or an advisory-lock RPC, default new widget bookings to `pending`, per-phone and per-tenant caps | `app/api/book/[slug]/route.ts`, `app/api/bookings/route.ts`, new migration | L |
| 3 | High | Low-stock rule flags `reorder_level = 0` and inactive products on Ops, Inventory, detail and alert; align everything on `reorder_level > 0 AND active` (one shared helper) | `lib/ops/signal.ts:54`, `inventory/page.tsx:34`, `InventoryTable.tsx:22`, `inventory/[id]/page.tsx:82` | S |
| 4 | High | Invoice cancel/void/delete does not restock; opening stock writes no ledger row; failed ledger insert after stock move is only logged | `app/api/invoices/*` (cancel path), `app/api/inventory/route.ts`, `invoices/route.ts:231` | M |
| 5 | High | Product catalogue is create-only: add `PATCH /api/inventory/[id]` (name, prices, reorder level/qty, active) and soft-delete, with UI | new `app/api/inventory/[id]/route.ts`, `InventoryTable.tsx`, detail page | M |
| 6 | High | Documents UI/server file-type mismatch (9 extensions advertised, rejected) and MIME fragility on Windows CSV/MD | `documents/page.tsx:30-34,173-177`, `app/api/documents/upload/route.ts:15-24` | S |
| 7 | High (verify) | `fn_trigger_contract_expiry` references nonexistent `NEW.file_name`; contracts with an end date likely end `failed`. Verify in prod then ship a fixing migration; also map or drop `contract_expiry_alert` / `document_uploaded` queue types | new migration, `inngest/functions/processQueue.ts:4-11` | S |
| 8 | High | Tasks in `review`/`cancelled` vanish; add a Review column (or fold into In Progress) and a cancelled filter; make the subtitle count match the visible board | `app/dashboard/tasks/page.tsx:175-188` | S |
| 9 | High | Booking reminder ignores `wa_id`; `whatsapp_number` is a nonexistent field | `inngest/functions/bookingReminder.ts:72,87,91` | S |
| 10 | High | Creative assets: no audit rows on any mutation; restrict URL schemes and hosted-URL host/folder; enforce size/format in the Cloudinary signature params; handle non-JSON errors in `load()` | `app/api/creative-assets/*`, `lib/cloudinary/signature.ts`, `creative-assets/page.tsx` | M |
| 11 | High | Suppliers cannot be edited or archived; add `PATCH`/`DELETE(soft)` | `app/api/suppliers/[id]/route.ts` (new), `SuppliersTable.tsx` | M |
| 12 | Medium | `PATCH /api/bookings/[id]`: status transition guard, soft-delete filter, 404 on missing; verify ids belong to tenant on `POST /api/bookings` and tasks create | `app/api/bookings/*.ts`, `app/api/tasks/route.ts` | S |
| 13 | Medium | Ops: use SAST date; exclude cancelled/no_show from "today" and "next 7 days"; distinguish query error from "all clear"; overdue measured at SAST end of due day (also Tasks page) | `lib/ops/signal.ts`, `tasks/page.tsx` | S |
| 14 | Medium | Calendar: empty-day click snaps to today; invoice subtitle should be `amount_due` | `calendar/page.tsx:50`, `lib/calendar/events.ts:130` | S |
| 15 | Medium | Tasks: done->todo accidental reopen; surface move failures; add edit/delete UI | `TaskActions.tsx`, `tasks/page.tsx` | S |
| 16 | Medium | 1000-row cap on products, suppliers, documents, creative assets; use `allRows` or paginate | pages listed in cross-cutting | S-M |
| 17 | Medium | Form-post Confirm/Cancel give raw JSON on error and no feedback; convert to client buttons with toast, record `cancelled_reason`, add "complete" and "no-show" actions | `bookings/page.tsx`, API | M |
| 18 | Medium | Documents: `uploaded_by` UUID displayed; stuck `processing` polls forever; delete UI missing | `documents/page.tsx` | S |
| 19 | Low | Modal close button `aria-label`; tap targets (<44px) on Bookings Confirm/Cancel, inventory buttons, task move button, calendar arrows; card fallbacks for bookings and inventory tables at 360px; add rate limits to inventory, suppliers and bookings write routes | `components/ui/modal.tsx:51`, pages | S-M |

### B. Gaps (build in this order)

| # | Value | Effort | Item | Why / files |
|---|---|---|---|---|
| 1 | 5 | L | Low stock -> draft purchase order (supplier link, lead time, velocity-based qty, rand cost and margin at risk, tier-B draft, receive-PO into ledger) | needs fixes A3-A5 first; `lib/inventory/reorder.ts`, new `purchase_orders` migration and routes, `opsAlerts.ts`, inventory UI |
| 2 | 5 | M | Documents: "record as expense / create receivable" action on extracted invoice data, contract expiry to calendar + task | A6, A7 first; `documents/page.tsx`, new convert route, `pipeline.ts`, `lib/calendar/events.ts` |
| 3 | 5 | M | Tasks ranked and created by rands at stake (`value_at_stake`, invoice link, producers: debt chase, low stock, expiring docs) | `lib/ops/tasks.ts`, tasks routes and UI, new column |
| 4 | 4 | M-L | Booking no-show risk + complete/no-show tracking + nightly auto-complete, rand value at risk, confirm nudge | needs A1, A17; `lib/ops/noShowRisk.ts`, `bookingReminder.ts` |
| 5 | 4 | S | Rand consequence lines everywhere (stock below reorder, unconfirmed bookings, unprocessed bills) and clickable KPI tiles that open the exact filtered records | Ops, Inventory, Bookings |
| 6 | 4 | M | Booking -> invoice on completion, creative asset delivered -> invoice | add `bookings.invoice_id`, `creative_assets.invoice_id` |
| 7 | 3 | L | Waitlist and slot-fill on cancellation (needs availability engine, A2) | new `booking_waitlist` table, `cancel/route.ts` |
| 8 | 3 | S | Undo for stock movements (reversing entry), tasks (restore soft delete), bookings (restore) | routes above |
| 9 | 3 | M | Supplier spend and B-BBEE recognition value | supplier link on expenses/POs |
| 10 | 2 | S-M | Calendar: add tasks, supplier payments, quick-add from a day | `lib/calendar/events.ts` |

### Not verified (honest list)
- Live DB state: whether `fn_trigger_contract_expiry` was patched, `file_type='text'` migration applied, `compliance_items.status` values, `creative_assets` CHECK constraints.
- Not read: `ConfirmSubmit`, `AddSupplierModal`, `DataTable` internals beyond grep, `app/api/tasks/[id]/comments`, `lib/notifications/*`, `lib/whatsapp/tenantSender` behaviour when unconfigured, mobile (`expo-app`) booking/inventory flows, `lib/security/rateLimit` limits, `lib/files/parser`.
- Behaviour that needs a running browser: the Windows CSV/MD MIME fallout, `javascript:` URL via `window.open`, reopening a modal after Escape-while-loading.
