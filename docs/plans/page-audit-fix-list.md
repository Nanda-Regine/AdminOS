# Page audit — combined fix list (2026-10-24)

Sources: `page-audit-win-work.md`, `-deliver.md`, `-team-govern.md`, `-grow-setup.md` (all code-level reads; live DB state unverified).
Rule: one logical change per PR, test that fails before / passes after, CI green before merge. Migrations and payment-flow changes are called out and held for approval.

## Batch order

| # | Batch | Why first | Needs approval |
|---|---|---|---|
| 1 | **Truthful numbers**: low-stock rule (reorder_level > 0, active only) on Ops / Inventory / alert; Ops SAST date + exclude cancelled bookings; Ops false all-clear on DB error | Wrong alerts and wrong dashboard figures | No |
| 2 | **Board pack + Valuation**: inclusive period end, payroll in net profit, failed run state, valuation reads real fields | Numbers owners show banks/investors | No |
| 3 | **Close the loops**: IR acknowledge writer + employee view, staff deactivate/offboard, safety incident update, licence edit/renew | Permanently-red health scores, leavers in payroll | No (soft delete only) |
| 4 | **AI cost safety**: Langa history cap + budget estimate + sanitise, autonomy read path fails closed | Budget bypass | No |
| 5 | **Documents / Tasks / Bookings correctness**: upload type list, task board statuses, booking server-side duration + tenant checks | User-visible dead ends | Contract-expiry trigger fix needs migration |
| 6 | **Contacts / consent**: contact_type default 'client' makes strangers marketable (POPIA s69); last_contacted_at writer | Legal exposure | Migration (default change) |
| 7 | **Billing lifecycle**: Paystack webhook errors→5xx, amount/currency check, idempotency, access_until on cancel | Revenue leakage | **Yes — payment flow** |
| 8 | **Community RLS** (verify live grants first) | Possible anon read of tenant_id | **Yes — prod migration** |
| 9 | Builds: bookings UI + public page, contract send/sign, stokvel contribution grid, KB reader, decision queue (Plan v2) | Larger features | Per item |

Everything in Batches 1–6 is code-only except where noted; Batches 7–8 wait for an explicit yes.
