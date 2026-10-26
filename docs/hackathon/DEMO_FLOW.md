# FNB App Hackathon — 3-minute demo flow

Tenant: **Mzansi Test Traders** (East London hardware & household goods trader, `partner` plan).
Every screen below was loaded and screenshotted on production at desktop (1440px) and phone (390px)
width with `node scripts/hackathon/walk.mjs`; none had horizontal overflow or an error page.

Before you start: open the app logged in as the demo owner, choose **Necessary only** on the cookie
banner, and open every tab below once so nothing loads cold on camera. Don't sign up live — the
email provider key is dead, so a signup email will not arrive.

| Time | Screen | Say | Point at |
|------|--------|-----|----------|
| 0:00 | Command Center `/dashboard` | "A founder opens one screen instead of five apps." | "R 14 134 is stuck in collections", Needs You Now, quarterly goals |
| 0:30 | Cash Cockpit `/dashboard/money` | "It tells her who owes her money and who to chase first." | Net position, 60+ day debt, Review recovery queue |
| 1:00 | Invoices `/dashboard/invoices` | "Tax invoices, receipts, and Quick Sale for cash customers." | Status chips, Record payment, **Quick Sale** button (open the modal, don't submit) |
| 1:10 | **Bank & Reconcile `/dashboard/bank`** | "Upload an FNB statement and the books close themselves." | The categorised lines, a payment matched to its invoice, then tap **Confirm payment** (or **Confirm 2 sure matches**) and show the invoice flip to paid |
| 1:30 | Compliance `/dashboard/compliance` | "The fear every founder has, answered in one click." | The "If you miss it" penalty column |
| 1:50 | Inbox `/dashboard/inbox` | "Customer conversations in their own language. WhatsApp is next." | The isiZulu conversation, answered in isiZulu |
| 2:15 | Bookings `/dashboard/bookings` | "A booking diary with confirmations; the 24-hour reminder is built in for when WhatsApp is connected." | This week's schedule |
| 2:30 | Getting Started `/dashboard/getting-started` | "The guide speaks isiZulu, isiXhosa and Afrikaans too." | Language chips |
| 2:45 | Phone view (390px) | "Built for a mid-range Android on prepaid data." | Cash Cockpit on mobile |
| 3:00 | Roadmap slide | "Next: import an FNB statement, reconcile it to invoices, and give founders a bank-ready profile." | Live vs Next table |

## Don't claim
- **A live bank connection, pay-from-invoice, credit-readiness profile** — roadmap only. The bank loop is a CSV upload, not an FNB integration.
- **Anything WhatsApp (not set up; we are app-native today), including live sending for this tenant** — the Inbox conversations are sample data; the Meta Tech Provider
  onboarding is still in progress.
- **Third-party integrations** (Gmail, Xero, PayFast) — shown as "coming soon" in Settings; don't open that tab.
- The Inbox, this week's bookings and the task due dates were refreshed for the demo with
  `scripts/hackathon/refresh-demo-data.mjs` and `refresh-demo-bookings.mjs`; they are sample data.

## Also don't claim
- **A public booking page.** Customers cannot book online yet; Bookings is the owner's diary.
- **Auto-settle or undo on bank matches.** One tap confirms a match; nothing settles automatically.
- **"Runs her business on it".** The first beta user's tenant has 1 invoice and 3 contacts; say "trialling it since August".
- **Web offline support.** Only the Android staff app queues clock-ins offline.

## Judges' login
Sign in at https://adminos.co.za/login as `founder@adminos-demo.co.za`. The password is on the last slide of the pitch deck. It is the owner of the sample "Mzansi Test Traders" business only (not an admin). Rotate it after judging with `node scripts/hackathon/set-judge-password.mjs`.
