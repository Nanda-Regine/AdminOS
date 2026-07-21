# Meta WhatsApp Template Setup — Step-by-Step

**Goal:** Get AdminOS's outbound WhatsApp messages approved and working in Meta Business Suite.

**Why this is needed:** WhatsApp only lets you send **free-form** messages inside a **24-hour window** after a customer last messaged you. Outside that window (reminders, alerts, onboarding, wellness check-ins), you **must** use a **pre-approved template**. Until the templates below are approved, those automated sends silently defer.

> **Source of truth:** `lib/whatsapp/templates.ts` — `WHATSAPP_TEMPLATES` (names) and `TEMPLATE_BODIES` (exact body text with `{{1}}`, `{{2}}` variables). **Always copy the body text from that file** when creating a template so the wording never drifts. This doc tells you the *how*, *category*, and *variable count*; that file has the canonical text.

---

## ⚠️ READ THIS FIRST — two things that will waste your day if you miss them

1. **Language code = `en` (NOT `en_ZA`).** Meta's WhatsApp template languages are `en`, `af` (Afrikaans), `zu` (Zulu), `xh` (Xhosa) — there is **no `en_ZA`/`zu_ZA`**. Create every template in **English (`en`)**. *(The code used to send `en_ZA` and would 404 on every template — fixed on 2026-07-21 so the app now sends `en`/`af`/`zu`/`xh`.)*

2. **The number of `{{ }}` variables in the template body MUST equal the number of parameters the code sends.** If the template has 3 variables but the code sends 1, the send fails with a parameter-count error. Two wired callers currently under-fill their templates — see **"Wiring gaps to close before going live"** at the bottom. Fix those (or simplify those template bodies) before turning on automated sends.

---

## Prerequisites (do these once, before creating templates)

- [ ] A **Meta Business account** with a **WhatsApp Business Account (WABA)**.
- [ ] A **verified phone number** connected to the WABA (Business verification may be required to lift messaging limits).
- [ ] Set these environment variables in **Vercel → Project → Settings → Environment Variables** (Production):
  - `META_WHATSAPP_ACCESS_TOKEN` — a **permanent** System User access token with `whatsapp_business_messaging` + `whatsapp_business_management` permissions (not the temporary 24-hour token).
  - `META_PHONE_NUMBER_ID` — the Phone Number ID (from WhatsApp Manager → API Setup, **not** the display phone number).
  - `META_WEBHOOK_SECRET` — the verify token you set when subscribing the webhook (for inbound messages).
- [ ] Confirm the app targets Cloud API **v19.0** (it does — `lib/whatsapp/send.ts`).

---

## How to create ONE template (repeat per template)

1. Go to **Meta Business Suite → WhatsApp Manager → Message Templates → Create Template** (or business.facebook.com/wa/manage/message-templates).
2. **Category:** pick **Utility** or **Marketing** per the tables below. *(Utility = transactional/triggered by an event; approves faster and costs less. Marketing = promos/re-engagement.)*
3. **Name:** type the **exact** name from the registry, e.g. `adminos_wellness_checkin`. Must be **lowercase + underscores**, and must match `WHATSAPP_TEMPLATES` character-for-character or the app can't find it.
4. **Language:** **English** (`en`). *(Add `af`/`zu`/`xh` copies only if you're doing multilingual — the app picks the language per contact.)*
5. **Body:** paste the exact text from `TEMPLATE_BODIES` in `lib/whatsapp/templates.ts`. Keep the `{{1}}`, `{{2}}` … placeholders.
6. **Sample values:** Meta requires an example for each variable (e.g. `{{1}}` → `Sipho`, `{{2}}` → `INV-1042`, `{{3}}` → `1,500`). Use realistic samples — vague ones get rejected.
7. **No variable may sit at the very start or very end of the body**, and don't put two variables back-to-back — Meta rejects those. (The registry bodies already follow this.)
8. Submit. Approval usually takes **minutes to a few hours** (occasionally up to 24h).

---

## 🔴 PRIORITY — create these first (they're wired to live automation)

These are the templates the app **actually sends today** via Inngest jobs. Approve these first so those flows work; the rest can follow.

| Template name | Category | Vars | Sent by | Notes |
|---|---|---|---|---|
| `adminos_wellness_checkin` | Utility | 2 | `wellnessFanOut` cron (Care agent) | ⚠️ caller currently sends **1** of 2 vars — see wiring gaps |
| `adminos_onboarding_welcome` | Utility | 3 | `onboardingSequence` (on signup) | ⚠️ caller currently sends **1** of 3 vars — see wiring gaps |
| `adminos_debt_tier1_friendly` | Utility | 5 | Chase / debt recovery | Debt recovery sends free-form inside the 24h window today; template wiring is a TODO. Create it so it's ready. |
| `adminos_debt_tier2_followup` | Utility | 5 | Chase / debt recovery | as above |
| `adminos_debt_tier3_firm` | Utility | 5 | Chase / debt recovery | as above |

**Variable meanings for the priority ones** (from the body text):
- `adminos_wellness_checkin` — `{{1}}` staff name · `{{2}}` business name.
- `adminos_onboarding_welcome` — `{{1}}` business name · `{{2}}` owner name · `{{3}}` getting-started link.
- `adminos_debt_tier1_friendly` — `{{1}}` client name · `{{2}}` invoice # · `{{3}}` amount · `{{4}}` due date · `{{5}}` pay link.

---

## Full template catalogue (all 44)

Create each in **English (`en`)** with the exact name + body from `lib/whatsapp/templates.ts`. **Vars** = number of `{{ }}` placeholders you must provide sample values for.

### Debt recovery — **Utility**
| Name | Vars |
|---|---|
| `adminos_debt_tier1_friendly` | 5 |
| `adminos_debt_tier2_followup` | 5 |
| `adminos_debt_tier3_firm` | 5 |
| `adminos_debt_tier4_final` | 5 |
| `adminos_debt_tier5_demand` | 4 |

> Tiers 4–5 are **owner-reviewed drafts**, never auto-sent. They state facts only (what's owed, who to call) — no threats, no legal references. Keep the wording exactly as in the registry (it's compliance-worded).

### Staff wellness (Care) — **Utility**
| Name | Vars |
|---|---|
| `adminos_wellness_checkin` | 2 |
| `adminos_wellness_support` | 3 |
| `adminos_wellness_burnout_alert` | 3 |
| `adminos_wellness_monthly_pulse` | 1 |

### Appointments — **Utility**
| Name | Vars |
|---|---|
| `adminos_appt_reminder_24h` | 4 |
| `adminos_appt_reminder_1h` | 4 |
| `adminos_appt_confirmed` | 4 |
| `adminos_appt_reschedule` | 3 |
| `adminos_appt_cancelled` | 3 |

### Invoices & payments — **Utility**
| Name | Vars |
|---|---|
| `adminos_invoice_sent` | 6 |
| `adminos_payment_received` | 4 |
| `adminos_invoice_overdue` | 5 |
| `adminos_partial_payment` | 5 |
| `adminos_statement_monthly` | 5 |

### Quotes & proposals — **Utility**
| Name | Vars |
|---|---|
| `adminos_quote_sent` | 6 |
| `adminos_quote_followup_48h` | 4 |
| `adminos_quote_followup_7d` | 5 |
| `adminos_quote_expiring` | 5 |
| `adminos_quote_accepted` | 4 |

> `quote_followup_*` are gentle nudges — if Meta reclassifies them as **Marketing** on review, accept it; the wording is fine either way.

### Client onboarding — **Utility**
| Name | Vars |
|---|---|
| `adminos_onboarding_welcome` | 3 |
| `adminos_onboarding_step` | 4 |
| `adminos_docs_request` | 3 |

### Documents — **Utility**
| Name | Vars |
|---|---|
| `adminos_document_request` | 5 |
| `adminos_document_received` | 4 |
| `adminos_document_expiring` | 4 |
| `adminos_contract_renewal` | 4 |

### Service delivery — **Utility**
| Name | Vars |
|---|---|
| `adminos_job_started` | 4 |
| `adminos_job_completed` | 5 |
| `adminos_job_delayed` | 4 |
| `adminos_delivery_scheduled` | 5 |
| `adminos_delivery_completed` | 3 |

### Customer engagement — **Marketing** (except survey)
| Name | Category | Vars |
|---|---|---|
| `adminos_satisfaction_survey` | Utility | 3 |
| `adminos_referral_request` | Marketing | 4 |
| `adminos_re_engagement_30d` | Marketing | 3 |
| `adminos_re_engagement_90d` | Marketing | 3 |
| `adminos_seasonal_promo` | Marketing | 5 |

### Owner / admin alerts — **Utility**
| Name | Vars |
|---|---|
| `adminos_brief_ready` | 5 |
| `adminos_escalation_alert` | 5 |
| `adminos_payment_alert` | 5 |
| `adminos_new_client_alert` | 3 |
| `adminos_staff_concern_alert` | 3 |
| `adminos_goal_achieved` | 3 |

---

## ⚠️ Wiring gaps to close BEFORE turning on automated sends

The template **names and language** are correct in code, but two live callers don't yet fill all the template variables. Approving the templates isn't enough — reconcile these so the parameter counts match, or the send returns a `132000`-class error:

1. **`onboardingSequence.ts`** → `adminos_onboarding_welcome` (3 vars) but sends **1** (`ownerName`). Either pass all 3 (business name, owner name, getting-started URL) or create a 1-variable version of the template body.
2. **`wellnessFanOut.ts`** → `adminos_wellness_checkin` (2 vars) but sends **1** (`full_name`). Add the business name as `{{2}}` or simplify the body to 1 variable.
3. **`debtRecovery.ts`** currently sends **free-form** text (works only inside the 24h window) and defers otherwise — see its inline comment. To use the debt templates, map invoice fields → the 5 body params (name, invoice #, amount, due date, pay link) and switch it to `sendWhatsAppTemplate`.

*(General rule: for any template you want to auto-send, confirm the caller passes exactly as many `{ type: 'text', text: … }` params as the body has `{{N}}` — in the order they appear.)*

---

## After approval — verify it actually works

1. Confirm the three env vars are set in Vercel (Production) and redeploy if you just added them.
2. Approved templates show **Status: Active** (green) in WhatsApp Manager.
3. Test one end-to-end: trigger a wellness check-in (or send a test via the Cloud API) to a number that has opted in, and confirm it arrives.
4. Watch for send errors in the logs — the two common ones are `(#132001) template does not exist` (name/language mismatch) and `(#132000) number of parameters does not match` (the wiring gaps above).

---

*Prepared 2026-07-21. Registry: `lib/whatsapp/templates.ts` · Send path: `lib/whatsapp/send.ts` (Cloud API v19.0).*
