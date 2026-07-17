# AdminOS — Workspace Architecture

> Design note · 17 July 2026 · Mirembe Muse (Pty) Ltd
> Status: **proposal, not yet agreed.** Written to be argued with.
> **Phase 0 is built** (17 July 2026) — see §7.1. Phases 1–4 remain proposals.

---

## 1. The thesis

The ask was "Notion/ClickUp on steroids, with business-level detail — a workspace a business owner dreams of."

That's the right instinct, but it is **not a UI project**. Notion and ClickUp are not workspaces because of how they look. They're workspaces because each is built on **one primitive that composes**, and everything else is a *view* over it. Notion's is the block/page-with-properties. ClickUp's is the task-with-custom-fields. Add a feature to either and you are usually adding *data*, not *code*.

AdminOS today is the opposite. It is **41 dashboard pages, each with its own tables, its own queries, and its own idea of who's allowed to see what.** That isn't a workspace — it's 41 small apps sharing a nav bar. And it doesn't just cost velocity. It is actively, measurably unsafe. See §2.

The goal of this note: name the primitive, show what collapses into it, and be honest about what it costs.

---

## 2. Why this is urgent, not cosmetic

Measured on the current tree (2026-07-17):

| | Count |
|---|---|
| Dashboard pages | **41** |
| Pages reading `tenant_id` from `user_metadata` | **33** |
| Pages querying via `supabaseAdmin` (service role — **bypasses RLS**) | **31** |
| Pages calling `requirePermission` | **0** |

Those four numbers are one number. Because there is no shared data-access layer, every page re-implements *"who am I, what tenant am I, am I allowed"* by hand — and 41 hand-written answers to a security question produce 41 chances to be wrong.

They are wrong. `tenant_id` is read from `user_metadata`, which **the user can rewrite themselves** (`supabase.auth.updateUser`). `current_tenant_id()` in RLS reads the same spoofable value (`schema.sql:464`). The 31 service-role pages bypass RLS altogether and filter on that same value. And `lib/auth/permissions.ts:134` — `if (!userPerms) return true` — **fails open**, so spoofing a tenant you have no role in grants owner-equivalent access.

The team already understood this vector: `20260612_admins_table.sql:6-8` documents it precisely and fixes it — for super-admin only, correctly, via a DB table. `tenant_id` never got the same treatment.

**The point for this note:** the super-admin fix worked because there was *one* place to fix. Tenant isolation is broken because there are *31*. That is an architecture problem wearing a security costume, and no amount of careful patching survives feature #42.

> The workspace refactor is not a nice-to-have. **It is the structural form of the security fix.**

---

## 3. The primitive

The tempting answer is "everything is a Record" — one flexible table, JSONB fields, tenant-definable types, Notion-style. **Do not do this wholesale.** Payroll in JSONB is how you get the payslip bugs this codebase already has, with no constraints to catch them. Money and statutory records need typed columns, foreign keys, check constraints, and an append-only audit trail. Flexibility there is a liability, not a feature.

The honest answer is **two tiers with one door**.

### Tier 1 — Ledger (typed, constrained, boring on purpose)

`invoices`, `payslips`, `payroll_runs`, `expenses`, `staff`, `contracts`, `payments`, `disciplinary_records`.

Anything that is money, statutory, or evidentiary. Real columns. Real constraints. Real audit. **These do not become records and are not tenant-redefinable.** If it could end up in front of SARS, the CCMA, or a court, it gets a schema.

Escape hatch: a `custom_fields jsonb` column, for tenant-specific extras that are *not* load-bearing.

### Tier 2 — Workspace records (flexible, composable)

```sql
records (
  id, tenant_id, type,          -- type is tenant-definable
  title, fields jsonb,          -- schema lives in record_types
  parent_id, position,          -- nesting + ordering
  created_by, created_at, updated_at
)
record_types  (tenant_id, key, label, field_schema jsonb, views jsonb)
record_links  (from_id, to_id, rel)   -- also links records → ledger rows
```

Tasks, notes, SOPs, docs, pipelines, checklists, CRM stages, project boards, and anything a tenant invents. This is the Notion half, and it's where "on steroids" actually lives.

### The bridge

`record_links` lets a workspace record point at a ledger row. A task references an invoice. A project references a contract. A checklist references a payroll run. **The flexible layer wraps the rigid layer instead of replacing it** — you get Notion's composability without putting VAT in a JSON blob.

---

## 4. The one door

Every read and write — both tiers — goes through a single access layer:

```ts
const ctx = await getContext()        // verified tenant + role + permissions
const rows = await ctx.list('invoice', { status: 'unpaid' })
```

`getContext()` resolves tenant from **`app_metadata`** (service-role writable only — not user-writable), loads the role from `user_roles`, and **fails closed**. `ctx.list/get/create/update` apply tenant scope and permission checks centrally. `supabaseAdmin` becomes illegal in page code — lint-enforced.

This is the entire security model in one file instead of 41. It is right once or wrong once. Today it is wrong 31 times and nobody can hold that in their head — which is exactly how it stayed wrong.

---

## 5. The view engine

Each entity registers a **descriptor** — data, not a page:

```ts
export const invoiceDescriptor = {
  type: 'invoice',
  label: 'Invoices',
  fields: [
    { key: 'number',   label: 'Invoice',  type: 'text' },
    { key: 'contact',  label: 'Client',   type: 'relation', to: 'contact' },
    { key: 'total',    label: 'Total',    type: 'currency' },
    { key: 'status',   label: 'Status',   type: 'select', options: [...] },
    { key: 'due_date', label: 'Due',      type: 'date' },
  ],
  views: [
    { kind: 'table',    default: true },
    { kind: 'board',    groupBy: 'status' },
    { kind: 'calendar', dateKey: 'due_date' },
  ],
  actions: [{ key: 'send', label: 'Send', permission: 'manage_invoices' }],
}
```

Six generic view components — `table`, `board`, `calendar`, `list`, `detail`, `form` — render every entity in the product. Adding a feature becomes **writing a descriptor**, not writing a page. Filters, sorts, grouping, saved views, bulk actions, CSV export, and keyboard nav get built once and every entity inherits them. That is the "on steroids" part: today no page has saved views because that's 41 implementations; with descriptors it's one.

**41 bespoke pages → ~6 view components + 41 descriptors.** The descriptors are mostly deletion.

---

## 6. Why this is also the business model

`record_types` is tenant-definable. That means a tenant can define their own entity — "Kilns", "Site Visits", "Matters" — with their own fields and views, **without Mirembe Muse writing code**.

That is the customisation tier, productised. Today, custom work means bespoke engineering per client, which does not scale past a handful of clients and burns the founder's time. With record types, most "can you add X for us" requests become configuration — done in an hour, sold at a margin, delivered without a deploy. The genuinely bespoke work (integrations, migrations, custom logic) stays a services engagement, but it stops being the *only* answer.

It also matches the legal repositioning from the audit. A workspace primitive is inherently **record-shaped** — "this is what you entered" — not advisor-shaped — "this is what's true about your business." The architecture and the liability posture want the same thing.

---

## 7. What it costs — honestly

This is a real refactor, not a weekend. Roughly:

| Phase | Work | Risk |
|---|---|---|
| **0. Fix the door** | `app_metadata` migration, `getContext()`, fail-closed permissions, ban `supabaseAdmin` in pages | Medium — must migrate existing user metadata before the switch or everyone locks out |
| **1. Descriptors for 3 entities** | Prove the engine on invoices, tasks, contacts | Low — new code beside old |
| **2. Migrate the long tail** | ~30 pages → descriptors, delete the bespoke pages | Low per page, tedious in aggregate |
| **3. Records tier** | `records` + `record_types` + custom views | Medium — new surface |
| **4. Tenant-defined types** | The upsell tier | Low once 3 lands |

**Phase 0 is non-negotiable and independent** — it must happen whether or not the rest does, because it's the security fix. Everything after is genuinely optional and can stop at any phase without waste.

Do **not** big-bang this. The engine goes in beside the current pages, three entities move, and the rest migrate when touched.

---

## 7.1 Phase 0 — built, 17 July 2026

What shipped, and three things this note got wrong.

**The count was too low.** §2 says 41 pages and 31 query sites. The actual sweep touched **208 read sites across ~150 files** — the dashboard pages were only a fifth of it; most of the exposure was in `app/api/**`. The argument survives the correction and arguably gets stronger: it was never 41 chances to be wrong, it was 208.

**It wasn't only `tenant_id`.** Four more security claims lived in user-writable `user_metadata`, each with a live consequence:

| Claim | What a user could do by rewriting it |
|---|---|
| `tenant_id` | Read any tenant's entire dataset |
| `role` | Assert a role they were never granted |
| `suspended` | Un-suspend their own account |
| `trial_expired_at` | Grant themselves an unlimited trial |
| `staff_id` | Read any colleague's payslip (`/api/payroll/payslip/[id]`) |

`plan` was in `user_metadata` too, but `requirePlan`/`hasPlan` turn out to be dead code — the free-tier upgrade was latent, not live. It moved anyway.

**Two bugs found while fixing it, neither in the original audit:**

- `/api/onboarding/create-tenant` sat under middleware's `PUBLIC_PREFIXES` and took `userId` from the request body with **no auth check at all** — an unauthenticated caller could provision tenants against any account. It now derives the caller from the session.
- Roles were seeded only on `subscription.activated` — i.e. after payment — while tenants are created at signup. Fail-closed permissions would therefore have locked out **every new user until they paid**. Worse, the seeding step read `settings.owner_user_id`, which `create-tenant` never set, so it silently no-oped for every tenant ever created. Tenant creation now seeds roles and grants ownership.

What landed:

| | |
|---|---|
| `20260717_phase0_tenant_isolation.sql` | Backfills the claims into `app_metadata`; rewrites `current_tenant_id()` to read `app_metadata` only. One function fixes ~40 RLS policies at once — §2's thesis, demonstrated. |
| `20260717_phase0_strip_user_metadata.sql` | Deletes the stale copies. **Apply after the deploy, not with it.** |
| `lib/auth/context.ts` | `getContext()` / `requireContext()` — the one door. Fails closed. |
| `lib/auth/permissions.ts` | `if (!userPerms) return true` → fails closed. |
| 208 sites | `user_metadata` → `app_metadata`. |
| `eslint.config.mjs` | `user_metadata` security reads are an **error**. `supabaseAdmin` in `app/dashboard/**` is a **warn** — 31 pages still import it and `next build` lints, so erroring would fail the deploy. Flip to error when Phase 2 lands. |

**The breach is closed but the door is not yet load-bearing.** The 208 sites now read an unforgeable tenant, which is what closes the vulnerability — but they still read it *themselves* rather than through `getContext()`, and 31 pages still bypass RLS via `supabaseAdmin`. So the security fix is done; the architecture fix is scaffolded and unadopted. Adoption is Phase 1–2 work, one page at a time, and the lint warn is the ratchet that keeps it honest.

**Deploy order matters** — the app must go out between the two migrations, and `app_metadata` only reaches a session on token refresh, so sessions issued before the cutover see a NULL tenant until their JWT expires (~1h).

---

## 8. What not to do

- **Don't put money in JSONB.** Ledger stays typed. Non-negotiable.
- **Don't let tenants redefine statutory entities.** A tenant-defined "payslip" is a compliance incident.
- **Don't rebuild the UI first.** The nav is not the problem. The 31 query sites are.
- **Don't ship record types before Phase 0.** Flexible entities on a broken tenant boundary multiplies the blast radius.
- **Don't chase Notion's full block model.** Nested blocks, inline databases, and real-time collaborative editing are years of work and are not why an SME owner would pay R899/month. Records with fields and views are 90% of the value for 10% of the work.

---

## 9. The recommendation

1. **Phase 0 now**, independent of everything else. It's the security fix and the audit's biggest open item.
2. Build the descriptor engine on **three** entities. Judge it in the flesh.
3. Decide on the records tier *after* seeing the engine work — not from this document.

The thing worth internalising: **AdminOS's problem was never a missing feature.** It has more features than most Series-A products. Its problem is that every feature was built as an island, and the islands each re-answered the same security question differently. One door and one view engine is what turns 41 apps into a workspace — and it's the same move that makes it safe.
