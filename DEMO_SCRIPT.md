# AdminOS — Conference Demo Script (W8)

**Written:** 2026-08-17 · **Conference:** 2026-08-18 · **Author:** Claude with Nandawula Regine
**Companion docs:** `CONFERENCE_READINESS_PLAN.md` (the sprint plan), `BUILD_JOURNEY_ADMINOS.md` (what shipped, roadmap)

> Per the project golden rule, this script goes to memory + the repo before the walkthrough is
> rehearsed, so nothing depends on a single laptop or a live memory of what was decided.

---

## 0. The one decision this script assumes

**Lead vertical: creative & media** (video/production agency), told through **Jael Malavila's
real tenant** — a live customer, not a hypothetical. Resolved 2026-08-17; see
`CONFERENCE_READINESS_PLAN.md` §9. Retail/trades (Suppliers + B-BBEE, just shipped) is the
natural second act if there's time or a follow-up question steers there.

**Do not use `/demo` as the primary walkthrough.** It role-plays "Thabo Dlamini Attorneys" — a
law firm. Legal was *deliberately removed* from the industries AdminOS markets itself to
(`app/page.tsx:139-143` — Section 86 trust accounting is a regulatory disqualifier, not a
feature gap AdminOS can close). Walking a law firm on stage the day after that decision was
written contradicts it in front of the exact audience it's meant to protect. `/demo` is fine as
a **leave-behind** attendees explore on their own phones afterward — it's now honestly labeled
sample data on every screen size — just don't drive it live yourself.

---

## 1. Before you walk on stage (do this tonight or tomorrow morning, not live)

- [ ] **Log into Jael's tenant in advance** and leave the session warm. Her `/auth/confirm`
      route was pushed 16 Aug but the invite email itself can't be trusted — `RESEND_API_KEY`
      is still dead (deprioritized for the conference, see plan §9 item 4). If her session
      expires mid-demo, there is no live-email fallback. Have a second logged-in tab/device as
      backup.
- [ ] **Check Jael's tenant has enough real data to not look empty.** She was onboarded
      2026-08-14 — three days before this was written. The Command Center pulls from
      `invoices`, `contracts`, `bookings`, `tasks`, `goals`, `compliance_items` — if most of
      those are still empty, the opening screen reads as bare rather than "a business
      genuinely running through this." If it's thin, either add a handful of real-looking
      records to her tenant with her permission before the conference, or open on Suppliers/
      Compliance instead of the Command Center (see §3 alt opener).
- [ ] **Verify her `business_type`** in Supabase directly (not available via this session's
      MCP connection — check the dashboard). The sidebar hides Inventory/Creative Assets/
      Stokvel by industry (`lib/nav/features.ts:93,96,120`); Creative Assets only shows for
      `business_type` in `other | property | ngo`. If hers is unset it fails open and shows
      everything, which is fine — but confirm rather than assume.
- [ ] **Pre-open every tab you'll click into** — dashboard, Suppliers, Compliance Calendar,
      Licences, Contacts. Conference wifi is not a variable to test live.
- [ ] **Do not attempt a live signup or invite flow.** Email is dead end to end (see above).
      If asked "can I sign up right now?", answer with the pricing page + your own follow-up,
      not a live `/signup`.
- [ ] Phone charged, mirrored or on a stand attendees can see if you're driving mobile —
      most of the room will be on Android at ~390px, which is exactly what got the mobile
      pass this sprint.

---

## 2. The narrative arc (~8–10 minutes core, extendable)

**Opening line:** *"This is Jael's business. She runs a video production agency in
Joburg — real client, real data, nothing staged."* Say this before anything else. It's the
single biggest credibility move available, and it's true.

Arc: **the problem → the day-to-day → the SA-specific proof → the close.**

1. **The problem (30s, no screen):** SA SME owners run their business through five apps
   and a notebook — invoicing here, WhatsApp there, compliance deadlines in their head.
   AdminOS is one system, WhatsApp-native, that actually knows their business.
2. **The day-to-day (Command Center → Contacts → Invoices):** how AdminOS runs the daily
   admin grind for a real creative business.
3. **The SA-specific proof (Suppliers/B-BBEE → Compliance Calendar → Licences):** the part
   competitors (Xero, QuickBooks, generic CRMs) cannot touch — this is the "cannot find the
   hole" moment from the plan's own bar.
4. **The close (pricing + WhatsApp inbox):** how someone in the room gets started today.

---

## 3. Screen-by-screen

### A. Command Center (`/dashboard`)
**Say:** "Every morning, Jael opens this — not five apps, one screen." Point at whatever is
genuinely populated: overdue invoices, upcoming bookings, open tasks, compliance deadlines.
The daily AI brief card is the moment to pause on if it has real content — it's the single
most "this thinks like an operator" surface in the product.

**Alt opener if Command Center is thin:** open on Contacts or Suppliers instead and come back
to Command Center once you're mid-story and it has more to point at. Don't apologise for an
empty state on stage — pivot past it in one sentence and move on.

### B. Contacts (`/dashboard/contacts` → a real client's `[id]` page)
**Say:** "Every client relationship in one place." Click into a real contact — the profile,
conversation history, invoices, financial summary. This is also where you can show the
**Edit Contact** modal shipped today if you want a "we listen and iterate fast" beat — but
only if it's smooth in rehearsal; don't debut anything live you haven't clicked through
yourself first.

### C. Invoices (`/dashboard/invoices`)
**Say:** "Debt recovery, not just record-keeping." Point at the overdue total and the
recovery queue if populated. This is the AR-chasing story — genuinely one of the strongest
built capabilities per the roadmap's own diagnosis.

### D. Suppliers (`/dashboard/suppliers`) — the SA differentiator, act one
**Say:** "Every South African SME with government or corporate clients needs a B-BBEE
scorecard. This is the only part of the product a generic international tool cannot copy —
it doesn't know what a B-BBEE level is." Point at the level distribution chips and the
women-/youth-owned counts. If Jael's supplier list is thin, this is where a quick second
tenant (or a screenshot) covers the gap — say so plainly rather than pretend a one-supplier
table is a full scorecard.

### E. Compliance Calendar (`/dashboard/compliance`)
**Say:** "Nineteen real SARS and CIPC deadlines, pre-loaded, with the actual penalty for
missing each one." Click one open — EMP201, IRP6, whichever is soonest — and read the
penalty text aloud. This lands harder than any UI polish in the room: it's the fear every
SME owner already has, answered in one click.

### F. Licences & Permits (`/dashboard/licenses`)
**Say:** "And the same for professional licences and permits — one place, with reminders
that actually fire before they lapse." (This page shipped 16 Aug specifically because the
reminders existed and had nowhere to point.)

### G. WhatsApp inbox (`/dashboard/inbox`) — the close
**Say:** "And all of this is WhatsApp-native — the channel every SA SME already lives in."
This is the emotional close: point back at the six AI agents (Alex, Chase, Care, Doc,
Insight, Pen — the same six named in `/demo`, so if someone explores the leave-behind
afterward the story is consistent) and land on pricing (R349/month entry point).

---

## 4. If retail/trades comes up (second act / audience-steered)

Suppliers + B-BBEE already covers most of it. If a retailer or tradesperson asks a direct
question, pivot to **Inventory** (`/dashboard/inventory`) — low-stock alerts, stock value at
cost vs retail — and, if you have a moment, click into a single product's new detail page
(`/dashboard/inventory/[id]`, shipped today) to show the transaction history. This is
freshly shipped — rehearse the click path once before relying on it live.

---

## 5. Things not to click into live (poke-surface honesty gaps, not yet closed)

These aren't broken in a way that crashes anything, but they're unfinished enough to avoid
volunteering:

- **Settings → Integrations.** Gmail/Calendar/Drive/Xero/PayFast now honestly say "Coming
  soon" instead of dead-clicking, but there's still no real OAuth behind any of them. If
  someone asks "can I connect my Xero right now" — answer verbally ("on the roadmap, not
  live yet"), don't open the tab to show them.
- **Live signup/invite.** Covered in §1 — email is dead.
- **`/dashboard/settings/onboarding`'s business-type dropdown**, if you're showing how a new
  tenant sets up. It still offers "Clinic / Medical" and "Legal" as options, which the
  landing page deliberately does *not* market to (see §0). If a doctor or attorney in the
  audience picks their real industry there expecting a fit, there's nothing stopping them —
  this is flagged for a post-conference fix, not something to demo around live, but don't
  walk through this specific screen if you can avoid it.

---

## 6. Objection handling

| Objection | Answer |
|---|---|
| "How is this different from Xero/QuickBooks?" | They do books. This runs the *business* — WhatsApp, compliance deadlines with real penalties, B-BBEE, staff, all in one system built for how SA SMEs actually operate. |
| "What about my industry — construction / logistics / clinic?" | If it's on the marketed list (`app/page.tsx` industries — construction, logistics, retail, events, cleaning, NGOs, schools, property, accounting, salons, consulting, creative): yes, confidently. If it's legal or medical specifically: be honest — those need regulatory features (trust accounting, medical scheme claims) AdminOS doesn't have yet, and say so rather than overpromise. |
| "Can I try it right now?" | Hand them the pricing page / your contact details for follow-up. Do not attempt live signup (§1). |
| "Is my data safe?" | Yes — POPIA-aware, tenant-isolated (mention the RLS hardening work if it's a technical questioner), South African hosting story if applicable. |

---

## 7. Fallback plan

If wifi drops or a page fails to load: you have screenshots/a recorded walkthrough as backup
(record one during rehearsal, not on stage). Never debug live — narrate past a failure
("let me show you this on the next screen instead") rather than reloading and hoping.

---

## 8. Post-conference, same day

Update `CONFERENCE_READINESS_PLAN.md` §8 with what actually happened, what broke, and what
questions came up repeatedly — that becomes the next roadmap pass.
