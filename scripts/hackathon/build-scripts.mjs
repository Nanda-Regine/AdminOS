// Builds docs/hackathon/PRESENTER_SCRIPTS.{html,pdf}: ONE 30-second script per
// speaker for the pitch deck and ONE per speaker for the live demo (3 x 30s each).
// Facts checked against code, CI and the live database on 26 Oct 2026.
//   node scripts/hackathon/build-scripts.mjs
// The judge login is read from scripts/hackathon/.judge-login.json (gitignored).
import fs from 'fs'
import path from 'path'
import { pathToFileURL } from 'url'
import { chromium } from '@playwright/test'

const dir = path.join(process.cwd(), 'docs', 'hackathon')
const login = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'scripts', 'hackathon', '.judge-login.json'), 'utf8'))

// [[cue]] marks when to move to that slide / page. Cues are not spoken and not counted.
const DECK = [
  { sp: 1, covers: 'Slides 1–7 · title, problem, idea, solution, journey, product, get paid',
    say: "[[Slide 1]] Hi, we're Mirembe Muse from East London, and this is AdminOS: the business OS that takes a young South African founder from “I have an idea” to “I run a business”. [[Slide 2]] Starting is easy; staying alive isn't. Customers owe money, SARS penalties surprise you, and five apps cost too much. [[Slide 3]] So we built one loop: get paid, stay compliant, know your numbers, grow. [[Slide 4]] [[Slide 5]] [[Slide 6]] One screen every morning. [[Slide 7]] And a Cash Cockpit showing who to chase first." },
  { sp: 2, covers: 'Slides 8–15 · bank loop, compliance, numbers, grow, built for SA, architecture, AI, proof',
    say: "[[Slide 8]] Upload a bank statement and payments match the invoices they paid. One tap settles it. [[Slide 9]] Every SARS, CIPC and COIDA deadline is pre-loaded, with its real penalty. [[Slide 10]] A health score, daily brief and accountant-ready exports. [[Slide 11]] Plus bookings, stock, staff and tasks. [[Slide 12]] It's app-native today, in four languages, on a mid-range Android, with WhatsApp next. [[Slide 13]] [[Slide 14]] [[Slide 15]] And it's real: fifty-plus screens live, 238 tests passing, and a beta founder trialling it." },
  { sp: 3, covers: 'Slides 16–20 · trust, bank roadmap, pricing, validation, the ask',
    say: "[[Slide 16]] Your data stays yours: row-level security on every table, and POPIA consent built in. [[Slide 17]] A bank makes this unstoppable: pay-from-invoice and a credit-readiness profile are next. [[Slide 18]] It starts at R349 a month, with a free trial, and reaches founders through banks and incubators. [[Slide 19]] Early signal is strong: both panellists said they could use it and buy it. [[Slide 20]] Help us put a business OS in every founder's pocket. Judges, the demo login is on screen." },
]

const DEMO = [
  { sp: 1, covers: 'Command Center · Cash Cockpit · Invoices & AR',
    say: "[[Command Center]] One screen instead of five apps: here, the money stuck in collections, and a 'Needs You Now' list of overdue tasks, expense claims and stock to reorder. [[Cash Cockpit]] It shows who owes her and who to chase first, in plain language, and the serious follow-ups wait for her approval, so nothing awkward goes out without her. [[Invoices]] Branded tax invoices and receipts, record a payment, or take a Quick Sale for a cash customer." },
  { sp: 2, covers: 'Bank & Reconcile · Compliance · Inbox',
    say: "[[Bank & Reconcile]] She uploads an FNB statement, the lines are categorised, and this payment matches its invoice. One tap, and it's paid. Look-alikes and part-payments are flagged for a human, never guessed. [[Compliance]] Every SARS, CIPC and COIDA deadline, with the actual penalty for missing it, so a penalty letter is never the first she hears of it. [[Inbox]] Customer conversations in their own language, here isiZulu. WhatsApp isn't connected yet, so these are samples." },
  { sp: 3, covers: 'Bookings · Getting Started · Phone view',
    say: "[[Bookings]] The owner's diary: this week's bookings, with confirmations and a 24-hour reminder ready for when WhatsApp connects. It replaces the paper diary. [[Getting Started]] A guided setup in isiZulu, isiXhosa, Afrikaans or English. A first-time founder is walked through setup, not dropped onto an empty dashboard. [[Phone]] And the same product on a 390-pixel phone, built for a mid-range Android on prepaid data, with tables that turn into easy cards. Next: pay-from-invoice and a credit-readiness profile." },
]

const strip = (s) => s.replace(/\[\[[^\]]+\]\]/g, '').replace(/\s+/g, ' ').trim()
const words = (s) => strip(s).split(' ').length
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const render = (s) => esc(s).replace(/\[\[([^\]]+)\]\]/g, '<span class="cue">$1</span>')

function card(kind, s) {
  s.w = words(s.say)
  s.secs = Math.round(s.w * 60 / 150) // 150 words a minute
  return `
  <section class="card sp${s.sp}">
    <div class="head"><span class="who">Speaker ${s.sp}</span><span class="covers">${esc(s.covers)}</span><span class="meta">${s.w} words · about ${s.secs} sec</span></div>
    <p class="say">${render(s.say)}</p>
  </section>`
}

const deckHtml = DECK.map(s => card('deck', s)).join('\n')
const demoHtml = DEMO.map(s => card('demo', s)).join('\n')

const html = `<!doctype html><html lang="en-ZA"><head><meta charset="utf-8"><title>AdminOS — presenter scripts</title>
<style>
  @page { size: A4; margin: 14mm 15mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #14172b; font-size: 10.5pt; line-height: 1.4; margin: 0; }
  h1 { font-size: 22pt; margin: 0 0 1mm; } h2 { font-size: 14pt; margin: 5mm 0 3mm; padding-bottom: 1.5mm; border-bottom: 2px solid #5A5DEC; }
  .sub { color: #555; margin: 0 0 3mm; }
  ul { margin: 1mm 0 3mm 5mm; padding: 0; } li { margin-bottom: 1mm; }
  .page1 { page-break-after: always; }
  .box { border: 1.5px solid #c2410c; background: #fff7ed; padding: 2.5mm 4mm; border-radius: 2mm; margin: 3mm 0; font-size: 9.5pt; }
  .box h3 { margin: 0 0 1mm; color: #9a3412; font-size: 11pt; }
  .login { border: 1.5px solid #5A5DEC; background: #eef0fb; padding: 2.5mm 4mm; border-radius: 2mm; margin: 3mm 0; font-size: 10.5pt; }
  .login h3 { margin: 0 0 1mm; color: #3730a3; font-size: 11pt; }
  .card { border: 1.5px solid #cfd3e6; border-left-width: 7px; border-radius: 2mm; padding: 4mm 5mm; margin: 0 0 5mm; page-break-inside: avoid; }
  .sp1 { border-left-color: #5A5DEC; } .sp2 { border-left-color: #0f766e; } .sp3 { border-left-color: #b45309; }
  .head { display: flex; align-items: baseline; gap: 4mm; margin-bottom: 2.5mm; }
  .who { font-weight: 800; font-size: 11pt; text-transform: uppercase; letter-spacing: .04em; white-space: nowrap; }
  .sp1 .who { color: #5A5DEC; } .sp2 .who { color: #0f766e; } .sp3 .who { color: #b45309; }
  .covers { font-weight: 600; flex: 1; font-size: 10pt; } .meta { font-size: 8.5pt; color: #888; white-space: nowrap; }
  .say { font-size: 14pt; line-height: 1.6; margin: 0; }
  .cue { display: inline-block; font-size: 8pt; font-weight: 700; letter-spacing: .03em; text-transform: uppercase; color: #fff; background: #5A5DEC; border-radius: 3px; padding: 0 5px; margin-right: 3px; vertical-align: 2px; }
  .sp2 .cue { background: #0f766e; } .sp3 .cue { background: #b45309; }
</style></head><body>

<div class="page1">
  <h1>AdminOS · presenter scripts</h1>
  <p class="sub">FNB App Hackathon · Mirembe Muse (Pty) Ltd · each speaker has <b>30 seconds in total</b> for the deck and <b>30 seconds in total</b> for the demo</p>

  <h2>How it works</h2>
  <ul>
    <li>New slides 4 (solution), 5 (user journey), 13 (architecture) and 14 (responsible AI) have no spoken words, so flip past them quickly or add a sentence.</li>
    <li>Three speakers, one block each. <b>Deck:</b> 3 × 30 s = 1½ min. <b>Demo:</b> 3 × 30 s = 1½ min. About 3 minutes in all.</li>
    <li>The coloured tag inside the text is a <b>cue</b>: move to that slide or menu page as you reach it. Cues are not spoken.</li>
    <li>The scripts are about 75 words, read at a calm 150 words a minute. Slides 1–7, 8–15 and 16–20 go to Speaker 1, 2 and 3. Demo pages go three each.</li>
    <li>Say it in your own words if you prefer. Keep the facts. Say your own name at the start of Speaker 1, 2 and 3's block.</li>
  </ul>

  <div class="login">
    <h3>Judges' demo login (also on the last slide)</h3>
    adminos.co.za/login · <b>${login.email}</b> · password <b>${login.password}</b><br>
    Owner of the sample business "Mzansi Test Traders". Not an admin; sees only that sample business.
  </div>

  <div class="box">
    <h3>Do not claim (verified against the code, CI and live database, 26 Oct 2026)</h3>
    <ul>
      <li><b>WhatsApp:</b> not set up. We are app-native today. Never say "WhatsApp-native" or that customers are being messaged. Inbox conversations are samples. Say "WhatsApp is next".</li>
      <li><b>Bank:</b> a CSV upload, not a live bank connection. No auto-settle or undo yet. Pay-from-invoice and the credit-readiness profile are roadmap.</li>
      <li><b>Bookings:</b> the owner's diary. There is no public page for customers to book online.</li>
      <li><b>Beta user:</b> say "trialling it since August", not "runs her business on it".</li>
      <li><b>Offline:</b> only the staff app queues clock-ins. The web app does not work offline.</li>
      <li><b>Security:</b> say "no business's data can be read with the public key", not "nothing can be read".</li>
      <li><b>Don't</b> open Settings (integrations show "coming soon") and don't sign up live (signup emails may not arrive).</li>
    </ul>
  </div>

  <h2>Before you go on</h2>
  <ul>
    <li>Log in once, choose <b>Necessary only</b> on the cookie banner, and open every demo page so nothing loads cold.</li>
    <li>Read money figures off the screen; demo numbers change. Tap <b>Confirm payment</b> on the bank page only once, then re-seed: <code>node scripts/hackathon/seed-demo-bank.mjs</code>.</li>
  </ul>
</div>

<h2>Part 1 · The pitch deck (20 slides)</h2>
${deckHtml}

<h2>Part 2 · The live demo (menu pages)</h2>
${demoHtml}

</body></html>`

fs.writeFileSync(path.join(dir, 'PRESENTER_SCRIPTS_30s.html'), html)
const b = await chromium.launch()
const p = await b.newPage()
await p.goto(pathToFileURL(path.join(dir, 'PRESENTER_SCRIPTS_30s.html')).href, { waitUntil: 'load' })
await p.pdf({ path: path.join(dir, 'PRESENTER_SCRIPTS_30s.pdf'), format: 'A4', printBackground: true, margin: { top: '14mm', bottom: '14mm', left: '15mm', right: '15mm' } })
await b.close()
for (const [k, arr] of [['deck', DECK], ['demo', DEMO]]) for (const s of arr) console.log(`${k} speaker ${s.sp}: ${s.w} words, ~${s.secs}s`)
