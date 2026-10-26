// Builds docs/hackathon/PRESENTER_SCRIPTS.{html,pdf}: 30-second scripts for the
// pitch-deck slides and the live-demo menu pages, split across three speakers.
// Facts were checked against the code, CI and the live database on 26 Oct 2026.
//   node scripts/hackathon/build-scripts.mjs
// The judge login is read from scripts/hackathon/.judge-login.json (gitignored).
import fs from 'fs'
import path from 'path'
import { pathToFileURL } from 'url'
import { chromium } from '@playwright/test'

const dir = path.join(process.cwd(), 'docs', 'hackathon')
const login = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'scripts', 'hackathon', '.judge-login.json'), 'utf8'))

const SPEAKERS = { 1: 'Speaker 1', 2: 'Speaker 2', 3: 'Speaker 3' }

const DECK = [
  { n: 1, sp: 1, title: 'Title', show: 'Title slide.',
    say: "Hi everyone, we're Mirembe Muse, from East London in the Eastern Cape, and this is AdminOS. I'm ____, and with me are ____ and ____. AdminOS is the business operating system that takes a young South African founder from “I have an idea” to “I run a business”. Today it's app-native, with WhatsApp coming next. It's live at adminos.co.za, and we'll show you what it does and why a bank is the right partner for it." },
  { n: 2, sp: 1, title: 'The problem', show: 'Four problem cards.',
    say: "Starting a business is the easy part. Staying alive is what nobody teaches. Customers owe founders money, and they're too polite or too busy to chase it. SARS, CIPC and COIDA penalties arrive before they knew the deadline existed. A WhatsApp chat and a notebook can't prove to a bank that the business is real. And the tools out there are five separate apps, built for the US, not for load-shedding and prepaid data." },
  { n: 3, sp: 1, title: 'The idea', show: 'The four-step loop.',
    say: "So we built one loop: get paid, stay compliant, know your numbers, grow. Invoice in seconds, and an agent prepares polite follow-ups for the oldest debt first, keeping the firm ones for your approval. Every SARS, CIPC and COIDA deadline comes pre-loaded with its real penalty. A daily brief and accountant-ready exports. Then goals, bookings, stock, staff and payroll. The key point: every step produces clean data, and clean data is what lets a bank say yes." },
  { n: 4, sp: 1, title: 'The product, live today', show: 'Dashboard screenshots.',
    say: "This is the product, live today. Every morning a founder opens one screen instead of five apps. It shows what needs a decision right now, how much cash is owed, overdue or stuck, and their goals, compliance and team at a glance. And it's built mobile-first: it works on a 390-pixel Android, which is what most of our founders actually carry." },
  { n: 5, sp: 1, title: 'Step 1 · Get paid', show: 'Cash Cockpit + invoices screenshots.',
    say: "Step one, get paid. The Cash Cockpit tells a founder plainly what they're owed, what's stuck, and who to chase first. They send branded tax invoices and receipts, and take a Quick Sale for cash and walk-in customers. Debt recovery runs in six stages: gentle reminders first, and the firm notices wait for the owner's approval. And every rand is categorised to a chart of accounts from day one.",
    hand: 'Hand to Speaker 2: "And this is the part we’re most proud of."' },
  { n: 6, sp: 2, title: 'Step 1 · The bank loop', show: 'Bank & Reconcile screenshots.',
    say: "The bank loop. A founder exports a CSV from FNB, Capitec, ABSA, Standard Bank, Nedbank or TymeBank, and uploads it. They see a preview before anything is saved. Spending sorts itself into categories and learns their vendors. Payments are matched to the invoices they paid, by invoice number, payer name and exact amount. One tap settles the invoice. Look-alikes and part-payments are flagged, never guessed.",
    note: 'It is a CSV upload, not a live bank connection. There is no auto-settle and no undo yet.' },
  { n: 7, sp: 2, title: 'Step 2 · Stay compliant', show: 'Compliance calendar screenshot.',
    say: "Step two, stay compliant. This is the fear every founder has. We've pre-loaded the deadlines that matter: EMP201, EMP501, IRP6, ITR14, COIDA and the CIPC annual return, with dates built on SARS rules that roll forward every month. Next to each one is the actual penalty for missing it. And POPIA consent is built into every broadcast. It's built around South African employer and tax deadlines from day one." },
  { n: 8, sp: 2, title: 'Step 3 · Know your numbers', show: 'Health + exports screenshots.',
    say: "Step three, know your numbers. There's a business health score and a daily AI brief. Cashflow, expenses and payables sit in one place, with a 90-day cash forecast that's clearly labelled as an estimate. When the accountant asks, the income statement, VAT report and journal CSV are ready to export. Payroll handles PAYE, UIF and SDL. The aim is books in order from day one, not a panic in February." },
  { n: 9, sp: 2, title: 'Step 4 · Grow', show: 'Bookings, stock, team screenshots.',
    say: "Step four, grow. Bookings run in a diary with confirmations, and the 24-hour reminder is built in, ready for when WhatsApp is connected. Stock and suppliers come with reorder alerts and a B-BBEE supplier scorecard. And staff, leave, tasks and goals sit in one place, with progress you can see. It's the whole business, not just the books.",
    note: 'There is no public booking page for customers yet. Do not say customers book themselves online.' },
  { n: 10, sp: 2, title: 'Built for South Africa', show: 'Four feature cards.',
    say: "It's built for how South Africans actually work: a mid-range Android on prepaid data. It's app-native today, and WhatsApp, the channel everyone already uses, is our next step. The onboarding guide speaks English, isiZulu, isiXhosa and Afrikaans. In the staff app, clock-ins queue offline and retry when the signal returns, which matters in load-shedding. And that Android app is being prepared for Google Play and Huawei AppGallery.",
    note: 'The web app does NOT work offline (reloading offline shows a browser error). Only the staff app queues.' },
  { n: 11, sp: 2, title: "Proof it's real", show: 'Proof numbers.',
    say: "Proof it's real: a product in production, not a prototype. Over fifty dashboard screens live at adminos.co.za. Two hundred and thirty-eight automated tests passing. A regression check that walked seven industry personas on production, with 122 of 122 checks passed on its last full run. More than forty background automations for reminders, recovery and rollovers. And our first beta user, a Johannesburg video-production founder, has been trialling it since August.",
    note: 'Tests: 238 in the 26 Oct CI run; re-check before presenting. Do not say she "runs her business on it": her tenant has 1 invoice and 3 contacts.',
    hand: 'Hand to Speaker 3: "That brings us to trust."' },
  { n: 12, sp: 3, title: 'Trust · security & POPIA', show: 'Two columns: security / POPIA.',
    say: "Trust matters when you hold a founder's data. One business can never see another's: row-level security on every table, and with the public database key no business's data can be read, which we checked on 26 October. Bank lines are reachable by our server only. On POPIA: consent is checked before any marketing message, customers can opt out, and key changes leave an audit trail. One honest note: our privacy policy is being updated to list every operator and cross-border transfer.",
    note: 'Known gap: the public key can still read 22 platform log lines and 1 community post (a fix needs your approval). Do not say "nothing can be read".' },
  { n: 13, sp: 3, title: 'Where a bank makes this unstoppable', show: 'Live / Next table.',
    say: "Here's where a bank makes this unstoppable. Live today: invoices, receipts and cash sales, the compliance calendar and payroll, and bank-statement import with reconciliation. Next: pay-from-invoice, so customers pay from their banking app and the invoice marks itself paid, and a consented credit-readiness profile that lenders can see. The more a founder runs through AdminOS, the more provable, and bankable, the business becomes.",
    note: 'Point at the Live / Next column. Do not call the bank import a bank connection.' },
  { n: 14, sp: 3, title: 'Business model', show: 'Pricing tiers.',
    say: "The model is priced for a founder's first R349, not an enterprise budget. Solo is R349 a month for one person. Grow is R899 for up to five staff. Operate is R1,999 for up to twenty, and Scale is R3,999 for up to a hundred. There's a fourteen-day free trial, billing in rand, and distribution through banks, incubators and funders who bring a whole cohort of founders at once." },
  { n: 15, sp: 3, title: 'Market validation', show: 'What we heard / what we test next.',
    say: "Early signal is strong, and we want to be straight about it. At this hackathon, two of two panellists said they could use it and could buy it, one at full price and one at half. Our first beta founder, in Johannesburg, has been trialling it since August. The fair challenge was that similar tools exist; ours is built for South Africa from day one. Next we test willingness to pay per tier, run three incubator pilots, and measure days from invoice to cash." },
  { n: 16, sp: 3, title: 'The ask', show: 'Links slide and the judges’ login card.',
    say: "So here's our ask: help us put a business OS in the pocket of every young South African founder. You can try it today at adminos.co.za, read the code on GitHub, or talk to us: Nandawula Regine at Mirembe Muse. Judges, the demo login is on this slide, so please sign in and explore. Thank you. We'd love your questions." },
]

const DEMO = [
  { n: 1, sp: 1, title: 'Command Center', path: '/dashboard',
    show: 'The red headline ("… is stuck in collections"), the Needs You Now list, the Quarterly goals card.',
    say: "This is the Command Center. A founder opens one screen instead of five apps. The headline tells her what matters most, here the amount stuck in collections, with her net position underneath. 'Needs You Now' puts every decision in one list: overdue tasks, expense claims, items to reorder. Her quarterly goals sit on the right. Everything starts from this one screen.",
    note: 'Read the rand figure off the screen. Demo data changes.' },
  { n: 2, sp: 1, title: 'Cash Cockpit', path: '/dashboard/money',
    show: 'Net position, the 60+ day debt, the "Review recovery queue" button.',
    say: "Next, the Cash Cockpit. It tells her who owes her money and who to chase first. Here's her net position, and the debt that's more than sixty days old. Follow-ups are staged in tiers, and the serious ones wait for her approval, so nothing awkward is sent without her. It's plain language, no accounting jargon, because she's a founder, not an accountant." },
  { n: 3, sp: 1, title: 'Invoices & AR', path: '/dashboard/invoices',
    show: 'Status chips, "Record payment", then open the Quick Sale modal (do not submit).',
    say: "Invoices. Branded tax invoices and receipts, with status chips so she sees paid, partial, overdue and in-collections at a glance. 'Record payment' captures EFT, cash or card. And Quick Sale is for the customer who just walks in with cash: open it, enter the item, done. It all lands in the same books.",
    hand: 'Hand to Speaker 2: "Now the part that closes the loop."' },
  { n: 4, sp: 2, title: 'Bank & Reconcile', path: '/dashboard/bank',
    show: 'Categorised lines, a payment matched to its invoice, then tap Confirm payment and show the invoice flip to paid.',
    say: "Bank and Reconcile. She uploads an FNB statement and the books start closing themselves. The lines are already categorised, and here a payment is matched to its invoice by number and exact amount. I tap Confirm payment, and the invoice flips to paid. Part-payments and look-alikes are flagged for a human, never guessed.",
    note: 'This changes the demo tenant. Re-seed before the next run: node scripts/hackathon/seed-demo-bank.mjs. It is a CSV upload, not a live bank link.' },
  { n: 5, sp: 2, title: 'Compliance', path: '/dashboard/compliance',
    show: 'The "If you miss it" penalty column.',
    say: "Compliance, the fear every founder has. Every SARS, CIPC and COIDA deadline is here with its due date, and in this column, the actual penalty for missing it. Status is worked out from the due date, so it never goes stale. Founders stop finding out about deadlines from a penalty letter and start seeing them coming." },
  { n: 6, sp: 2, title: 'Inbox', path: '/dashboard/inbox',
    show: 'The isiZulu conversation and its isiZulu reply.',
    say: "The Inbox is where customer conversations land, in the customer's own language. This one is in isiZulu, and the reply comes back in isiZulu. To be transparent, WhatsApp isn't connected yet, so these are sample conversations that show the experience we're building. One inbox, every customer, their language.",
    note: 'WhatsApp is not set up. Never say the Inbox is receiving or sending live WhatsApp messages.',
    hand: 'Hand to Speaker 3: "And running the day-to-day."' },
  { n: 7, sp: 3, title: 'Bookings', path: '/dashboard/bookings',
    show: "This week's schedule and the booking waiting to be confirmed.",
    say: "Bookings. A founder runs the diary here: bookings come in, one is waiting to be confirmed, and a 24-hour reminder is built in, ready for when WhatsApp is connected. This is this week's schedule. For a salon, a clinic or a consultant, this replaces the paper diary and the back-and-forth messages.",
    note: 'There is no public customer booking page yet. Do not say customers book through a link.' },
  { n: 8, sp: 3, title: 'Getting Started', path: '/dashboard/getting-started',
    show: 'The language chips; tap isiZulu and the guide switches.',
    say: "Getting Started is the guided setup, and it speaks isiZulu, isiXhosa and Afrikaans as well as English. Tap a language chip and the whole guide switches. A first-time founder isn't dropped onto an empty dashboard. They're walked through setting up the business, adding a first contact and raising a first invoice." },
  { n: 9, sp: 3, title: 'Phone view → roadmap', path: '390px width',
    show: 'Cash Cockpit on a phone (390px), then switch to the Live / Next slide.',
    say: "Finally, the phone. It's the same product at 390 pixels, built for a mid-range Android on prepaid data. Here's the Cash Cockpit on mobile: the same numbers, and tables that turn into easy-to-read cards. And that brings us to what's next: pay-from-invoice, and a credit-readiness profile that a bank can use.",
    note: 'Do not open Settings. Integrations show as "coming soon".' },
]

const words = (s) => s.trim().split(/\s+/).length
const SECONDS_PER_WORD = 60 / 150 // 150 words/minute, a calm presenting pace
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function card(kind, s) {
  const w = words(s.say)
  const secs = Math.round(w * SECONDS_PER_WORD)
  s.w = w; s.secs = secs
  const label = kind === 'deck' ? `Slide ${s.n}` : `Demo ${s.n}`
  return `
  <section class="card sp${s.sp}">
    <div class="head">
      <span class="num">${label}</span>
      <span class="title">${esc(s.title)}${s.path ? ` <em>${esc(s.path)}</em>` : ''}</span>
      <span class="who">${SPEAKERS[s.sp]}</span>
    </div>
    <p class="show"><b>${kind === 'deck' ? 'On screen' : 'Show'}:</b> ${esc(s.show)}</p>
    <p class="say">${esc(s.say)}</p>
    ${s.note ? `<p class="note"><b>Careful:</b> ${esc(s.note)}</p>` : ''}
    ${s.hand ? `<p class="hand">↪ ${esc(s.hand)}</p>` : ''}
    <p class="meta">${w} words · about ${secs} seconds</p>
  </section>`
}

const deckHtml = DECK.map(s => card('deck', s)).join('\n')
const demoHtml = DEMO.map(s => card('demo', s)).join('\n')

const tally = (arr) => [1, 2, 3].map(sp => {
  const items = arr.filter(s => s.sp === sp)
  return { sp, count: items.length, secs: items.reduce((a, s) => a + s.secs, 0) }
})
const fmt = (secs) => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`
const rows = (arr, kind) => tally(arr).map(t => `<tr><td>${SPEAKERS[t.sp]}</td><td>${kind === 'deck' ? 'Slides ' : 'Demo '}${arr.filter(s => s.sp === t.sp).map(s => s.n).join(', ')}</td><td>${t.count}</td><td>${fmt(t.secs)}</td></tr>`).join('')

const html = `<!doctype html><html lang="en-ZA"><head><meta charset="utf-8"><title>AdminOS — presenter scripts</title>
<style>
  @page { size: A4; margin: 16mm 15mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #14172b; font-size: 11pt; line-height: 1.45; margin: 0; }
  h1 { font-size: 24pt; margin: 0 0 2mm; } h2 { font-size: 16pt; margin: 0 0 4mm; padding-bottom: 2mm; border-bottom: 2px solid #5A5DEC; }
  .sub { color: #555; margin: 0 0 6mm; }
  table { border-collapse: collapse; width: 100%; margin: 2mm 0 5mm; font-size: 10.5pt; }
  th, td { border: 1px solid #cfd3e6; padding: 2mm 3mm; text-align: left; } th { background: #eef0fb; }
  ul { margin: 1mm 0 4mm 5mm; padding: 0; } li { margin-bottom: 1.5mm; }
  .box { border: 1.5px solid #c2410c; background: #fff7ed; padding: 3mm 4mm; border-radius: 2mm; margin: 4mm 0; }
  .box h3 { margin: 0 0 1.5mm; color: #9a3412; font-size: 11.5pt; }
  .login { border: 1.5px solid #5A5DEC; background: #eef0fb; padding: 3mm 4mm; border-radius: 2mm; margin: 4mm 0; font-size: 11pt; }
  .login h3 { margin: 0 0 1.5mm; color: #3730a3; font-size: 11.5pt; }
  .cover { page-break-after: always; }
  .part { page-break-before: always; }
  .card { border: 1.5px solid #cfd3e6; border-left-width: 6px; border-radius: 2mm; padding: 3mm 4mm; margin: 0 0 4mm; page-break-inside: avoid; }
  .sp1 { border-left-color: #5A5DEC; } .sp2 { border-left-color: #0f766e; } .sp3 { border-left-color: #b45309; }
  .head { display: flex; align-items: baseline; gap: 3mm; margin-bottom: 1.5mm; }
  .num { font-weight: 700; color: #5A5DEC; white-space: nowrap; } .title { font-weight: 700; font-size: 12.5pt; flex: 1; }
  .title em { font-weight: 400; color: #777; font-size: 9pt; margin-left: 2mm; }
  .who { font-weight: 700; font-size: 9.5pt; text-transform: uppercase; letter-spacing: .04em; white-space: nowrap; }
  .sp1 .who { color: #5A5DEC; } .sp2 .who { color: #0f766e; } .sp3 .who { color: #b45309; }
  .show { margin: 0 0 2mm; color: #555; font-size: 9.5pt; }
  .say { font-size: 13pt; line-height: 1.55; margin: 0 0 2mm; }
  .note { font-size: 9.5pt; margin: 1mm 0; padding: 1.5mm 2.5mm; border-radius: 1.5mm; background: #fff7ed; }
  .hand { font-size: 9.5pt; color: #333; margin: 1.5mm 0 0; font-style: italic; }
  .meta { font-size: 8.5pt; color: #888; margin: 1.5mm 0 0; text-align: right; }
</style></head><body>

<div class="cover">
  <h1>AdminOS · presenter scripts</h1>
  <p class="sub">FNB App Hackathon · Mirembe Muse (Pty) Ltd · three speakers, about 30 seconds per slide or page</p>

  <h2>How to use this</h2>
  <ul>
    <li><b>Part 1</b> follows the 16-slide pitch deck (v3, corrected 26 Oct). <b>Part 2</b> follows the live demo, one menu page at a time.</li>
    <li>Each script is written to be read aloud at a calm pace (about 150 words a minute). Say it in your own words if that feels natural; keep the facts.</li>
    <li>Fill in the three names on slide 1. Speaker 1, 2 and 3 are placeholders for whoever takes each role.</li>
    <li>Coloured left edge = the speaker. The italic line at the bottom of a card is the hand-over cue.</li>
  </ul>

  <h2>Who says what</h2>
  <table><tr><th>Speaker</th><th>Deck slides</th><th>Count</th><th>Time</th></tr>${rows(DECK, 'deck')}</table>
  <table><tr><th>Speaker</th><th>Demo pages</th><th>Count</th><th>Time</th></tr>${rows(DEMO, 'demo')}</table>
  <p class="sub">Total: deck ${fmt(DECK.reduce((a, s) => a + s.secs, 0))}, demo ${fmt(DEMO.reduce((a, s) => a + s.secs, 0))}. For a tighter 3-minute demo, drop Bookings and Getting Started (demo 7 and 8) and shorten the rest to about 20 seconds.</p>

  <div class="login">
    <h3>Judges' demo login (also on the last slide)</h3>
    adminos.co.za/login · <b>${login.email}</b> · password <b>${login.password}</b><br>
    Owner of the sample business "Mzansi Test Traders". Not an admin; sees only that sample business.
  </div>

  <div class="box">
    <h3>Do not claim (verified against the code, CI and live database on 26 Oct 2026)</h3>
    <ul>
      <li><b>Anything WhatsApp:</b> WhatsApp is not set up, so we are app-native today. Never say "WhatsApp-native", that customers are being messaged, or that reminders, payslips or follow-ups go out on WhatsApp. Inbox conversations are sample data. Say "WhatsApp is next".</li>
      <li><b>Live bank connection, pay-from-invoice, credit-readiness profile:</b> roadmap only. The bank loop is a CSV upload. There is no auto-settle or undo yet.</li>
      <li><b>Customers booking online:</b> there is no public booking page. Bookings is the owner's diary.</li>
      <li><b>"Runs her business on it":</b> the first beta user's tenant has 1 invoice and 3 contacts. Say "trialling it since August".</li>
      <li><b>"Offline":</b> only the staff app queues clock-ins. The web app does not work offline.</li>
      <li><b>"Nothing can be read with the public key":</b> 22 platform log lines and 1 community post are still readable. Say "no business's data can be read".</li>
      <li><b>Integrations (Gmail, Xero, PayFast):</b> "coming soon". Do not open Settings.</li>
      <li><b>Email:</b> signup emails may not arrive. Don't sign up live. Use the demo login.</li>
    </ul>
  </div>

  <h2>Before you go on</h2>
  <ul>
    <li>Log in once, choose <b>Necessary only</b> on the cookie banner, and open every demo page so nothing loads cold. The first dashboard load can be slow when cold.</li>
    <li>Read money figures off the screen; demo numbers change.</li>
  </ul>
</div>

<div class="part"><h2>Part 1 · The pitch deck (16 slides)</h2>
${deckHtml}</div>

<div class="part"><h2>Part 2 · The live demo (menu pages)</h2>
${demoHtml}</div>

</body></html>`

fs.writeFileSync(path.join(dir, 'PRESENTER_SCRIPTS.html'), html)
const b = await chromium.launch()
const p = await b.newPage()
await p.goto(pathToFileURL(path.join(dir, 'PRESENTER_SCRIPTS.html')).href, { waitUntil: 'load' })
await p.pdf({ path: path.join(dir, 'PRESENTER_SCRIPTS.pdf'), format: 'A4', printBackground: true, margin: { top: '16mm', bottom: '16mm', left: '15mm', right: '15mm' } })
await b.close()
for (const s of [...DECK.map(s => ['slide', s]), ...DEMO.map(s => ['demo', s])]) console.log(`${s[0]} ${s[1].n} ${SPEAKERS[s[1].sp]} ${s[1].w}w ~${s[1].secs}s`)
