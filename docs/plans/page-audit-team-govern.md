# Page audit: the "Team and Govern" cluster

Date 2026-10-24. Read-only, code-level audit. Nothing was run; no live DB, no browser, no network. Everything below is from reading source and `supabase/migrations/*.sql`. Items I could not prove from the repo are marked **UNVERIFIED**.

Scope: `app/dashboard/{people,staff,staff/[id],team,ir-log,handbook,governance,contracts,licenses,safety,valuation,board-pack}`, their API routes (`staff`, `leave`, `disciplinary`, `shifts`, `performance-reviews`, `sops`, `contracts`, `licenses`, `safety`, `valuation`, `board-pack`), `lib/people`, `lib/governance`, `lib/intelligence/valuation.ts`, and `inngest/functions/{peopleApprovals,governanceDeadlines,sopAcknowledgement,licenseRemindersCron,valuationSnapshot,boardPack}`. The cluster brief says "IR" and "Licences": these are `/dashboard/ir-log` and `/dashboard/licenses`.

## Top 5 defects (read these first)

1. **IR cases can never be closed, so People health is permanently red.** `disciplinary_records.acknowledged_at` has no writer anywhere (grep: only reads in `ir-log/page.tsx:49`, `lib/people/signal.ts:29`, `inngest/functions/boardPack.ts:381`, and `api/disciplinary/route.ts` selects). Every record ever logged counts as "Open", `signal.ts:57` sets `health: 'bad'` whenever `openIr > 0`, the People lead line says "close the loop to stay CCMA-defensible" with no button that does it, and the board pack reports the same number as "open IR case(s)" in `risks_and_issues`.
2. **Contracts cannot be sent or signed from the product.** The Create modal posts only `title/content/endDate/contactId` (`CreateContractModal.tsx:41-48`), so no `signers`, so no `contract_signatures` rows and no token. The only signing endpoint is `/api/contracts/[id]/sign`, and there is no public signing page anywhere under `app/` (`find` finds only `app/dashboard/contracts/page.tsx`). There is also no status change, edit or delete UI, no job that sets `expired`, and `end_date` is not selected or shown on the list page. Contracts are draft notes today.
3. **Valuation page shows 0% on all seven value-driver bars and a nonsense "methodology".** The page reads `exit_details` as `{revenue_growth, profitability, ...}` (`valuation/page.tsx:9-17,127`), but the writer stores `{score, teachable, valuable, repeatable, scalable, recurring, warnings}` (`lib/intelligence/valuation.ts:145-152`), so `drivers[key] ?? 0` is 0 for every bar. "Methodology" prints `sector` (e.g. "default"). The headline number assumes a fixed 12% EBITDA margin on gross paid invoices (`valuation.ts:155`), ignoring real expenses and payroll, and 6 of the 9+6 `business_type` enum values never match a multiple key.
4. **Board pack numbers are wrong and the pack can hang forever.** `.lte('created_at', to)` with a date string drops the whole last day of the period (`boardPack.ts:238,274,323`); "net profit" is paid-invoice revenue minus the `expenses` claims table only, with no payroll cost (the comment at `:255` says payroll is included; it is not); a failed run leaves `status='generating'` (the `failed` status in the CHECK has no writer, `save-pack` ignores errors); the monthly cron inserts `generated_by = tenant.id` as fallback into a `NOT NULL REFERENCES auth.users` column and silently skips (`:209`); the page has no Generate button and does not filter `generating` packs.
5. **No staff edit, deactivate, or offboarding path, and no leave-cycle reset.** `api/staff` has only GET and POST; no `[id]` route exists besides documents/invite/payslips; nothing in `app/` or `lib/` ever sets `staff.active = false` (grep). So a resigned or dismissed employee stays in payroll (`payroll/run/route.ts:92` filters on `active`), roster, wellness average and headcount. `staff.leave_taken` is only ever incremented (`lib/people/leave.ts:93-98`); there is no BCEA s20 cycle reset or accrual, so every employee's annual balance runs out permanently after year one.

## Summary table

| Page | Verdict | Critical / High | Top gap |
|---|---|---|---|
| People cockpit `/dashboard/people` | REAL (read-only hub) | High: health stuck "bad" via IR (above); individual wellness scores shown to every leave approver | Make IR acknowledge/close real |
| Staff `/dashboard/staff` (+ `[id]`) | PARTIAL | High: no edit, no deactivate/terminate; leave balance never resets; no minimum-wage or ID validation | Edit + offboard (final pay, leave payout, UIF) |
| Team ops `/dashboard/team` | PARTIAL | High: "missing clock-out shown for HR to fix" does not exist; shifts cannot be edited or deleted; night shifts show "Clocked Out" | Attendance exceptions + hours feeding payroll |
| IR log `/dashboard/ir-log` | THIN | Critical: cannot close or acknowledge; no hearing/notice/appeal/warning-expiry model | LRA Sch 8 case workflow |
| Handbook `/dashboard/handbook` | REAL (small gaps) | Medium: reminder cron ignores status, roles and version; ack denominator wrong | Fix ack accounting; nudge by person |
| Governance `/dashboard/governance` | REAL (read-only hub) | Medium: counts wrong statuses; date maths off by a day | Deadline items become tasks with owners |
| Contracts `/dashboard/contracts` | THIN | Critical: no send/sign path, no signing page, no expiry handling | Send-for-signature flow + renewal tracker |
| Licences `/dashboard/licenses` | PARTIAL | High: no edit/renew/delete; compliance item not linked and can mis-dedupe | Renew action that updates one record |
| Safety `/dashboard/safety` | PARTIAL | High: cannot update an incident (IOD reported, root cause, close-out); stat never clears | Incident follow-up and COIDA closure |
| Valuation `/dashboard/valuation` | THIN (misleading) | Critical: driver bars always 0%; assumed margin; sector multiples mostly default | Real margin from expenses and payroll |
| Board pack `/dashboard/board-pack` | PARTIAL | Critical: wrong profit, last day dropped, stuck "generating", no generate button | Correct financials + failure state |

## Cross-cutting facts

- **Auth**: newer routes (`staff`, `leave`, `disciplinary`, `shifts`, `performance-reviews`, `sops`, `safety`, `valuation`, `board-pack`) use `withRoute` with actions in `lib/auth/roleMatrix.ts`. `contracts/*` and `licenses` use the older `guard()` + hand-rolled zod, no rate limit, no `withRoute` audit config.
- **Page vs API permission mismatches** (page 404s a role the API would serve, or the reverse): contracts page needs `view_financials`, API `contracts.read` (guard action, mapping UNVERIFIED); licences page needs `manage_staff`, API `licences.read`; board-pack API also requires the Scale plan but the page does not check it, so a lower plan sees packs generated before a downgrade and an "auto-generated at month end" empty state that will never be true for it.
- **Soft delete**: no delete exists for staff, contracts, licences, shifts, performance reviews, safety incidents or disciplinary records (all have `deleted_at` per `20261005_soft_delete_columns.sql`). The risk is the opposite of a Rule 3 violation: records cannot be removed or corrected at all. `disciplinary_records.staff_id` is `ON DELETE CASCADE` (`20260612_phase1_employee_os.sql:96`), so a hard staff delete by anyone with DB access wipes the CCMA file.
- **1000-row cap**: `staff` list `.limit(1000)` is fine; `contracts/page.tsx:36`, `governance/signal.ts:29-30` and `licenses/page.tsx:27` read without `.range()/allRows`; IR log shows `.limit(100)` and counts open/closed from those 100 only (`ir-log/page.tsx:45-50`), so with more than 100 records the "Closed Cases" and "Open Cases" tiles are wrong.
- **SAST dates**: mostly handled (`sastDate`, `sastMonthStartUTC`). Exceptions listed per page: governance `daysUntil` (UTC-midnight parse), licence API `days_to_expiry`, board pack period bounds, team page clock window, valuation TTM.
- **Special personal information (POPIA s26)**: IR records, safety injuries, wellness scores, ID numbers and salaries all sit in tables read through `supabaseAdmin` with app-level gating. RLS role-aware migration exists (`20261005_role_aware_rls_people.sql`); not re-verified here.

---

## 1. People cockpit (`/dashboard/people`)

**Purpose / data**: `buildPeopleIntel` (`lib/people/signal.ts`) reads `staff` (active, wellness), pending `leave_requests`, pending `expenses`, and a head count of unacknowledged `disciplinary_records`. Gate `approve_leave` (managers see it). Column names match migrations.

**What works end to end**: pending leave and expense queue with names; approvals link to the Team and Expenses pages where Approve/Decline actually work; permission-aware arsenal (managers are not sent to pages that 404 them); the 08:00 SAST `approvalReminderCron` nudges items pending 48h+.

**Defects**
- High: `openIr` can only grow (see Top 5 #1). Health turns `bad` on the first IR record and never recovers.
- Medium: `signal.ts:57`: `health` is `bad` for any `openIr > 0` even for a grievance filed this morning, but only `watch` for 50 pending leave requests. No age or severity weighting.
- Medium (POPIA): `lowWellness` lists named employees with numeric scores (`people/page.tsx:136-141`) to every user holding `approve_leave`, including line managers. Wellness scores are health-adjacent personal information; show a count, or restrict names to `manage_staff`.
- Medium: approvals list links to a page, not the record, and expense rows link to `/dashboard/expenses` with no id; "who" for an expense submitted by an owner without a staff row is "Staff".
- Low: `staff.eq('active', true)` count includes people with no payroll salary; "Active team" and payroll headcount can differ.
- Low: no `.range()`; `signal.ts` reads all staff, leave and expenses unpaged (fine under 1000).

**Missing loops**: approvals do not show leave balance remaining or team cover (who else is off that week); no link to the shift roster when approving.

**Highest-value gap**: make the IR acknowledge/close flow real (see IR log), then the People lead line becomes truthful.

---

## 2. Staff (`/dashboard/staff`, `/dashboard/staff/[id]`)

**Purpose / data**: `staff` (name, role, department, salary, `id_number`, address, emergency contact, `leave_balance`, `leave_taken`, `wellness_scores` jsonb, `after_hours_flag`, `user_id`, `active`), plus `staff_documents`, `payslips`, `leave_requests`, `staff_invites`. Pages gated by `manage_staff`; list page deliberately omits salary and ID. Payslip select aliases `gross_salary/other_deductions_total/net_pay` (looks consistent with the payroll sweep; not re-verified against a migration here).

**Works end to end**: add staff (zod, audited, auto-promotes tenant to team mode); invite code flow (revokes earlier codes, one-time hashed code, WhatsApp deep link, `staff.write`, rate limited); leave approve/decline (race-safe CAS on `leave_taken`, self-approval blocked, only annual leave draws down, BCEA working-day maths with SA public holidays and Sunday-to-Monday rule); documents stored as pasted https links; leave history and payslips on the detail page.

**Defects**
- High: no `PATCH`/`DELETE` for staff (`api/staff/route.ts` is GET+POST only). Typo in salary, role, ID number or phone cannot be corrected; no deactivate. `staff.active` has no writer (grep of `active: false` finds nothing relevant). Payroll (`payroll/run/route.ts:92`), roster, headcount and Handbook totals therefore keep counting leavers.
- High: leave cycle. `leave_balance` is a static number (modal default `'15'`, `AddStaffModal.tsx:20`), `leave_taken` only increases (`lib/people/leave.ts:93`). No annual reset or accrual (BCEA s20: 1 day per 17 days worked or 21 consecutive days per cycle; new starters accrue pro rata), no carry-over rule, no sick-leave 36-month cycle tracking (s22: 30 days; the type exists in `leaveTypes.ts` but its balance is never computed or shown), no family-responsibility (3 days a year) counter. The balance shown on the staff card and in `/api/me` is therefore wrong from month 13.
- Medium (BCEA/NMW): `salary` accepts any positive number (`api/staff/route.ts:18`) with no check against the national minimum wage or against `employment_type`; part-time/casual salary has no hours basis. Not flagged anywhere. (Current NMW rate not looked up here; verify against the 2026 gazette before coding a threshold.)
- Medium: `id_number` accepts any string up to 30 chars: no 13-digit SA ID check (Luhn + date), no passport/permit alternative, no duplicate check. Stored in plain text and printed in full on the detail page (`[id]/page.tsx:194`); mask all but the last 4 for non-owners.
- Medium: wellness heatmap `scores.slice(-8)` assumes chronological order, and `wellness_scores` is an unbounded jsonb array appended by workflows (`lib/workflow/engine.ts`, `lib/workflows/wellness.ts`); no trimming found. Row size grows without bound (**UNVERIFIED** whether the writer trims).
- Medium: `leave/page` header copy "leave approved updates the leave balance" is true only for annual; sick/family approvals show nothing about their own balance.
- Low: `ConfirmSubmit` approve/decline are native form posts; a non-form failure shows `?notice=` text, OK. Cards are `<Link>` wrapping `<Card>` with nested interactive content (none), fine. Start date shown via `new Date(start_date)` in SAST (date-only parses as UTC midnight, safe at +2).
- Low: department/role are free text; `role` column (`admin/manager/staff/field_agent`) is shown as a badge but changing it does not change the user's `user_roles` (invite flow writes roles; editing is impossible anyway).

**Missing loops**: staff -> payroll: no unpaid-leave deduction (approved `unpaid` or over-balance annual days do not touch payroll; grep finds no `leave_requests` in `lib/payroll`); staff -> clock -> payroll hours (none); staff -> licences/documents expiry reminders (`staff_documents.expires_at` has no consumer: no cron, no calendar entry); staff termination -> UIF/COIDA/UI-19, final payslip, leave payout (BCEA s40) none.

**Highest-value gap**: edit + offboard (set `active=false` with termination date and reason, final-pay checklist, stop payroll/shifts/invites). Then annual leave cycle job.

---

## 3. Team ops (`/dashboard/team`)

**Purpose / data**: active staff, pending leave, today's `clock_events`, 7-day `shifts`, approved leave for today. Gate: `manage_staff` or `approve_leave`; shift creation HR-only.

**Works end to end**: roster build with overlap detection including overnight shifts (`api/shifts/route.ts`), leave approval queue (same API), clock API with sequence validation, geo, 12h offline backdate cap and audit, staff app clocking (`MyDay`).

**Defects**
- High: the clock route comment says a forgotten clock-out "shows on the team page for HR to fix" (`api/staff/clock/route.ts:81-82`). The page has no such view and no endpoint exists to add a corrective clock event (HR can post `clock_out` through the API but no UI does). So stale open shifts silently become "Clocked Out" after 16h and attendance records are wrong for payroll and BCEA s29/31 record keeping.
- High: no edit or delete for shifts (only `POST` and `GET` in `api/shifts/route.ts`). A wrong shift must stay; Team table has no actions column.
- Medium: "Clocked In Today" uses `created_at` within today's SAST window and keys on the first event per staff (`team/page.tsx:52-57,85-89`). Offline-captured events carry `timestamp` earlier than `created_at` (clock route), so ordering uses the wrong column; a night-shift worker clocked in at 22:00 shows "Clocked Out" from 00:00. The API orders by `timestamp`, the page by `created_at`.
- Medium: `onLeaveResult` and shifts do not interact: you can roster someone onto a day of approved leave (no check in `shifts` POST), and approving leave over an existing shift does not warn.
- Medium: no BCEA working-time checks on shifts (ordinary hours 45/week, 12 hours/day incl. overtime, 12-hour daily rest, Sunday/night rules). Roster accepts any 23-hour shift.
- Low: the 7-day shifts table has no staff filter, no card layout at 360px (table in `overflow-x-auto`), "All Team Members" cards omit employment type and role colour; tiles say "Total Staff" but count active only.
- Low: `performance_reviews` API exists (`api/performance-reviews`, `hr.records`) but nothing in `app/` calls it: no UI at all (grep). Reviews are drafts with no way to finalise (`status` only ever `draft`).

**Missing loops**: shifts/clock -> payroll hours and overtime; shifts -> leave conflict; performance reviews -> pay review / wellness / training; announcements exist in `lib/people` but no page in this cluster.

**Highest-value gap**: an attendance exceptions panel (open shifts older than 12h, shifts on leave days, late/no-show) with one-tap correct, feeding a payroll hours export.

---

## 4. IR log (`/dashboard/ir-log`)

**Purpose / data**: `disciplinary_records` (`record_type` CHECK: verbal/written/final warning, suspension, dismissal, grievance, hearing; `incident_date` DATE; `outcome`; `documents_url` text[]; `issued_by`; `acknowledged_at`). Create: modal -> `POST /api/disciplinary` (`withRoute hr.records`, staff tenant-checked, future dates rejected, audited).

**Works end to end**: logging a record with audit trail; list by incident date; "Warnings This Month" computed with SAST month start.

**Defects**
- Critical: nothing can acknowledge, close, edit or delete a record (Top 5 #1). The UI calls a state "Pending acknowledgement" that no actor can resolve; the employee has no view of their own records (no staff-app route in `app/api/disciplinary`, GET is `hr.records` only), so acknowledgement by the employee is not even architecturally possible.
- High (LRA Schedule 8 / CCMA defensibility): the model has no hearing date/time, notice-of-hearing issued date, chairperson, representative, employee's response, finding, sanction, appeal, or warning validity period (warnings normally lapse after 6 to 12 months; the "final written warning" count that justifies a dismissal needs an expiry). `outcome` is free text and, when filled, still leaves the case "open". A dismissal record does not touch `staff.active` and a suspension has no end date.
- High: no progression logic. Nothing counts prior valid warnings for the same offence or suggests the next step; two verbal warnings and a dismissal record can be logged in any order.
- Medium: `documents_url` is accepted by the API (https only) but the modal never sends it, so evidence cannot be attached from the UI.
- Medium: page limits to 100 records and derives tiles from them (above). Sorted by `incident_date`, fine.
- Medium: description max 5000 chars of free text about named employees with no access log on read (writes are audited, reads are not).
- Low: `record.date` is a DATE string rendered with `new Date(r.date)` in `en-ZA` + SAST, safe. "Warnings This Month" is a substring match on `'warning'` (works for the three enum values).
- Low: modal `inputCls` selects have no label association beyond `FormField` (UNVERIFIED how `FormField` links `htmlFor`).

**Missing loops**: dismissal -> staff offboarding -> payroll stop; final warning -> expiry task; grievance -> due-date task; IR open count -> People health and board pack (consumed, but wrongly, see above).

**Highest-value gap**: case workflow on the existing table: add `status` (open/hearing_scheduled/outcome_issued/appealed/closed), `hearing_at`, `valid_until`, employee acknowledgement via the staff app, and a "close case" action. Add 1-click expiry tasks.

---

## 5. Handbook (`/dashboard/handbook`)

**Purpose / data**: `sop_documents` (versioned, `status` draft/active/archived, `requires_acknowledgement`, `applicable_roles`, jsonb `content` shaped `{text}`), `sop_acknowledgements(sop_id,user_id,acknowledged_at)`.

**Works end to end**: create SOP (draft or active), publish/unpublish/archive buttons, version bump on live edit or re-publish, acknowledgement by any role-eligible user (`POST /api/sops/[id]`), per-version ack counts (an ack older than `published_at` does not count, `handbook/page.tsx:65`), role-filtered reads for non-editors, optimistic-concurrency on PATCH.

**Defects**
- Medium: `sopAcknowledgementFunction` (weekly cron) is out of step with the page. It selects all SOPs with `requires_acknowledgement` regardless of `status` (drafts and archived get reminders), ignores `applicable_roles`, and treats any past acknowledgement as valid regardless of version (`sopAcknowledgement.ts:15-20,46`). It inserts into `notifications` directly (no dedupe, no `notify()`, no push), every Friday, forever, for the same unacknowledged person. Cron `0 9 * * 5` has no `TZ=Africa/Johannesburg`, so it fires 11:00 SAST. It does one `step.run` per SOP (scale).
- Medium: the "x / totalStaff" ack ratio divides `user_id`-keyed acknowledgements (owners and admins included) by active staff rows (`handbook/page.tsx:49-55,112`). Staff without a login can never acknowledge, so 100% is unreachable for a team where logins are not linked (the Scale/store audit found 0 of 12 linked). The numerator can exceed the denominator. It also counts staff that the SOP's `applicable_roles` excludes.
- Medium: no edit UI for an existing SOP's title/text (only status buttons; `PATCH` supports it). Wording changes need a new API call, so the version/re-acknowledgement logic is unreachable from the UI.
- Medium: no per-person view of who has not acknowledged (the cron knows, the page does not), and no version history or diff. For a disciplinary defence ("you acknowledged the code of conduct v3 on 12 May") the `sop_acknowledgements` row stores no version number, only a timestamp compared against the current `published_at`; after the next edit the old ack proves nothing about which text was read. Store `version` on the ack.
- Low: no delete (archive only, fine), content is plain text only (no attachments), `category` free text. Search via DataTable client-side only.

**Missing loops**: new hire -> auto-assign required SOPs; SOP acknowledgement -> staff record / IR defence; handbook count feeds valuation "teachable" (consumed by `valuation.ts`, counts active SOPs only, not acknowledged ones).

**Highest-value gap**: fix acknowledgement accounting (version-stamped acks, eligible-user denominator) and have the Friday cron only nudge eligible users on active current-version SOPs via `notify()`.

---

## 6. Governance cockpit (`/dashboard/governance`)

**Purpose / data**: `buildGovernanceIntel` reads `compliance_items` (not completed), `contracts` (status, end_date), latest `business_health_snapshots.overall_score`, latest `valuation_snapshots.estimated_value`. Gate `view_financials`. Daily 07:00 SAST alert cron fires at 14/7/3/1/0 days with dedupe key.

**Works end to end**: shows next 60 days of deadlines with penalties, links to the compliance checklist; deadline push via `notifyTenant` with tier-aware WhatsApp; hub numbers link through.

**Defects**
- Medium: `compliance_items ... .neq('status','completed')` also includes `not_applicable` items (a valid terminal status per the Phase 8 comments in `licenseRemindersCron.ts:42`), so N/A items show as deadlines and count toward `complianceDue`/`health: 'bad'` (`signal.ts:29,47`).
- Medium: `daysUntil` parses `due_date` as UTC midnight and uses `Date.now()` with `Math.ceil` (`signal.ts:23-26`). From 00:00 to 02:00 SAST and in general the number can be one day off against the SAST calendar day that the alert checkpoints (14/7/3/1/0) key on. A deadline "due today" can be skipped or double-fired. `lib/time/sast.daysUntil` exists (used by licences) and should be used.
- Medium: `contractsExpiring` counts any contract with an `end_date` in the next 30 days, including `draft`, `cancelled` and `expired` (`signal.ts:46`); `contractsAwaiting` counts `sent` only, which the UI can never produce (see Contracts). So that tile is always 0 for UI-created contracts.
- Medium: `healthScore` and `valuation` come from stored snapshot tables whose writers are crons (health, valuation weekly for Scale/Partner only). A Solo/Grow tenant sees "—" forever; a stale value shows with no date.
- Low: `contracts` read unpaged; `deadlines` capped at 8; the lead line shows only the single soonest overdue item.
- Low: page does not check plan; board pack and valuation link tiles lead to pages gated by plan (board pack) or empty (valuation).

**Missing loops**: a deadline is an alert only; it cannot be assigned, snoozed, or turned into a task (`tasks.source` supports `contract_expiry`, no producer). Governance does not show open IR, open safety/COIDA items, expiring licences or staff documents even though those create `compliance_items` (licences, safety) or should (staff documents).

**Highest-value gap**: deadline -> task with owner and due date, and include IR / safety / licence / staff-document expiries in one risk register.

---

## 7. Contracts (`/dashboard/contracts`)

**Purpose / data**: `contracts` (title, `content` jsonb, `value`, `start_date`, `end_date`, `auto_renew`, status draft/sent/partially_signed/signed/expired/cancelled, `signed_at`) and `contract_signatures` (token, signer, `signed_at`, `signature_data`, `ip_address`, `expires_at`).

**Works end to end (API level)**: create with signers (tokens, 30-day expiry), terms locked after first signature (`[id]/route.ts:57-64`), public sign endpoint with token + audit trail including SHA-256 of title+content, IP, time, critical audit (`sign/route.ts:112-121`), per-signer completion flips to `signed`. Good evidence design.

**Defects**
- Critical: none of this is reachable from the UI (Top 5 #2). Also email is down and the API returns tokens only to the creator's response, so even API users must build and deliver the link themselves.
- High: `contracts` has no expiry job. Nothing sets `status='expired'` when `end_date` passes (grep of `inngest/` finds no contract expiry function), and `auto_renew` has no reader. The governance tile and the Calendar (`lib/calendar/events.ts` only shows `signed/partially_signed` contracts) disagree with the list's "Expired" tile, which is always 0.
- High: the sign route can leave a contract in the wrong state under concurrency: two signers submitting at the same moment each see the other's row still unsigned, both write `partially_signed` after the fully-signed write, overwriting `signed` (`sign/route.ts:96-103`, no compare-and-swap, no status guard). Also it does not refuse `draft` contracts with signature rows or `signed` re-signing of a different invite after completion.
- Medium: `POST` accepts `signatureData` up to 200 000 chars and `signerName` freely typed by the signer, overwriting the owner-specified `signer_name` (`sign/route.ts:84`). The legal name on the evidence trail is whatever the signer typed; compare to the invited name or keep both.
- Medium: no rate limit on the public `GET`/`POST` sign endpoints (token is a DB default; entropy and format **UNVERIFIED**, check `contract_signatures.token` default). Contract text is returned to anyone with the token, no one-time-view logging.
- Medium: ECTA/POPIA: a typed or drawn name plus IP is a simple electronic signature; the code notes "Which ECTA standard a simple e-signature meets is a Workstream F check" (not done). Fine for most commercial contracts, not for those requiring an advanced signature (e.g. suretyships, long-term credit agreements, certain property deeds). No signer consent text is captured.
- Medium: `PATCH` allows `status: 'signed'` by hand on any contract with no signature rows and no evidence (audited as critical, but still a one-click "signed" without a document). Same for `cancelled` after one party signed: no notice to the signer.
- Low: page lists contracts unpaged with `contacts(full_name,email)`; "Search title, contact, signer" placeholder promises a signer column that does not exist in `ContractRow` (grep). `value` is nonnegative but currency/VAT is undefined. Content is plain text under `{ body }`; no templates for SA basics (service agreement, NDA, employment contract with BCEA s29 particulars).

**Missing loops**: signed contract -> invoice schedule / recurring billing (value and dates stored, never used); signed contract -> calendar renewal task (calendar reads dates only for signed ones); contract -> contact timeline; contract documents from the Documents pipeline (`documents.document_type='contract'`) are a separate table and never join this one.

**Highest-value gap**: wire the existing API into the UI: signer fields on create, a "copy signing link / send via WhatsApp share link" action, a public `/sign/[id]` page (middleware already whitelists the route pattern at `middleware.ts:49`), and an expiry cron that flips status and raises a renewal task.

---

## 8. Licences (`/dashboard/licenses`)

**Purpose / data**: `professional_licenses` (staff_id, type, number, issuing body, issue/expiry dates, `renewal_reminder_days`, `document_id`). Page built to give the cron a UI. DataTable, stats (tracked, expired, renewal due) via `lib/time/sast.daysUntil` (SAST-correct).

**Works end to end**: add a licence (modal -> `POST /api/licenses`, audited), see expiry badges, filter. A `compliance_items` row (`license_renewal`) is created at entry, due `expiry - reminderDays`; the Monday cron creates a missing one at the reminder date. Governance and the Calendar read compliance items.

**Defects**
- High: no `PATCH`/`DELETE` (the route folder contains only `route.ts` with GET and POST). A licence cannot be renewed (new expiry), corrected or removed. Renewing means adding a second record, so the old one stays "Expired" forever and keeps the stats red.
- High: the `compliance_items` row is not linked to the licence (no licence id). The cron's dedupe is `title ilike '%<license_type>%' ... .maybeSingle()` (`licenseRemindersCron.ts:38-44`): (a) two staff with the same licence type (e.g. two drivers' PrDP) share one item, so the second never gets reminded; (b) `maybeSingle()` errors when 2+ rows match and the error is ignored, so it inserts duplicates; (c) `%`/`_` in the type act as wildcards. After a renewal the old completed item is skipped but a new unrelated one is not created until the new reminder window, and the manual POST item is created without checking existing ones.
- Medium: the POST item is due on the reminder date, not the expiry date, with an `annual` recurrence, so a licence expiring in 12 months shows "due" ~10 months from now and then becomes a repeating annual task regardless of whether the licence is annual. The cron version uses `due_date = expiry_date`. Two meanings of the same field.
- Medium: the cron runs `0 7 * * 1` (UTC, Mondays only, no TZ) and only inserts a compliance row; it sends no notification itself. The governance daily alert only fires at 14/7/3/1/0 days before `due_date`; a Monday-only creation near expiry can create an item due in less than 7 days that then fires at most one checkpoint.
- Medium: `new Date(body.expiryDate).getTime() - days*86400000` then `.toISOString().split('T')[0]` is UTC-based date arithmetic (safe for whole days, fine), but `days_to_expiry` in GET uses `Math.round` against `Date.now()` (off by up to a day and it rounds up/down inconsistently vs `daysUntil`).
- Low: page staff dropdown includes inactive staff and any `staff_id` is not tenant-verified on POST (`licenses/route.ts:20`; service role insert with foreign UUID would embed another tenant's staff name through the GET join `staff:staff(full_name, role)` if guessed). `documentId` likewise unverified.
- Low: licences on `staff_documents` (certificates with `expires_at`) are a parallel unlinked mechanism; no consumer for either one's attachment.

**Missing loops**: licence expiry -> staff cannot be rostered/assigned (e.g. driver, first aider); licence document upload -> Documents pipeline; licence -> calendar already via compliance, but not the licence itself.

**Highest-value gap**: renew/edit/delete with `licence_id` on the compliance item, and a renewal action that updates one record and closes the item.

---

## 9. Safety (`/dashboard/safety`)

**Purpose / data**: `safety_incidents` (type CHECK near_miss/minor/major/fatality/property/environmental, `incident_date timestamptz`, witnesses text[], root cause, corrective action, `iod_reported`, `iod_reference`). Register for `hr.records`; everyone else reports and sees only their own reports.

**Works end to end**: report -> row; injuries automatically raise `compliance_items` (COIDA W.Cl.2 within 7 days for any injury if IOD not reported; OHSA s24/GAR 8 report for major injury and fatality, same-day for fatality), deadlines counted from the incident date in SAST (`sastDatePlus`). Reporter role split is good OHSA practice.

**Defects**
- High: an incident can never be updated (`api/safety/route.ts` is GET+POST only). Root cause and corrective action are optional fields on the creation form, which is when they are not known; `iod_reported` / `iod_reference` cannot be set when the claim is filed later. So the register's "IOD not yet reported" tile (`safety/page.tsx:51`) only counts rows created with `iodReported=false` and never decreases, while the real compliance item can be completed on the compliance page: the two disagree. The close-out (corrective action done, verified) that the OHSA register exists for cannot be recorded.
- High (legal accuracy): COIDA reporting is required for injury or disease arising out of employment where the employee needs medical treatment or is absent; "any minor_injury" generates W.Cl.2 on a 7-day clock, but the law's trigger is knowledge of the incident or the doctor's report; verify the exact clock (7 days after notification of the incident, W.Cl.2 within 7 days of the employer being informed) and the first-aider-only case with an occupational health practitioner before relying on the penalty text. Also missing: GAR 9 investigation requirement for serious incidents (written report to inspector in 7 days is partially modelled), the employee's own W.Cl.1 for diseases, and the 14-day absence trigger for "major injury".
- Medium: the compliance insert failure is only `console.error`ed (`safety/route.ts:114-117`): the incident is saved and the user is told nothing. For a fatality the statutory reminder silently may not exist.
- Medium: no dedupe of follow-up items (two reports of the same incident by two reporters double the compliance items; `compliance_items` insert has no incident id).
- Medium (POPIA s26): injury descriptions identify an employee and their medical outcome; reporters see own, HR sees all; no read audit; the staff embed uses the service role.
- Low: `incident_date` is a datetime; the client builds it from a date string with `new Date(dateStr).toISOString()` (`SafetyClient.tsx:120`), so a date-only input becomes UTC midnight = 02:00 SAST, which is harmless, but a late-evening incident cannot be time-stamped. The future check allows +1h.
- Low: `witnesses`, `documents_url` (column exists, API ignores it): no photo or document evidence upload.

**Missing loops**: injured employee -> leave (sick/IOD absence) -> payroll (COIDA compensation vs UIF): none, `staff_id` links only; incident -> corrective-action task with owner and due date (none; `tasks.source` has no safety value); incident trends -> health score / board pack (not consumed).

**Highest-value gap**: `PATCH` + status (reported, investigating, closed) with a sync to its compliance items by incident id, plus a corrective-action task with owner.

---

## 10. Valuation (`/dashboard/valuation`)

**Purpose / data**: `valuation_snapshots` (estimated value, exit score, `exit_details` jsonb, sector, TTM revenue and EBITDA, multiples). GET `/api/valuation` caches per SAST day; weekly Sunday cron only for Scale/Partner (`0 3 * * 0`, UTC).

**Works end to end**: recalculate button -> snapshot upsert on `(tenant_id, snapshot_date)`; headline estimate renders; prior-snapshot bars; the headline figure and exit score also feed Governance.

**Defects**
- Critical (display): value drivers always show 0% (Top 5 #3). The "7 Value Drivers" card, the page's core story, is blank. Real fields exist (`teachable/valuable/repeatable/scalable/recurring` out of 20) and the `warnings` array (client concentration, no SOPs, no team) is never rendered.
- High: the estimate is not grounded in profit. `ebitdaTTM = revenueTTM * 0.12` for every tenant (`valuation.ts:155`), the "Phase 9 will refine" TODO is unresolved. EBITDA value = 0.6 weight on a made-up margin. A loss-making business and a 40%-margin business with the same revenue get the same value. Real cost data (expenses, payroll runs) exists.
- High: revenue basis. TTM = `paid` invoices by `created_at` in the last 365 days using `amount` (gross, VAT-inclusive if invoices carry VAT; the money sweep left 17 VAT invoices open), not payment date and not net of VAT. Cash sales/Quick Sale revenue inclusion is **UNVERIFIED**.
- High: sector keys are stale. Multiples cover `technology, saas, professional, retail, ...`, but `tenants.business_type` is the enum `school, clinic, ngo, retail, property, legal, logistics, trades, other` plus `creative, consulting, events, cleaning, accounting, salons`. Only `retail` and `logistics` match; every other tenant gets the default multiples, and the sector shown as "methodology" is the raw enum.
- Medium: the "exit readiness" proxy uses invoice count (not value or recurrence terms) for "repeatable" and staff head count for "scalable"; weak but labelled as scores. Health default `50` when no snapshot (`valuation.ts:84`), `.single()` errors silently.
- Medium: unprofessional-valuation disclaimer exists in small print only on the page, not on any exported/board output that quotes the number; governance and board pack quote a single point value.
- Medium: first-ever valuation check `(count ?? 0) === 1` uses a count taken after the upsert; fine, but `refresh=true` has no rate limit (each call runs paged invoice reads twice).
- Low: trend bars use `Math.max(...allSnaps...)` including latest and plot at most 5 snapshots; the "Now" bar is always 60px regardless of value.

**Missing loops**: inputs the owner can improve (SOPs, team, recurring clients, debtors) are listed nowhere as actions; valuation does not pull debtors, contracts (recurring revenue), or cash.

**Highest-value gap**: replace the assumed 12% margin with actual TTM net margin from expenses plus payroll, normalise revenue to ex-VAT paid date, map the real `business_type` values, and fix the driver bars/render `warnings` as "what would raise this".

---

## 11. Board pack (`/dashboard/board-pack`)

**Purpose / data**: `board_packs` (period, `pack_data` jsonb, status `generating|ready|failed`). Generation: `inngest board-pack-generate` (event), monthly cron `0 6 1 * *` for Scale/Partner. Page shows last 6 packs, renders latest in print style, logo/name from tenant.

**Works end to end**: API `POST` creates a row and fires the event (plan-gated Scale, rate limited `agents`), the function gathers financials, customers, invoices, staff, compliance, goals, calls the model (budgeted via `checkBudget`, falls back to a fixed sentence when blocked), saves `ready`. Print/Save-as-PDF button works client-side.

**Defects**
- Critical: period maths (Top 5 #4). `to` is a bare date, so `lte('created_at', to)` stops at 00:00 UTC of the last day: the last day's invoices, expenses, new contacts and approved leave are dropped; and the window is UTC, not SAST (up to 2h of the first/last day misattributed). Prior-period revenue window is derived the same way.
- Critical: "net profit" and "profit margin" exclude payroll and everything not in `expenses` (employee claims table), and revenue is `status='paid'` invoices by creation date, not payments received in the period (`gatherFinancials`). The AI narrative then confidently states these as "data-driven" figures to a board. `cash_position` is always `null`.
- High: stuck `generating`. The function has `retries: 1` and no `onFailure`; `status='failed'` is never written; the `save-pack` step ignores the update error. The page does not show status at all and renders `latest` even if its `pack_data` is `{}` (a `generating` pack sorts first by `period_start` and replaces the last good pack with blank sections).
- High: no Generate button anywhere (`grep` for `/api/board-pack` in `app`/`components` finds nothing); the empty state says "auto-generated at month end", which only happens on the cron for Scale/Partner and only when `owner_user_id` is in `tenants.settings`.
- High: cron fallback `generated_by = tenant.id` violates the FK to `auth.users` (`board_packs.generated_by uuid NOT NULL REFERENCES auth.users(id)`), so tenants without `settings.owner_user_id` get no pack and no log line (`if (!pack) return`). Cron also lacks `.eq('active', true)`, has no uniqueness on `(tenant_id, period_start)` (re-run = duplicates), and uses the server-local month (`new Date(today.getFullYear()...)`) at 06:00 UTC on the 1st.
- Medium: `ir_cases_open` repeats the never-closing IR metric (Top 5 #1); `goals.overdue` is a hard-coded 0 (documented); `risks_and_issues` omits open safety/COIDA, licence expiry, contracts and debtor concentration; `decisions_needed` is a handful of fixed strings.
- Medium: pack is a snapshot; the model writes 3 paragraphs from the same flawed numbers. No "as at" disclosure of data completeness (e.g. VAT-inclusive, unreconciled).
- Medium: PDF is browser print only; `pdf_url` column is never written. The API `GET` selects `pdf_url`; nothing sets it.
- Low: `formatMonth` re-parses `YYYY-MM-DD` from `period_start` via split (works). `fmtValue` heuristically formats any key matching `/total|paid|value|rate$/` as rand, so `nps_average` ("rate"? no) is safe but `customers.active`/`new` are not; `leaves_approved` safe; `total_billed` OK; `nps_average` fine.

**Missing loops**: pack decisions are not turned into tasks; compliance/IR numbers do not link to the underlying records; no sharing (secure link, email) so a "board pack" cannot leave the screen except by PDF print.

**Highest-value gap**: correct period/cost/profit maths and add a failed/generating state, then a "Generate now" button. Without it the pack cannot be trusted by a bank or investor.

---

## Cross-page loops

Exist today
- Staff invite code -> staff app login -> leave request -> push to approvers -> approve/decline -> `leave_taken` + push to employee (strong, race-safe).
- Leave approval -> Calendar (`lib/calendar/events.ts`), Team "On Leave Today".
- Safety injury -> `compliance_items` (COIDA/OHSA) -> Governance daily deadline alert and Calendar.
- Licence entry -> compliance item -> Governance and Calendar.
- SOP count -> Valuation "teachable" score.
- Governance signal -> People/Governance hubs via `publishSignal`.

Broken or missing
- IR record -> acknowledge/close -> People health -> board pack: writer missing (Top 5 #1).
- Staff termination -> `active=false` -> payroll/roster/handbook/invites stop: no termination action exists.
- Leave (unpaid or over-balance) -> payroll deduction: not wired. Sick/IOD leave -> safety incident link: none.
- Staff + clock + shifts -> payroll hours/overtime: none. Clock stale shifts -> HR correction: promised, absent.
- Safety incident -> corrective action task -> closure -> board pack risk: none.
- Contract (value, dates) -> invoice schedule / renewal task / expiry status: none. Contract create -> signing link -> signer: not reachable from UI.
- Licence/staff document expiry -> reminder: licences partial; `staff_documents.expires_at` no consumer.
- Handbook acknowledgement -> onboarding of new staff / IR defence (version-stamped): missing.
- Valuation <-> Expenses/Payroll (actual margin) and Debtors: not connected. Valuation -> improvement actions: none.
- Governance deadline -> task with owner: none (`tasks.source='contract_expiry'` has no producer).
- Performance reviews: API only, no UI, no link to pay or wellness.

---

## RANKED fix-and-build list

### A. Defects (fix first)

| # | Sev | Item | Files | Effort |
|---|---|---|---|---|
| 1 | Critical | IR: add acknowledge/close (`PATCH /api/disciplinary/[id]`, staff-app acknowledge, `status`, `valid_until`, hearing fields); stop People/board pack counting unresolvable cases | `app/api/disciplinary/*`, `ir-log/*`, `lib/people/signal.ts:29,57`, `boardPack.ts:381`, migration | M |
| 2 | Critical | Contracts: signer inputs + signing link + public sign page + expiry cron + status guard on sign (CAS) | `CreateContractModal.tsx`, new `app/sign/[id]`, `api/contracts/[id]/sign/route.ts:96`, new `inngest/functions/contractExpiry.ts` | L |
| 3 | Critical | Valuation: render real driver fields and warnings; replace 12% margin with actual; map real `business_type` values; ex-VAT paid-date revenue | `valuation/page.tsx:9,127`, `lib/intelligence/valuation.ts` | M |
| 4 | Critical | Board pack: inclusive SAST period bounds, include payroll cost, paid-date revenue, failure state, hide/flag `generating`, fix `generated_by` fallback and cron filters, add Generate button | `inngest/functions/boardPack.ts`, `board-pack/page.tsx`, `api/board-pack/route.ts` | M |
| 5 | High | Staff: edit + deactivate/terminate (`PATCH /api/staff/[id]`), cascade to payroll/roster/invites; annual leave cycle reset/accrual and sick/family counters; SA ID validation; NMW warning | new `app/api/staff/[id]/route.ts`, `lib/people/leave.ts`, new `inngest/functions/leaveCycle.ts` | L |
| 6 | High | Safety: `PATCH` incident (IOD reported, root cause, closure), link compliance items by incident id, surface compliance insert failures | `app/api/safety/route.ts`, `SafetyClient.tsx`, migration | M |
| 7 | High | Licences: `PATCH`/`DELETE`(soft), `licence_id` on compliance items, fix cron dedupe (`maybeSingle` + `ilike`), align due-date semantics, add `TZ=Africa/Johannesburg` | `app/api/licenses/*`, `licenseRemindersCron.ts:38-44` | M |
| 8 | High | Team: missing clock-out panel + corrective event, shift edit/delete, leave-conflict and BCEA hours checks, use `timestamp` not `created_at`, handle overnight | `team/page.tsx:52-57,85`, `api/shifts/route.ts`, `api/staff/clock/route.ts:81` | M |
| 9 | Medium | Handbook: cron aligned with page (status active only, roles, version, `notify()`, SAST TZ, dedupe); store `version` on acks; eligible-user denominator; add SOP edit UI | `sopAcknowledgement.ts`, `api/sops/[id]/route.ts:86`, `handbook/page.tsx:49-55` | M |
| 10 | Medium | Governance: exclude `not_applicable`/cancelled/draft, SAST day maths via `lib/time/sast`, contract-status filter | `lib/governance/signal.ts:23-47` | S |
| 11 | Medium | People: stop naming low-wellness employees to every approver; weigh IR health by age/severity | `people/page.tsx:136`, `lib/people/signal.ts:57` | S |
| 12 | Medium | IR/Contracts/Licences list pages: remove `.limit(100)` count derivation, use head counts or `allRows` | `ir-log/page.tsx:45-50`, `contracts/page.tsx`, `licenses/page.tsx` | S |
| 13 | Medium | Verify tenant ownership of `staffId/documentId/contactId` in licences and contracts POSTs (service-role embeds can leak a foreign name); validate signer names | `app/api/licenses/route.ts:20`, `app/api/contracts/route.ts:8` | S |
| 14 | Low | Move `contracts`/`licenses` routes onto `withRoute` (audit config, rate limit); rate-limit public sign endpoints | `app/api/contracts/*`, `app/api/licenses/route.ts` | M |

### B. Gaps (build in this order)

| # | Value | Effort | Item | Why / files |
|---|---|---|---|---|
| 1 | 5 | L | Offboarding wizard: termination date/reason, final payslip and leave payout (BCEA s40), UIF/UI-19 prompt, access revoke, IR dismissal link | closes staff -> payroll -> IR loop; `api/staff/[id]`, payroll |
| 2 | 5 | L | LRA Schedule 8 case workflow: notice of hearing, hearing record, warning validity/expiry, prior-warning guidance, employee acknowledgement in staff app | `disciplinary_records` columns, `ir-log`, staff app |
| 3 | 5 | L | Contracts end to end: templates for SA basics (service agreement, NDA, employment particulars), send via WhatsApp share link, signing page, renewal tasks, recurring-billing hook | `contracts/*`, `tasks` producers |
| 4 | 4 | M | Attendance exceptions + hours-to-payroll: open shifts, late/no-show, leave conflicts, overtime export | `team`, `shifts`, `lib/payroll` |
| 5 | 4 | M | Unified risk register: deadlines, IR, safety, licences, staff documents, contracts as tasks with owners and snooze | Governance, `tasks.source`, `compliance_items` |
| 6 | 4 | M | Valuation that tells the owner what to fix (rand effect of removing client concentration, adding SOPs, recurring revenue) | `valuation.ts`, page |
| 7 | 3 | M | Board pack: shareable link, bank/investor view, risks from safety/licences/contracts, cash position from bank feed | `boardPack.ts`, `bank` |
| 8 | 3 | M | Performance reviews UI (cycles, goals, sign-off) tied to pay review and wellness | `api/performance-reviews`, new page |
| 9 | 3 | S | Staff document expiry reminders and licence unification | `staff_documents.expires_at`, `professional_licenses` |
| 10 | 2 | S | Leave: team-cover view and balance preview on the approval card | Team page, `decideLeave` |

---

## Not verified (honest list)

- Live DB state: whether `disciplinary_records` still lacks a status column, `contract_signatures.token` default/entropy, `staff.active` default, `sop_acknowledgements` shape, `compliance_items.status` allowed values beyond what code references, whether `board_packs` has other FKs, RLS policies in force after `20261005_role_aware_rls_people.sql`.
- Not read: `FormField`/`Modal` label linking, `ConfirmSubmit`, `DataTable` internals, `StaffDocuments.tsx`, `StaffAppInvite.tsx` interaction details, `AddStaffModal` second half, `HandbookTable` beyond grep, `CreateSOPModal` detail, `lib/workflow/engine.ts` and `lib/workflows/wellness.ts` (wellness writers), `lib/calendar/events.ts` (contracts/leave detail, assumed from the Deliver audit), `lib/payroll/*` beyond the `active` filter and grep for leave/clock inputs, `lib/notifications/*`, expo app flows, `guard()` action-to-permission mapping for `contracts.*`/`licences.*`, the 2026 national minimum wage figure, and the exact COIDA/OHSA clock wording (legal statements above are from memory of the statutes and the code comments, not re-verified against primary sources; check before relying on them).
- Behaviour needing a running browser: modal label focus, 360px layouts of the table-based pages, print layout of the board pack, form-post error pages from Approve/Decline.
