// Demo tenant ("Mzansi Test Traders") only. The seed predates today, so:
//   1. open tasks are all long overdue  -> re-date them around today (3 overdue, rest upcoming)
//   2. the Inbox is empty               -> add 5 sample WhatsApp conversations
// Inserts/updates rows in that one tenant only; never touches tenants/users/roles.
// Idempotent: conversations only seed when the tenant has none.
//   node scripts/hackathon/refresh-demo-data.mjs
import { select, insert, update } from '../lib/qa.mjs'

const T = 'c1336f9c-0617-46f2-978f-605da9ad2ebc'
const DAY = 86400e3
const ago = (ms) => new Date(Date.now() - ms).toISOString()

// ── 1. Tasks ────────────────────────────────────────────────────────────────
const open = await select('tasks', `tenant_id=eq.${T}&deleted_at=is.null&status=in.(todo,in_progress,review)&select=id,priority,title&order=priority,id`)
const OFFSETS = [-6, -3, -1, 1, 2, 3, 5, 7, 9, 12, 14] // days from today; first three are overdue
let n = 0
for (const [i, t] of open.entries()) {
  const days = OFFSETS[i % OFFSETS.length]
  const due = new Date(Date.now() + days * DAY); due.setUTCHours(8, 0, 0, 0) // 10:00 SAST
  await update('tasks', `id=eq.${t.id}`, { due_date: due.toISOString() })
  n++
}
console.log('tasks re-dated:', n)

// ── 2. Inbox ────────────────────────────────────────────────────────────────
const existing = await select('conversations', `tenant_id=eq.${T}&select=id&limit=1`)
if (existing.length) { console.log('conversations already present — skipped'); process.exit(0) }

const contacts = await select('contacts', `tenant_id=eq.${T}&select=id,full_name,phone`)
const byName = (nm) => { const c = contacts.find(x => x.full_name === nm); if (!c) throw new Error(`contact missing: ${nm}`); return c }

// [contact, status, sentiment, intent, summary, [role, text, minutesAgo]...]
const CONVOS = [
  ['Karen Fourie', 'escalated', 'neutral', 'quote_request',
    'Wants 20 IBR roofing sheets; stock is low so the team needs to confirm a delivery date.',
    [['user', 'Hi, can I get a quote for 20 IBR roofing sheets (3m)?', 190],
     ['assistant', 'Hi Karen! IBR Roofing Sheet (3m) is R320 each, so 20 sheets is R6,400 excl. delivery. Stock is running low right now — I have flagged it to the team and they will confirm a delivery date shortly.', 189],
     ['user', 'Great, please let me know by tomorrow.', 150]]],
  ['Nomvula Sithole', 'open', 'neutral', 'payment_promise',
    'Overdue invoice reminder; customer promised to pay on Friday.',
    [['assistant', 'Hi Nomvula, a friendly reminder that invoice INV-20260602-1005 for R1,668 is overdue. You can pay by EFT using the reference on the invoice. Let us know if there is a problem.', 600],
     ['user', 'Sorry, I was away. I will pay on Friday.', 420],
     ['assistant', 'Thank you Nomvula, no problem. I have noted Friday and will check back then.', 419]]],
  ['Sipho Radebe', 'auto_resolved', 'positive', 'product_enquiry',
    'Asked the price of padlocks in isiZulu; answered in isiZulu.',
    [['user', 'Sawubona, ngifuna ukuthenga ama-padlock amathathu. Yimalini?', 1500],
     ['assistant', 'Sawubona Sipho! I-padlock ngayinye ingu-R145. Ufuna ukuyiqoqa esitolo noma sikuthumelele?', 1499],
     ['user', 'Ngizoyiqoqa ekuseni, ngiyabonga.', 1440]]],
  ['Themba Nkosi', 'escalated', 'negative', 'complaint',
    'Delivery arrived late; escalated to the store manager.',
    [['user', 'My delivery was supposed to come yesterday. Nobody told me it would be late.', 2400],
     ['assistant', 'I am sorry about that, Themba. I have escalated this to our store manager, who will call you today to sort it out.', 2399]]],
  ['Peter Botha', 'auto_resolved', 'neutral', 'booking_change',
    'Moved a bulk order collection to Friday.',
    [['user', 'Can I move my bulk order collection to Friday?', 3000],
     ['assistant', 'Of course, Peter. I have moved your collection to Friday at 10:00. You will get a reminder the day before.', 2999]]],
]

for (const [name, status, sentiment, intent, summary, msgs] of CONVOS) {
  const c = byName(name)
  const lastAgo = Math.min(...msgs.map(m => m[2]))
  const [conv] = await insert('conversations', [{
    tenant_id: T, contact_id: c.id, channel: 'whatsapp', contact_name: name, contact_identifier: c.phone,
    contact_type: 'client', status, sentiment, intent, summary,
    created_at: ago(Math.max(...msgs.map(m => m[2])) * 60e3), updated_at: ago(lastAgo * 60e3),
  }])
  await insert('messages', msgs.map(([role, content, mins]) => ({
    tenant_id: T, conversation_id: conv.id, role, content, channel: 'whatsapp', created_at: ago(mins * 60e3),
  })))
}
console.log('conversations seeded:', CONVOS.length)
