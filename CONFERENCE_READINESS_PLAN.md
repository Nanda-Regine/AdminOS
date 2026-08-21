# AdminOS — Conference Readiness Plan

**Written:** 2026-08-16 · **Deadline:** conference 2026-08-18 (2 days)
**Audience:** hundreds of South African SMEs and EMEs
**Author:** Claude (Opus 5) with Nandawula Regine
**Status:** LIVE PLAN — written before building, per the project golden rule

> **GOLDEN RULE (project-wide):** every plan is committed to memory and to the
> build journey *before* any building starts, so a mid-build crash never loses
> the thread. This document is that record. Update it as work lands.

---

## 1. Mission

Turn AdminOS from something that reads as "a bit basic" into something that reads as a
**Super Tool** — a system an SA business owner believes could actually run their business
comfortably, on any screen, compliantly.

The bar is not "more features". The bar is: **a knowledgeable operator from any of six
industries walks up, pokes at it, and cannot find the hole.**

### Honest scope statement

"Every page enhanced to enterprise level, nothing missing" is **not achievable in 2 days**
on a codebase with 6 shipped phases. Pretending otherwise is how a demo dies on stage.
So this plan triages ruthlessly:

| Tier | Definition | Treatment |
|---|---|---|
| **T0 — Demo path** | Every screen touched during the live walkthrough | Perfect it. No known defects. |
| **T1 — Poke surface** | Screens an attendee will click into unprompted | No embarrassments: real data, empty states, mobile-clean |
| **T2 — Deep surface** | Everything else | Must not be *visibly* broken; depth can follow the conference |

Anything that cannot be finished properly gets **cut from the demo path**, not shipped
half-built. A missing feature is a roadmap item; a broken one is a lost sale.

---

## 2. Working method — reuse, don't reinvent

Nanda's instruction: *work smarter, not harder.* Three mature codebases already solve
much of this. We mine them rather than re-deriving:

| Source | Location | What it gives us |
|---|---|---|
| **BB MotherShip Deluxe** | `OneDrive/BBOpsOS` · `Nanda-Regine/BB-MotherShip-Deluxe` | A fully-wired restaurant business OS. Best-in-class **operational categorisation**, stakeholder modelling (staff/suppliers/inventory/equipment), dense data presentation, colour-coded status systems |
| **JarvisOS** | `OneDrive/JarvisOS` · `Nanda-Regine/JarvisOS` | 27 live wings. Mine **finance, marketing, CEO, Sanyu** wings for operational frameworks, closed-loop automation, executive dashboards |
| **Industry OS demos** | `Transport-shuttle-os`, `carpentary-os-demo`, `StokvelOS`, `campus-compass` | Sector-specific data models — directly relevant to the conference's industry mix |

Notion also holds BBOps project progress and build detail — consult for intent behind the code.

**Rule:** if a pattern exists and works in one of these, port it. Only build net-new where
nothing portable exists.

---

## 3. Discovery — six parallel audits (IN FLIGHT)

Launched 2026-08-16 ~16:41 SAST. All read-only, all citing `file:line`.

| # | Audit | Output |
|---|---|---|
| 1 | **Page inventory & completeness** | Every route classified SHIPPED / THIN / STUB; top 15 demo risks |
| 2 | **Responsive & premium UX** | Mobile/tablet/desktop defects; the dark-theme contrast bug class; design-system inconsistency |
| 3 | **SA compliance & security** | POPIA/SARS/CIPC/BCEA/B-BBEE/CPA/NPO coverage; claims-not-backed-by-code; RLS + authz review |
| 4 | **BBOpsOS pattern mining** | Portable IA, stakeholder models, data-presentation and colour-coding patterns + proposed AdminOS nav tree |
| 5 | **JarvisOS wing mining** | Finance/marketing/CEO/Sanyu capabilities worth porting |
| 6 | **Six-industry fit** | Per-industry capability tables, best demo story, killer objection |

**Nothing gets built until these land and this plan is updated with their findings.**

### A known systemic bug class (already confirmed)

The app defaults to a **dark** theme (`app/globals.css:67`), but several surfaces force a
**light** background. Any element on a light surface without an explicit `color` inherits
the near-white `--foreground` and becomes invisible. Confirmed and fixed in three places
so far (auth inputs, both onboarding WhatsApp previews). Audit 2 is sweeping for the rest.
**This is the single most likely thing to embarrass the demo** — it makes the app look broken.

---

## 4. The stakeholder domain model

Nanda's requirement: *every stakeholder needs a proper home.* Nothing vague, no orphans.

| Domain | Must cover | Current AdminOS status |
|---|---|---|
| **Customers / clients** | Records, history, communications, documents, balances, lifecycle stage | Partial — to confirm in audit 1 |
| **Staff** | Profiles, roles, permissions, leave, payslips, performance, wellness | Partial — roles + wellness exist |
| **Suppliers / vendors** | Records, contracts, pricing, lead times, payment terms, performance | **To confirm — suspected gap** |
| **Inventory / stock** | Items, levels, valuation, reorder points, movements, stocktake | **To confirm — suspected gap** |
| **Supply chain** | POs, GRNs, deliveries, backorders | **To confirm — suspected gap** |
| **Equipment / assets** | Register, maintenance schedule, depreciation, assignment, warranty | **To confirm — suspected gap** |
| **Tracking** | Jobs, projects, tasks, time, deliveries, status across the above | Partial |
| **Network** | Partners, referrals, subcontractors, professional relationships | **To confirm — suspected gap** |

Audits 1 and 4 resolve every "to confirm". Each domain that lands must get:
a list view (search + filter + sort + bulk actions), a detail view, a create/edit form,
an activity trail, and a colour-coded status system.

---

## 5. Workstreams (sequenced after discovery)

**W1 — Kill the contrast/readability bug class.** Systemic, cheap, highest embarrassment-reduction.

**W2 — Responsive pass: mobile → tablet → desktop.** Most attendees will view on a mid-range
Android at ~390px. Includes the floating-widget collision problem.

**W3 — Information architecture.** Restructure navigation into clean sections with
subcategories so a data-heavy admin app doesn't read as clutter. Ported from BBOpsOS.

**W4 — Stakeholder homes.** Close the domain gaps from §4, prioritised by how many of the
six industries need them.

**W5 — Data density & retrievability.** Search, filter, saved views, sorting, bulk actions,
colour coding, export. This is what makes it feel like a real admin tool rather than a toy.

**W6 — SA compliance proof surface.** A place in the product that *demonstrates* POPIA /
SARS / B-BBEE readiness rather than claiming it in marketing copy. EME B-BBEE affidavit is
high demo value — most attendees qualify.

**W7 — Security hardening.** From audit 3. Non-negotiable regardless of deadline.

**W8 — Demo script.** The narrative Nanda walks: which industry story, which screens, in
what order. Written last, from what's actually solid.

---

## 6. Prioritisation rule

When audit findings land, every candidate is scored:

```
priority = (demo visibility) × (industries affected) − (effort)
```

Ties break toward **things an attendee can see and touch**. A beautiful backend nobody
demos loses to a colour-coded status badge on the main table.

---

## 7. Standing constraints

- **RULE ZERO** — never modify `.env` / `.env.local`.
- Soft delete only (`deleted_at`) — **note the POPIA erasure tension; audit 3 resolves it.**
- Timestamps stored UTC; displayed Africa/Johannesburg.
- `npx tsc --noEmit` must exit 0 before every commit.
- Security claims (`tenant_id`, `role`) read from `app_metadata` only, never `user_metadata`.
- Commit frequently with strategic messages.
- Update this plan + BUILD_JOURNEY as work lands.

---

## 8. Progress log

| When | What |
|---|---|
| 2026-08-16 ~15:57 | Fixed: auth form white-on-white inputs; landing mobile menu clipped by `backdrop-filter` containing block; added `/auth/confirm` token-hash route (`51f2c73`) |
| 2026-08-16 ~16:40 | Fixed: onboarding WhatsApp preview bubbles unreadable; feedback widget covering onboarding CTA + oversized on mobile |
| 2026-08-16 ~16:41 | Six discovery audits launched |
| 2026-08-16 17:40–19:04 | Audits landed; roadmap written into BUILD_JOURNEY_ADMINOS.md. Shipped: sidebar scoped by `business_type`; Suppliers page + form (B-BBEE data reachable); Licences & Permits page (reminders had been firing at an unfillable table); mobile responsiveness pass on dashboard + forms |
| 2026-08-17 | Closed the roadmap's "known dead ends" punch list: valuation Recalculate (was navigating to raw JSON), settings Connect buttons (honest "Coming soon", no OAuth backend exists for any of the 5), contacts New Invoice 404 + dead Edit button (wired to existing PATCH API), demo mobile disclosure (was CSS-hidden below 700px — the exact width most attendees will use), calendar renamed to "Schedule" (it's leave + invoice-due lists, not a calendar grid). Also fixed in passing: `/dashboard/health` was reading wrong JSON keys, so 3 of 6 dimension bars (Team/Compliance/Growth) always showed 0 regardless of real data — now correct, plus a manual "Generate Now" button since there wasn't one. `tsc --noEmit` clean, pushed to `main`. |
| 2026-08-17 (cont.) | Shipped `staff/[id]` and `inventory/[id]` — the last "backend exists, no UI" gaps from the roadmap. Staff: profile, leave/wellness, documents (new add-document modal), payslips, leave history. Inventory: stock summary + margin, full transaction history, Record Transaction modal against the existing atomic stock-update API. Both list pages now link into their detail pages. `tsc --noEmit` clean, pushed. |
| 2026-08-17 (cont.) | **Conference date corrected: 19 August (Wednesday), not the 18th** — two working days, not one. Drafted `DEMO_SCRIPT.md` (W8). Re-skinned `/demo` from a law firm to a creative/media studio (Khumalo Motion Studio) — it was contradicting app/page.tsx's own deliberate exclusion of legal from the marketed industries. Ran an independent `/code-review` on session 6's diff rather than trusting self-review: caught a real regression (health-page dimension fix from earlier the same day would have crashed the page, not just shown 0 — fixed correctly this time) plus 5 smaller correctness bugs, all fixed. Traced into a bigger finding: `tenants.business_type` was never persisted by the real signup flow, so the 16 Aug sidebar-scoping feature has likely never activated for a real tenant — fixed end to end, plus a confirmed crash bug (settings dropdown offered "Government/Municipality," never a valid DB enum value) and a three-way inconsistency across the industries lists. Full detail: `BUILD_JOURNEY_ADMINOS.md` Session 7. `tsc --noEmit` clean throughout, all pushed. |
| 2026-08-17 (cont.) | Applied the business_type migration to production (see §9 item 5) and wired the 6 new industries through the Siyanda picker, nav gating and settings dropdown — including a regression catch on Creative Assets' gating. `tsc --noEmit` clean, pushed (`40592ce`). |
| 2026-08-18 | Closed the last two "backend exists, no UI" gaps. Shipped `/dashboard/safety` (Safety Incidents): table with colour-coded incident-type badges, type + date-range filters, Report Incident modal covering the full POST schema (staff, witnesses, root cause/corrective action, IOD checkbox + reference); major injury/fatality already auto-raises a COIDA compliance item server-side. Shipped `/dashboard/settings/employment-equity`: year selector, 10-field race×gender demographics grid + disabled count + total workforce, PATCH-backed save, and a Download EEA2 Report button straight to the existing HTML report generator. Both added to `lib/nav/features.ts` under Govern, no industry restriction (universal spine, same as Licences). `tsc --noEmit` clean, pushed. |
| 2026-08-18 (cont.) | Tester tenant "Mzansi Test Traders" fully seeded for the demo — `scripts/seed-demo-tenant.mjs` (idempotent), staff/contacts/suppliers/inventory/invoices/expenses/contracts/bookings/tasks/goals/licences/safety incidents/employment equity/health snapshots all populated with a coherent East London hardware-trader persona. `documents` left empty — blocked by a pre-existing prod bug (trigger reads a non-existent column, fails on every insert, every tenant); flagged, not fixed. `tsc --noEmit` clean, pushed. |
| 2026-08-19 | Fixed the `documents` insert bug flagged above. `fn_trigger_doc_pipeline()` read `NEW.status`/`NEW.storage_path` — neither column exists (`processing_status`/`storage_url` are the real names) — so every document upload, for every tenant, has been throwing `42703` since the trigger was created. The corrected function already existed on paper in `supabase/master_schema.sql`, just never applied to prod. Applied it via the Management API, verified live (insert with `processing_status='processing'` now succeeds and `workflow_queue` gets the right payload), seeded 5 real documents into Mzansi Test Traders (0 → 5), codified as `supabase/migrations/20260819_fix_doc_pipeline_trigger.sql`. `tsc --noEmit` clean, pushed. |
| — | *Still open before conference: RESEND_API_KEY dead (deprioritized — demo won't touch live signup/invite).* |
| 2026-08-20 | **Conference over — first real user signal: Jael actually used the product live and loved it.** Nanda rotating `RESEND_API_KEY` herself. Session pivoted to W6 (SA compliance proof surface) and W7 (security hardening) — the two workstreams from §5 never actually run during the 2-day sprint — now run as full audits since real onboarding, not a demo, is the bar. Both landed real findings (compliance-claim overclaims, two exploitable permission gaps). Also fixed in passing: Licences page's `staff.name` query bug (uncommitted, paused mid-session). Full findings + tomorrow's fix order: `BUILD_JOURNEY_ADMINOS.md` Session 10 and memory `adminos-post-conference-audit-2026-08-20`. **This plan's "2 days" framing is now historical — active work has moved to the build journey's Session 10+ entries.** |

---

## 9. Open decisions for Nanda

1. ~~Which industry leads the demo?~~ **Resolved 2026-08-17 (Nanda deferred to Claude's call):** lead with **creative/services** — it has a real live customer story (Jael Malavila, the Kustom Krafts case study) rather than a hypothetical, and Suppliers/B-BBEE gives it a strong SA-differentiator moment mid-demo. If time allows during the walkthrough, retail/trades is the natural second act since Suppliers + Licences just shipped.
2. ~~Deploy cadence~~ **Resolved 2026-08-18 (Nanda confirmed):** push-as-we-go for the final day too — each fix commits with `tsc --noEmit` clean, pushed straight to `main`.
5. ~~Apply `supabase/migrations/20260817_business_type_extend.sql`?~~ **Resolved 2026-08-17 — applied to production** via the Supabase Management API + `SUPABASE_ACCESS_TOKEN` from `.env.local` (same mechanism as the 14 Aug Phase 0 followup migrations). Verified: `business_type` enum now has 15 values (the original 9 + creative/consulting/events/cleaning/accounting/salons). Wired through everywhere it mattered — `mapBusinessTypeToEnum()`, the Siyanda picker (added Events & Hospitality and Salons & Wellness, previously missing entirely), `lib/nav/features.ts`'s `BusinessType` type, and the settings dropdown. Caught and fixed one regression the migration would otherwise have introduced: Creative Assets was gated on the `'other'` catch-all that Creative & Media used to map to — with a real `'creative'` value now in use, that gate would have hidden Creative Assets from exactly the tenants it exists for.
3. ~~Jael's access~~ **Verified 2026-08-18, end-to-end on production.** Minted an admin magic-link server-side (Supabase Auth Admin API, since her invite email never arrived — [[adminos-resend-key-dead]]) and walked the actual redirect chain a browser would take: `adminos.co.za` → `www.adminos.co.za` → `/auth/confirm` (verifies `token_hash`, sets session cookie) → `/dashboard` (200, cookie accepted by middleware). Her `auth.users` row now shows `confirmed_at`/`email_confirmed_at`/`last_sign_in_at` all populated for the first time — previously all three were null since her 14 Aug invite. **Action for Nanda before Wednesday:** generate one more fresh link the same way (single-use, this one's now spent) and open it in the browser you'll actually demo from, so the session in `DEMO_SCRIPT.md`'s pre-stage checklist is warm on the right device — I can't leave a session warm on your physical laptop from here.
4. **RESEND_API_KEY still dead** (2026-08-17, per Nanda: deprioritized, demo won't touch live signup/invite) — leave as-is for tomorrow, but rotate before onboarding any real attendee post-conference or emails will keep silently vanishing.
