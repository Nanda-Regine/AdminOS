# AdminOS — Operator Console (Super-Admin Tooling)

> Design note · 17 July 2026 · Mirembe Muse (Pty) Ltd
> Status: **proposal, not yet agreed.** Written to be argued with.
> Companion to `WORKSPACE_ARCHITECTURE.md`. Assumes Phase 0 (tenant isolation) is in.

---

## 1. The thesis

A super-admin tool is not "the dashboard, but you can see everyone." It is the **one surface in the entire product that is allowed to cross the tenant boundary** — the exact boundary Phase 0 just spent 208 edits sealing. Everything else in AdminOS is now, correctly, a prisoner of its tenant. The operator console is the sanctioned jailbreak.

That framing decides everything below. Because it is the one place tenant isolation is *designed* to break, it must be the most **narrowly gated, most heavily audited, and least improvised** surface in the system — the opposite of how the tenant-facing app grew (41 islands, each improvising access). If we build the operator console the way the app was built, we rebuild the Phase 0 bug with a UI on top.

So the goal of this note is not a feature list. It is: **name the one gate, tier the capabilities by how much damage they can do, and make the audit trail load-bearing before the power is.**

But there is a second reason this surface matters, and it is the reason the company exists. The operator console is the only vantage point from which Mirembe Muse can see **where South African SMEs actually get stuck** — across every tenant at once — and do something about it. Built narrowly it is platform admin. Built with intent it is the mission's instrument: the place a stalled formalisation, a missed SARS deadline, or a cash-flow cliff becomes *visible and actionable* instead of a silent churn. §7.1 makes that an explicit design requirement, not a nice afterthought.

---

## 2. What exists today — honestly

There is already a super-admin surface. It is two half-consoles on two incompatible auth models, and the better-looking half doesn't open.

### The API layer — `/api/admin/*` (the good bones)

Five routes, all correctly gated against the `admins` **table** (not JWT metadata — the right call, and the same pattern `20260612_admins_table.sql` established):

| Route | Does | State |
|---|---|---|
| `tenants` | GET list (paged), PATCH plan/active/name/slug | Works, audited |
| `create-tenant` | POST → create + invite owner | **Broken by Phase 0 — see §3** |
| `ai-costs` | GET cost-per-tenant, feature breakdown, live budgets, abuse flags | Genuinely strong already |
| `impact` | GET social-impact metrics (+ public mode) | Works, but it's impact metrics, not ops |
| `special-pricing` | GET/POST per-tenant pricing overrides | Works |

The surprise is `ai-costs`: it already joins `ai_usage_logs` to tenants, ranks spend, reads Redis abuse flags and live daily budgets. The cost-observability story is **80% built** — it just has no reachable UI.

### The UI layer — `/operator/*` (unreachable)

Two pages (`/operator`, `/operator/[tenantId]`) gated on an `x-operator-secret` **header** compared to `OPERATOR_SECRET`. But:

- `/operator` is in middleware's `PUBLIC_PREFIXES`, so it skips the auth path entirely, and
- no browser sends `x-operator-secret`, so `verifyOperatorAccess()` fails and the page `notFound()`s **for everyone, including you.**

It also reads stale `subscriptions` columns. In practice the operator UI does not exist — it's a page you cannot open, protected by a secret nothing supplies, showing data from a schema that moved.

**Two auth models for one privilege** (`admins` table for the API, a header secret for the UI) is the same class of drift Phase 0 just killed: the same security question answered two ways is one of them being wrong.

---

## 3. Two bugs to clear before building anything

**(a) Phase 0 broke operator-created tenants — urgent.** `admin/create-tenant` invites the owner with `inviteUserByEmail(email, { data: { tenant_id, role } })`. That `data` lands in **`user_metadata`**, which `current_tenant_id()` no longer reads. Every tenant an operator provisions is now dead on arrival: the owner signs in resolving a `NULL` tenant. It also never seeds roles (so fail-closed locks them out regardless) and still uses the old plan enum (`starter/growth/enterprise`). This is the Phase 0 fix applied to the one write path the sweep couldn't see, because it writes via invite rather than reading `user_metadata`.

**(b) The audit trail is split-brain — do not build god-mode on top of it.** `writeAuditLog()` writes table `audit_log` (singular). `onboarding/complete` writes `audit_logs` (plural) directly. So the compliance record is scattered across two tables depending on the code path, and `writeAuditLog` **swallows its own failures** (`catch → console.error`, no throw). For the tenant app that's untidy. For a super-admin console — where the audit log is the *only* thing standing between "supported a customer" and "browsed a stranger's payroll" — a split, lossy audit trail is a disqualifier. §6 makes this the first thing fixed.

---

## 4. The one gate

Every operator capability — API and UI — resolves through a single check, which already half-exists:

```ts
const ctx = await requireContext()
if (!ctx.isSuperAdmin) notFound()   // getContext() already computes this from the admins table
```

`getContext()` (added in the Phase 0 commit) already loads `isSuperAdmin` from the `admins` table and is unused. Adopt it:

- Replace the ~5 inline `requireSuperAdmin` copies in `/api/admin/*` with `ctx.isSuperAdmin`.
- Gate `/operator/*` on it and **remove `/operator` from `PUBLIC_PREFIXES`**. Retire `OPERATOR_SECRET`.
- `notFound()` (404), not `403`, for non-admins — the operator surface should be invisible, not merely forbidden. Don't confirm it exists to someone probing for it.

One gate, one definition of "operator," in the file that already computes it.

---

## 5. Capabilities, tiered by blast radius

Not a backlog — a **risk ladder**. Build downward. Each tier earns the next by proving its audit and gating on the tier above.

### Tier A — Observe (read-only, low risk)

The reachable version of what mostly exists. A working `/operator` home: tenants list with plan/status/health, and a tenant detail view stitching together the `ai-costs` data, staff/conversation/invoice counts, subscription state, and a **per-tenant audit viewer**. No mutations. This tier is a UI-and-wiring job, not new power, and it's where the existing `ai-costs`/`impact` routes finally surface.

### Tier B — Lifecycle (mutations, medium risk — every action audited)

The operational verbs a platform actually needs, none of which exist as a UI today:

- **Suspend / reactivate** a tenant (the `suspended` claim now lives in `app_metadata` — Phase 0 made this safe to set).
- **Change plan / comp a plan** (partly there via `tenants PATCH`; needs UI + billing reconciliation).
- **Reset / re-invite an owner** (fix (3a) first, or you'll re-invite into the same NULL-tenant hole).
- **Offboard + POPIA erasure** — delete a tenant and provably its personal data. This is a legal obligation for a compliance product, not a nice-to-have, and it's genuinely hard to do correctly (cascade, storage buckets, backups).
- **Super-admin roster management** — grant/revoke `admins` rows. Today that's a hand-run SQL `INSERT`. Given what the row grants, it deserves a deliberate, audited, ideally two-person-reviewed UI more than any other action here.

### Tier C — Impersonation / "act as tenant" (high risk — the crown jewel)

The defining super-admin capability and the one that most wants to be built last and most carefully. It is, by definition, a deliberate, logged RLS bypass. Non-negotiables if it's built at all:

- **Read-only by default.** Writing as a tenant is a separate, louder capability, if ever.
- **Time-boxed and explicit.** A session you enter and exit, not an ambient mode. Every impersonated request tagged and audited with operator id + reason.
- **Consent-aware.** For a POPIA product, "support entered your account" should be visible to the tenant, not silent.
- **Never via a spoofable claim.** Impersonation runs through a dedicated audited service path, never by setting a `tenant_id` somewhere and hoping RLS does the rest — that's the Phase 0 bug wearing a helpful costume.

There is **no impersonation in the codebase today** (greenfield — the only hit is legal text in `/terms`). That's a feature, not a gap: it means we get to design it correctly instead of retrofitting safety onto it.

---

## 6. Audit is the spine, and it comes first

Before Tier B or C ships, the audit trail must be something you can stake a POPIA defence on:

1. **One table.** Collapse `audit_logs` → `audit_log`. Fix the `onboarding/complete` writer. One place the trail lives.
2. **Append-only.** RLS/grants such that even the service role's normal path cannot update or delete rows; corrections are new rows.
3. **Never silent.** For operator actions specifically, a failed audit write should **fail the action**, not `console.error` and proceed. If we can't prove it happened, it doesn't happen.
4. **Operator actions double-keyed.** Actor = operator, plus the tenant acted upon, plus reason. "Who touched this tenant, when, why" must be a single query.

An operator console whose audit trail is optional is a liability generator. This tier is cheap and it gates everything above it.

---

## 7. Metrics — mostly surfacing, some building

Split honestly:

- **Already have the data:** AI cost per tenant, feature spend, abuse flags, live budgets (`ai-costs`). Needs a chart, not a backend.
- **Don't have:** business health — MRR, churn, active vs dormant tenants, trial→paid conversion. These derive from `subscriptions` + `tenants` + auth activity and are a genuine (small) build.
- **`impact` is not this.** It's social-impact storytelling (good for the Cartier positioning; see the award memory), not operations. Keep them separate surfaces.

---

## 7.1 The console as a mission instrument — SME bottlenecks, South Africa

This is the requirement the rest of the note serves. AdminOS exists to relieve the specific, structural frictions that stall a small business in South Africa. The operator console is where those frictions become **legible at scale** — and where Mirembe Muse intervenes before a stuck SME quietly leaves.

The product already touches most of these bottlenecks; the console's job is to turn each from an invisible per-tenant event into an operator signal plus an action. Grounding it in what the codebase already has:

| SME bottleneck (SA) | Already in the product | What the console should surface / do |
|---|---|---|
| **Informal → formal** (CIPC registration, staying compliant) | `api/formalization` | Flag tenants stalled mid-formalisation; nudge or assign help |
| **Cash flow / late payment** — the number-one SME killer | debt-recovery engine, invoices | Tenants with rising overdue ratios *before* they fold; comp/support trigger. (Note: debt-recovery is armed and sensitive — see [[debt-recovery-armed]]) |
| **SARS / statutory deadlines** (PAYE/UIF via EMP201, VAT) | `payroll/emp201` | Cohort view of who's approaching a filing they'll miss |
| **POPIA compliance** (they're an SME *and* a data processor) | `api/compliance`, delete-contact | Who has open compliance gaps; drives the erasure tooling in §5-B |
| **Employment Equity / B-BBEE reporting** | `api/ee`, `ee/report` | Which tenants are due, who's stuck |
| **Skills / know-how** | Academy + Langa mentor | Tenants going dormant → mentor or academy nudge, not a churn stat |
| **Access to informal finance** | stokvel | Health of stokvel usage; an Ubuntu-native feature worth protecting ([[ubuntu-philosophy]]) |

**The South-African operating reality is a hard design constraint, not a theme.** The console must assume its *users' users* live with:

- **Load-shedding and patchy connectivity.** The tenant app already leans on offline mode and cache warming. The operator's read of "dormant tenant" must not mistake *offline* for *disengaged* — a tenant working through a blackout is the opposite of a churn risk, and treating them as one is exactly the wrong intervention.
- **Expensive mobile data, WhatsApp-first behaviour.** The whole product is WhatsApp-centric for a reason. Operator *interventions* (a nudge, a support reach-out) should meet SMEs on that channel, not assume they'll open a web dashboard.
- **Multilingual reality** (the app already onboards in en/zu/xh/af/st). Anything the operator sends a tenant should respect their language, not default to English.

**The highest-value thing the console can do is aggregate.** One tenant stuck at formalisation is a support ticket. *Forty percent of tenants in a province* stuck at the same step is a **product or policy bottleneck** — and only the operator vantage can see it. Design the observe tier (§5-A) so systemic friction is a first-class view, not something you infer from scrolling tenants one at a time. That aggregate is also, not coincidentally, the honest version of the impact story (§7): impact you can *act on*, not just report to a prize committee.

**Guardrail.** None of this weakens §1's boundary. "Assist the SME" is a reason to *observe patterns and reach out*, never a licence to rummage in one business's books because it might be struggling. Cross-tenant aggregates are anonymised by default; touching an individual tenant's data is Tier C impersonation, gated and audited like everything else. The mission and the boundary are not in tension — Ubuntu is not surveillance.

---

## 8. What not to do

- **Don't gate the console on a JWT `role` claim.** `role` is in `app_metadata` now, but super-admin is the highest-value target in the system and belongs in the `admins` table, verified per request — exactly as the existing API routes already do. `isSuperAdmin` in `getContext()` enforces this; don't add a metadata shortcut.
- **Don't build impersonation before audit (§6).** Untraceable god-mode is the single most dangerous thing we could ship.
- **Don't keep the `OPERATOR_SECRET` header model "for now."** Two auth models is the drift that becomes the next breach. One gate, then delete the other.
- **Don't let the operator console read tenant data through `supabaseAdmin` ad hoc** the way the dashboard pages do. It legitimately crosses tenants, but it should do so through a small, named, audited access layer — so the bypass is countable, not sprinkled across 41 files a second time.
- **Don't 403.** 404. The surface should be invisible to non-operators.

---

## 9. What it costs

| Phase | Work | Risk |
|---|---|---|
| **O-0. Clear the blockers** | Fix `create-tenant` (§3a); unify audit table + fail-loud (§3b, §6) | Low — small, and (3a) is already broken in prod-to-be |
| **O-1. One gate** | Adopt `ctx.isSuperAdmin`, retire `OPERATOR_SECRET`, un-public `/operator` | Low |
| **O-2. Observe** | Reachable operator UI over existing `ai-costs`/`impact` + audit viewer; **+ the SME-bottleneck aggregate view (§7.1)** | Low — mostly wiring |
| **O-3. Lifecycle** | Suspend, plan, reset owner, roster mgmt; **POPIA erasure is its own hard sub-project** | Medium |
| **O-4. Metrics** | MRR/churn/active surfacing | Low |
| **O-5. Impersonation** | Audited, read-only, time-boxed act-as-tenant | **High — design-led, do last** |

O-0 is non-negotiable and independent: (3a) is a live break the moment Phase 0 deploys, and (3b)/§6 gate everything with a mutation.

---

## 10. Recommendation

1. **O-0 now**, folded into the Phase 0 deploy — the `create-tenant` fix ships *with* the migration, or operator onboarding breaks the day it goes live.
2. **O-1 + O-2 next**: one gate, and make the operator UI actually open. Small, high-leverage, turns a dead page into a working tool.
3. **Decide O-3/O-5 after O-2 is in your hands.** Lifecycle and impersonation are real feature workstreams; scope them against a console you can actually see, not from this document.

The through-line from `WORKSPACE_ARCHITECTURE.md`: AdminOS's recurring failure mode is answering the same access question in many places and drifting. The operator console is that question at its highest stakes. Build it as **one gate, one audit spine, power added downward** — or don't build it as a super-admin tool at all.
