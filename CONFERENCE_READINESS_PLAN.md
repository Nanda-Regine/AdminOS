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
| — | *Next: audits land → update §4 and §5 with findings → build* |

---

## 9. Open decisions for Nanda

1. **Which industry leads the demo?** Determines where polish effort concentrates.
2. **Deploy cadence** — push to production as we go, or one hardened deploy the night before?
3. **Jael's access** — `/auth/confirm` is committed but unpushed; her sign-in is blocked until it deploys.
