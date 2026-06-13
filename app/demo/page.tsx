'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'

// ─── Fake tenant ─────────────────────────────────────────────────────────────
const TENANT = 'Thabo Dlamini Attorneys'
const DATE = '14 June 2026'

const AGENTS = [
  { id: 'alex',    label: 'Alex',    role: 'Inbox',           icon: '💬', color: '#F97316' },
  { id: 'chase',   label: 'Chase',   role: 'Debt Recovery',   icon: '💰', color: '#06B6D4' },
  { id: 'care',    label: 'Care',    role: 'Staff Wellness',  icon: '💚', color: '#22c55e' },
  { id: 'doc',     label: 'Doc',     role: 'Document Intel',  icon: '📄', color: '#a78bfa' },
  { id: 'insight', label: 'Insight', role: 'Analytics',       icon: '📊', color: '#06B6D4' },
  { id: 'pen',     label: 'Pen',     role: 'Content',         icon: '✍️', color: '#F97316' },
  { id: 'langa',   label: 'Langa',   role: 'Business Mentor', icon: '🎓', color: '#fbbf24' },
]

// ─── Live event ticker ────────────────────────────────────────────────────────
const LIVE_EVENTS = [
  { icon: '💰', agent: 'Chase', text: 'Recovered R8,500 from Sipho Mthembu', time: '09:14', color: '#06B6D4' },
  { icon: '💬', agent: 'Alex',  text: 'Replied to Fatima Mokoena re: contract', time: '09:18', color: '#F97316' },
  { icon: '💚', agent: 'Care',  text: 'Bongani Nkosi wellness check sent', time: '09:22', color: '#22c55e' },
  { icon: '📄', agent: 'Doc',   text: 'Scanned employment_contract_priya.pdf', time: '09:31', color: '#a78bfa' },
  { icon: '💰', agent: 'Chase', text: 'Reminder sent — INV-028 R15,000 overdue', time: '09:45', color: '#06B6D4' },
  { icon: '🎓', agent: 'Langa', text: 'New lesson unlocked: "SA Labour Law 101"', time: '10:02', color: '#fbbf24' },
  { icon: '💬', agent: 'Alex',  text: 'City of Joburg enquiry auto-resolved', time: '10:11', color: '#F97316' },
  { icon: '📊', agent: 'Insight', text: 'Daily brief ready — revenue up 18%', time: '10:15', color: '#06B6D4' },
]

// ─── GUIDED TOUR ──────────────────────────────────────────────────────────────
const TOUR_STEPS = [
  { agent: 'alex',    duration: 3500, hint: 'Alex handles all WhatsApp messages 24/7 — tap a conversation' },
  { agent: 'chase',   duration: 3500, hint: 'Chase tracks overdue invoices and sends recovery reminders' },
  { agent: 'care',    duration: 3500, hint: 'Care monitors staff wellbeing via anonymous check-ins' },
  { agent: 'insight', duration: 3500, hint: 'Insight generates your 05:00 daily brief with key actions' },
  { agent: 'doc',     duration: 3500, hint: 'Doc scans contracts and flags risky clauses in seconds' },
  { agent: 'pen',     duration: 3500, hint: 'Pen writes WhatsApp blasts, LinkedIn posts, and proposals' },
  { agent: 'langa',   duration: 4000, hint: 'Langa is your AI business mentor — powered by the AdminOS Academy' },
]

// ─── Alex ─────────────────────────────────────────────────────────────────────
const ALEX_CONTACTS = [
  { name: 'Sipho Mthembu',      time: '09:14', unread: 2, preview: 'Good morning, re: the lease agreement…' },
  { name: 'Fatima Mokoena',     time: '08:52', unread: 1, preview: 'When will my contract be ready?' },
  { name: 'David van Rensburg', time: 'Yesterday', unread: 0, preview: 'Thanks for the update!' },
  { name: 'Nompumelelo Dube',   time: 'Yesterday', unread: 0, preview: 'Invoice received, processing.' },
]
const ALEX_SCRIPTED: Record<string, { from: string; text: string }[]> = {
  'Sipho Mthembu': [
    { from: 'sipho', text: 'Good morning. I need to follow up on the lease agreement review.' },
    { from: 'sipho', text: 'My tenant needs to sign by end of month.' },
    { from: 'alex',  text: "Hi Sipho 👋 Your lease agreement is ready. I've flagged 3 clauses for your attention before signing — shall I send a summary to WhatsApp?" },
  ],
  'Fatima Mokoena': [
    { from: 'fatima', text: 'Hi, when will my employment contract be ready?' },
    { from: 'alex',   text: "Hi Fatima! Contract EMP-2026-044 is 90% complete. Expected tomorrow by 14:00. I'll notify you the moment it's ready to sign 📋" },
  ],
}
const ALEX_QUICKREPLIES = ['Confirm appointment', 'Request document', 'Check invoice status', 'Schedule callback']
const ALEX_AI: Record<string, string> = {
  'confirm appointment': "✅ Confirmed for Thursday 30 April at 10:00. Calendar invite + WhatsApp reminder sent to the client.",
  'request document':    "📎 Document request sent via WhatsApp. Client has 48 hours to upload. You'll be notified when received.",
  'check invoice status':"Invoice INV-2026-031 (R8,500) — OVERDUE 12 days. 2 automated reminders sent. Want me to escalate to Chase?",
  'schedule callback':   "📅 Callback booked for 29 April at 15:00. Client notified via WhatsApp + email. 30-min reminder set.",
}

function AlexAgent() {
  const [active, setActive] = useState<string | null>(null)
  const [msgs, setMsgs] = useState<{ from: string; text: string }[]>([])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  function openChat(name: string) {
    setActive(name)
    setMsgs(ALEX_SCRIPTED[name] ?? [
      { from: 'client', text: 'Hi, I have a question about my case.' },
      { from: 'alex', text: "Hi there 👋 I'm Alex, the AI inbox assistant for Thabo Dlamini Attorneys. How can I help?" },
    ])
  }

  function send(text?: string) {
    const msg = (text ?? input).trim(); if (!msg) return
    setMsgs(p => [...p, { from: 'you', text: msg }]); setInput(''); setTyping(true)
    setTimeout(() => {
      const reply = ALEX_AI[msg.toLowerCase()] ?? `Got it! I've noted that and will follow up with ${active} shortly.`
      setMsgs(p => [...p, { from: 'alex', text: reply }]); setTyping(false)
    }, 1200)
  }

  if (!active) return (
    <div>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid #1e2a45', fontSize: 13, color: '#94a3b8' }}>4 active conversations · 3 unread</div>
      {ALEX_CONTACTS.map(c => (
        <button key={c.name} onClick={() => openChat(c.name)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', background: 'none', border: 'none', borderBottom: '1px solid #0f172a', cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'background .15s' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#0f172a')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        >
          <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#1e3a5f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0, position: 'relative' }}>
            {c.name[0]}
            {c.unread > 0 && <span style={{ position: 'absolute', top: -2, right: -2, background: '#F97316', color: '#fff', borderRadius: '50%', width: 18, height: 18, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{c.unread}</span>}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ fontWeight: 600, color: '#f1f5f9', fontSize: 14 }}>{c.name}</span>
              <span style={{ fontSize: 12, color: '#64748b' }}>{c.time}</span>
            </div>
            <div style={{ fontSize: 13, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.preview}</div>
          </div>
        </button>
      ))}
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid #1e2a45' }}>
        <button onClick={() => setActive(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 18, padding: 0 }}>←</button>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#1e3a5f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{active[0]}</div>
        <div><div style={{ fontWeight: 600, fontSize: 14, color: '#f1f5f9' }}>{active}</div><div style={{ fontSize: 12, color: '#06B6D4' }}>● online</div></div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.from === 'you' ? 'flex-end' : 'flex-start' }}>
            <div style={{ maxWidth: '72%', padding: '9px 13px', borderRadius: m.from === 'you' ? '14px 14px 4px 14px' : '14px 14px 14px 4px', background: m.from === 'you' ? '#F97316' : m.from === 'alex' ? '#1e3a5f' : '#162032', color: '#f1f5f9', fontSize: 13, lineHeight: 1.5 }}>{m.text}</div>
          </div>
        ))}
        {typing && <div style={{ display: 'flex', gap: 4, padding: '10px 14px', background: '#1e3a5f', borderRadius: '14px 14px 14px 4px', width: 'fit-content' }}>{[0,1,2].map(i => <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#06B6D4', animation: `tdot 1.2s ${i*.2}s infinite` }} />)}</div>}
        <div ref={endRef} />
      </div>
      <div style={{ padding: '8px 12px', borderTop: '1px solid #1e2a45' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {ALEX_QUICKREPLIES.map(r => (
            <button key={r} onClick={() => send(r)} style={{ padding: '5px 10px', borderRadius: 20, border: '1px solid #1e3a5f', background: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 12, transition: 'all .15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#F97316'; e.currentTarget.style.color = '#F97316' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#1e3a5f'; e.currentTarget.style.color = '#94a3b8' }}
            >{r}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Type a message…" style={{ flex: 1, background: '#0f172a', border: '1px solid #1e2a45', borderRadius: 24, padding: '9px 16px', color: '#f1f5f9', fontSize: 13, outline: 'none' }} />
          <button onClick={() => send()} style={{ background: '#F97316', border: 'none', borderRadius: '50%', width: 38, height: 38, cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>→</button>
        </div>
      </div>
    </div>
  )
}

// ─── Chase ────────────────────────────────────────────────────────────────────
const CHASE_INVOICES = [
  { id: 'INV-031', client: 'Sipho Mthembu',       amount: 'R 8,500',  due: '2026-04-16', days: 12, status: 'overdue' },
  { id: 'INV-028', client: 'Fatima Mokoena',       amount: 'R 15,000', due: '2026-04-10', days: 18, status: 'overdue' },
  { id: 'INV-034', client: 'City of Joburg',       amount: 'R 42,000', due: '2026-04-25', days: 3,  status: 'overdue' },
  { id: 'INV-035', client: 'Nexus Logistics',      amount: 'R 6,200',  due: '2026-05-05', days: 0,  status: 'pending' },
]

function ChaseAgent() {
  const [sent, setSent] = useState<Record<string, string>>({})
  const [selected, setSelected] = useState<string[]>([])
  const [bulkResult, setBulkResult] = useState<string | null>(null)

  function sendReminder(inv: typeof CHASE_INVOICES[0]) {
    setSent(p => ({ ...p, [inv.id]: 'sending' }))
    setTimeout(() => setSent(p => ({ ...p, [inv.id]: 'sent' })), 1000)
  }

  function sendBulk() {
    const targets = CHASE_INVOICES.filter(i => selected.includes(i.id))
    setBulkResult(`✅ Chase sent escalating reminders to ${targets.length} clients: ${targets.map(t => t.client.split(' ')[0]).join(', ')}. Average collection time after AI reminder: 3.2 days.`)
    setSelected([])
  }

  return (
    <div style={{ paddingBottom: 16 }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e2a45', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div><div style={{ fontSize: 13, color: '#94a3b8' }}>Outstanding balance</div><div style={{ fontSize: 26, fontWeight: 700, color: '#F97316' }}>R 71,700</div></div>
        <div style={{ textAlign: 'right' }}><div style={{ fontSize: 13, color: '#94a3b8' }}>Avg collection after AI reminder</div><div style={{ fontSize: 20, fontWeight: 700, color: '#06B6D4' }}>3.2 days</div></div>
      </div>
      {selected.length > 0 && (
        <div style={{ margin: '12px 20px', padding: '10px 14px', background: '#1a2540', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: '#94a3b8' }}>{selected.length} selected</span>
          <button onClick={sendBulk} style={{ background: '#F97316', border: 'none', borderRadius: 6, padding: '7px 14px', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Send bulk reminders</button>
        </div>
      )}
      {bulkResult && <div style={{ margin: '0 20px 12px', padding: '12px 14px', background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.3)', borderRadius: 8, fontSize: 13, color: '#06B6D4', lineHeight: 1.5 }}>{bulkResult}</div>}
      <div>
        {CHASE_INVOICES.map(inv => (
          <div key={inv.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: '1px solid #0f172a' }}>
            <input type="checkbox" checked={selected.includes(inv.id)} onChange={e => setSelected(p => e.target.checked ? [...p, inv.id] : p.filter(x => x !== inv.id))} style={{ accentColor: '#F97316', width: 16, height: 16, cursor: 'pointer', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontWeight: 600, color: '#f1f5f9', fontSize: 14 }}>{inv.client}</span>
                <span style={{ fontWeight: 700, color: inv.status === 'overdue' ? '#F97316' : '#94a3b8', fontSize: 14 }}>{inv.amount}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: '#64748b' }}>{inv.id} · Due {inv.due}</span>
                {inv.status === 'overdue' ? <span style={{ fontSize: 12, color: '#ef4444' }}>⚠ {inv.days}d overdue</span> : <span style={{ fontSize: 12, color: '#94a3b8' }}>Upcoming</span>}
              </div>
            </div>
            {inv.status === 'overdue' && (
              <button onClick={() => sendReminder(inv)} disabled={!!sent[inv.id]} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', cursor: sent[inv.id] ? 'default' : 'pointer', background: sent[inv.id] === 'sent' ? 'rgba(6,182,212,0.2)' : sent[inv.id] === 'sending' ? '#1e2a45' : '#F97316', color: sent[inv.id] === 'sent' ? '#06B6D4' : '#fff', fontSize: 12, fontWeight: 600, transition: 'all .3s', whiteSpace: 'nowrap' }}>
                {sent[inv.id] === 'sent' ? '✓ Sent' : sent[inv.id] === 'sending' ? '…' : 'Remind'}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Care ─────────────────────────────────────────────────────────────────────
const CARE_STAFF = [
  { name: 'Thandi Dlamini',   role: 'Paralegal',       score: 82, trend: '↑', last: '2 hrs ago',  flag: false },
  { name: 'Bongani Nkosi',    role: 'Senior Attorney', score: 61, trend: '↓', last: '1 day ago',  flag: true  },
  { name: 'Priya Naidoo',     role: 'Conveyancing',    score: 90, trend: '→', last: '3 hrs ago',  flag: false },
  { name: 'Lebo Sithole',     role: 'Admin',           score: 54, trend: '↓', last: '2 days ago', flag: true  },
]
const CARE_RESPONSES = [
  "💚 Wellness check sent to all 4 staff via WhatsApp. Bongani and Lebo flagged — anonymous support resources and SA EAP helpline shared. Follow-up in 48 hours.",
  "📋 Anonymous pulse survey deployed. Average response time: 4.2 min. Results anonymised before sharing with management.",
  "🌿 Stress resources sent: SA EAP helpline (0800 131 333), breathing exercise, and optional 1:1 scheduling invite — no names shared.",
]

function CareAgent() {
  const [result, setResult] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [idx, setIdx] = useState(0)

  function send() {
    setLoading(true)
    setTimeout(() => { setResult(CARE_RESPONSES[idx % CARE_RESPONSES.length]); setIdx(i => i + 1); setLoading(false) }, 1400)
  }

  function color(n: number) { return n >= 80 ? '#22c55e' : n >= 65 ? '#F97316' : '#ef4444' }

  return (
    <div>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e2a45', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div><div style={{ fontSize: 13, color: '#94a3b8' }}>Team wellness score</div><div style={{ fontSize: 26, fontWeight: 700, color: '#22c55e' }}>71.75 <span style={{ fontSize: 14, color: '#64748b', fontWeight: 400 }}>/ 100</span></div></div>
        <div style={{ textAlign: 'right' }}><div style={{ fontSize: 12, color: '#ef4444', fontWeight: 600 }}>2 staff need support</div><div style={{ fontSize: 12, color: '#64748b' }}>Action recommended</div></div>
      </div>
      {CARE_STAFF.map(s => (
        <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: '1px solid #0f172a', background: s.flag ? 'rgba(239,68,68,0.04)' : 'none' }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#1e3a5f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{s.name[0]}</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 600, color: '#f1f5f9', fontSize: 14 }}>{s.name}</span>
              {s.flag && <span style={{ fontSize: 11, color: '#ef4444', background: 'rgba(239,68,68,0.15)', padding: '2px 8px', borderRadius: 20 }}>Needs support</span>}
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{s.role} · {s.last}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: color(s.score) }}>{s.score}</div>
            <div style={{ fontSize: 12, color: s.trend === '↑' ? '#22c55e' : s.trend === '↓' ? '#ef4444' : '#94a3b8' }}>{s.trend}</div>
          </div>
        </div>
      ))}
      <div style={{ padding: '16px 20px' }}>
        {result && <div style={{ marginBottom: 12, padding: '12px 14px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 8, fontSize: 13, color: '#86efac', lineHeight: 1.6 }}>{result}</div>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={send} disabled={loading} style={{ background: '#22c55e', border: 'none', borderRadius: 8, padding: '10px 18px', color: '#fff', fontWeight: 600, fontSize: 13, cursor: loading ? 'wait' : 'pointer', opacity: loading ? .7 : 1 }}>{loading ? 'Sending…' : '💚 Send wellness check'}</button>
          <button onClick={send} disabled={loading} style={{ background: 'none', border: '1px solid #1e3a5f', borderRadius: 8, padding: '10px 18px', color: '#94a3b8', fontWeight: 600, fontSize: 13, cursor: loading ? 'wait' : 'pointer' }}>{loading ? '…' : '📋 Deploy pulse survey'}</button>
        </div>
      </div>
    </div>
  )
}

// ─── Doc ──────────────────────────────────────────────────────────────────────
const DOC_RESULT = {
  title: 'Employment Contract — Priya Naidoo',
  type: 'Employment Agreement',
  parties: ['Thabo Dlamini Attorneys (Employer)', 'Priya Naidoo (Employee)'],
  date: '1 May 2026',
  clauses: [
    { label: 'Probation',     value: '3 months',              flag: false },
    { label: 'Notice period', value: '4 weeks',               flag: false },
    { label: 'Non-compete',   value: '24 months — ⚠ long',   flag: true  },
    { label: 'IP Assignment', value: 'All work product',      flag: false },
    { label: 'Governing law', value: 'South Africa',          flag: false },
  ],
  risk: 'Medium',
  riskDetail: 'Non-compete clause (24 months) may be unenforceable under SA labour law. Recommend reducing to 12 months.',
}

function DocAgent() {
  const [phase, setPhase] = useState<'idle' | 'scanning' | 'done'>('idle')
  const [progress, setProgress] = useState(0)

  function scan() {
    setPhase('scanning'); setProgress(0)
    const iv = setInterval(() => setProgress(p => { if (p >= 100) { clearInterval(iv); setPhase('done'); return 100 } return p + 7 }), 80)
  }

  return (
    <div style={{ padding: '16px 20px' }}>
      {phase === 'idle' && (
        <div>
          <div style={{ border: '2px dashed #1e3a5f', borderRadius: 12, padding: '40px 20px', textAlign: 'center', cursor: 'pointer', transition: 'border-color .2s' }}
            onClick={scan}
            onMouseEnter={e => (e.currentTarget.style.borderColor = '#a78bfa')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = '#1e3a5f')}
          >
            <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
            <div style={{ fontWeight: 600, color: '#f1f5f9', marginBottom: 6 }}>employment_contract_priya.pdf</div>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>128 KB · PDF · Ready to scan</div>
            <button style={{ background: '#a78bfa', border: 'none', borderRadius: 8, padding: '10px 24px', color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Scan with Doc AI →</button>
          </div>
          <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
            {['NDA', 'Lease', 'Invoice', 'Will'].map(t => (
              <div key={t} onClick={scan} style={{ padding: '8px 14px', border: '1px solid #1e2a45', borderRadius: 8, fontSize: 12, color: '#64748b', cursor: 'pointer', transition: 'all .15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#a78bfa'; e.currentTarget.style.color = '#a78bfa' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#1e2a45'; e.currentTarget.style.color = '#64748b' }}
              >{t}</div>
            ))}
          </div>
        </div>
      )}
      {phase === 'scanning' && (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 36, marginBottom: 16 }}>🔍</div>
          <div style={{ fontWeight: 600, color: '#f1f5f9', marginBottom: 20 }}>Doc AI is reading your document…</div>
          <div style={{ background: '#0f172a', borderRadius: 99, height: 8, overflow: 'hidden', margin: '0 auto', maxWidth: 300 }}>
            <div style={{ height: '100%', background: 'linear-gradient(90deg,#a78bfa,#06B6D4)', borderRadius: 99, width: `${progress}%`, transition: 'width .08s' }} />
          </div>
          <div style={{ marginTop: 12, fontSize: 13, color: '#64748b' }}>Extracting clauses, parties, dates, risk flags…</div>
        </div>
      )}
      {phase === 'done' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#f1f5f9' }}>{DOC_RESULT.title}</div>
              <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>{DOC_RESULT.type} · Signed {DOC_RESULT.date}</div>
            </div>
            <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: 'rgba(249,115,22,0.15)', color: '#F97316' }}>{DOC_RESULT.risk} risk</span>
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Parties</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {DOC_RESULT.parties.map(p => <span key={p} style={{ padding: '5px 12px', background: '#1e3a5f', borderRadius: 20, fontSize: 13, color: '#94a3b8' }}>{p}</span>)}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Key clauses</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
            {DOC_RESULT.clauses.map(c => (
              <div key={c.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 14px', background: c.flag ? 'rgba(249,115,22,0.06)' : '#0f172a', borderRadius: 8, border: c.flag ? '1px solid rgba(249,115,22,0.3)' : '1px solid transparent' }}>
                <span style={{ fontSize: 13, color: '#94a3b8' }}>{c.label}</span>
                <span style={{ fontSize: 13, color: c.flag ? '#F97316' : '#f1f5f9', fontWeight: c.flag ? 600 : 400 }}>{c.value}</span>
              </div>
            ))}
          </div>
          <div style={{ padding: '12px 14px', background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.25)', borderRadius: 8, fontSize: 13, color: '#fbbf24', lineHeight: 1.5 }}>⚠ {DOC_RESULT.riskDetail}</div>
          <button onClick={() => setPhase('idle')} style={{ marginTop: 16, background: 'none', border: '1px solid #1e3a5f', borderRadius: 8, padding: '8px 16px', color: '#64748b', cursor: 'pointer', fontSize: 13 }}>← Scan another document</button>
        </div>
      )}
    </div>
  )
}

// ─── Insight ──────────────────────────────────────────────────────────────────
const INSIGHT_METRICS = [
  { label: 'Revenue MTD',         value: 'R 127,400', change: '+18%', up: true  },
  { label: 'Invoices collected',  value: '23 / 31',   change: '74%',  up: true  },
  { label: 'Avg response time',   value: '4.2 min',   change: '-31%', up: true  },
  { label: 'Staff wellness score',value: '71.75',     change: '-4pt', up: false },
]
const INSIGHT_BRIEFS = [
  `Good morning, Thabo. Here's your ${DATE} daily brief:\n\n💰 Revenue tracking R 127,400 for June — 18% above target. Chase recovered 3 overdue accounts worth R 65,500 this week.\n\n⚠️ Bongani Nkosi's wellness score dropped 12 points — recommend a private check-in today.\n\n📅 Contract deadlines this week: Sipho Mthembu (lease review) due Friday is highest priority.\n\n🔥 Action today: Approve INV-034 (City of Joburg, R 42,000) before the 10:00 deadline.`,
  `Afternoon snapshot for ${DATE}:\n\n📞 Alex handled 12 WhatsApp messages — 9 resolved automatically, 3 awaiting your reply.\n\n📄 Doc scanned 4 contracts today. 1 flagged: employment agreement non-compete clause (24 months) likely unenforceable — review before Friday signing.\n\n💡 Insight: Clients who receive WhatsApp reminders pay 4.8× faster than email-only. Chase saved your practice an estimated R 18,000 in collection costs this month.`,
]
const BAR_DATA = [
  { label: 'Mon', h: 55 }, { label: 'Tue', h: 80 }, { label: 'Wed', h: 65 },
  { label: 'Thu', h: 90 }, { label: 'Fri', h: 45 },
]

function InsightAgent() {
  const [brief, setBrief] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [idx, setIdx] = useState(0)

  function generate() {
    setLoading(true); setBrief(null)
    setTimeout(() => { setBrief(INSIGHT_BRIEFS[idx % INSIGHT_BRIEFS.length]); setIdx(i => i + 1); setLoading(false) }, 1600)
  }

  return (
    <div style={{ paddingBottom: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, borderBottom: '1px solid #1e2a45' }}>
        {INSIGHT_METRICS.map(m => (
          <div key={m.label} style={{ padding: '14px 20px', borderRight: '1px solid #1e2a45', borderBottom: '1px solid #0f172a' }}>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>{m.label}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9' }}>{m.value}</div>
            <div style={{ fontSize: 12, color: m.up ? '#22c55e' : '#ef4444', marginTop: 2 }}>{m.change}</div>
          </div>
        ))}
      </div>
      <div style={{ padding: '16px 20px' }}>
        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>Revenue this week (R thousands)</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 80, marginBottom: 16 }}>
          {BAR_DATA.map((b, i) => (
            <div key={b.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{ width: '100%', height: `${b.h}%`, borderRadius: '4px 4px 0 0', background: i === 3 ? '#06B6D4' : '#F97316', opacity: .85 }} />
              <span style={{ fontSize: 11, color: '#64748b' }}>{b.label}</span>
            </div>
          ))}
        </div>
        <button onClick={generate} disabled={loading} style={{ background: 'linear-gradient(135deg,#F97316,#ea580c)', border: 'none', borderRadius: 8, padding: '11px 20px', color: '#fff', fontWeight: 700, fontSize: 14, cursor: loading ? 'wait' : 'pointer', width: '100%', opacity: loading ? .7 : 1 }}>
          {loading ? '🧠 Generating brief…' : '🧠 Generate daily AI brief'}
        </button>
        {brief && <div style={{ marginTop: 14, padding: '14px 16px', background: '#0f172a', border: '1px solid #1e2a45', borderRadius: 10, fontSize: 13, color: '#cbd5e1', lineHeight: 1.7, whiteSpace: 'pre-line' }}>{brief}</div>}
      </div>
    </div>
  )
}

// ─── Pen ──────────────────────────────────────────────────────────────────────
const PEN_TEMPLATES = [
  { id: 'whatsapp', label: '💬 WhatsApp broadcast' },
  { id: 'linkedin', label: '💼 LinkedIn post' },
  { id: 'invoice',  label: '📧 Invoice email' },
  { id: 'reminder', label: '🔔 Payment reminder' },
  { id: 'proposal', label: '📋 Service proposal' },
]
const PEN_SCRIPTED: Record<string, (t: string) => string> = {
  whatsapp: t => `Hi [Client Name] 👋\n\n${t ? `Re: ${t}\n\n` : ''}Thabo Dlamini Attorneys — professional, affordable legal services.\n\n✅ Fast turnaround\n✅ POPI compliant\n✅ 15+ years experience\n\nReply YES to book a free 20-minute consultation.\n\n— Thabo Dlamini Attorneys\n📞 011 234 5678`,
  linkedin: t => `🏛️ Why SA SMEs can't skip legal advice in 2026\n\n${t || 'Contracts protect your business. One dispute without documentation can cost more than a year of legal fees.'}\n\nAt Thabo Dlamini Attorneys:\n→ Verbal agreements gone wrong\n→ Lease clauses that favour landlords\n→ Employee disputes without documentation\n\nAffordable retainer packages from R1,800/month.\n\nDM me or visit thabodlamini.co.za\n\n#LegalAdvice #SouthAfrica #SME #BusinessLaw`,
  invoice:  t => `Subject: Invoice ${t || 'INV-2026-035'} — Thabo Dlamini Attorneys\n\nDear [Client Name],\n\nPlease find invoice ${t || 'INV-2026-035'} attached.\n\n📋 Amount due: R [AMOUNT]\n📅 Payment due: 30 days from invoice date\n🏦 FNB: Account 62345678901 (Branch 250655)\n\nUse invoice number as reference.\n\nQueries? Reply here or WhatsApp +27 82 123 4567.\n\nWarm regards,\nThabo Dlamini`,
  reminder: t => `Hi [Client Name] 🔔\n\nFriendly reminder: invoice ${t || 'INV-2026-031'} (R 8,500) was due on 16 April.\n\nPlease arrange payment within 48 hours to avoid further action.\n\n💳 EFT: FNB 62345678901\n💳 PayFast: thabodlamini.co.za/pay\n\nAlready paid? Send proof to accounts@thabodlamini.co.za 🙏`,
  proposal: t => `SERVICE PROPOSAL\nThabo Dlamini Attorneys\n\nPrepared for: ${t || '[Prospective Client]'}\nDate: ${DATE}\n\n─────────────────────\nSCOPE OF SERVICES\n─────────────────────\n✓ Commercial contract drafting\n✓ Employment law compliance\n✓ Property law & conveyancing\n✓ Dispute resolution\n\n─────────────────────\nPRICING\n─────────────────────\nRetainer (10 hrs/mo): R 4,500/month\nAd hoc rate: R 850/hour\nDocument review: R 350/document\n\n─────────────────────\nNEXT STEPS\n─────────────────────\nSign & return by: 21 June 2026\nKick-off call: 23 June 2026\n\nQuestions? 011 234 5678`,
}

function PenAgent() {
  const [template, setTemplate] = useState('whatsapp')
  const [topic, setTopic] = useState('')
  const [output, setOutput] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  function generate() {
    setLoading(true); setOutput(null); setCopied(false)
    setTimeout(() => { setOutput(PEN_SCRIPTED[template]?.(topic) ?? ''); setLoading(false) }, 1000)
  }

  function copy() {
    if (output) { navigator.clipboard.writeText(output).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 2000) }
  }

  return (
    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Content type</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {PEN_TEMPLATES.map(t => (
            <button key={t.id} onClick={() => setTemplate(t.id)} style={{ padding: '7px 13px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, background: template === t.id ? '#F97316' : '#1e2a45', color: template === t.id ? '#fff' : '#94a3b8', transition: 'all .2s' }}>{t.label}</button>
          ))}
        </div>
      </div>
      <div>
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Topic / reference (optional)</div>
        <input value={topic} onChange={e => setTopic(e.target.value)} onKeyDown={e => e.key === 'Enter' && generate()}
          placeholder={template === 'invoice' ? 'Invoice number…' : template === 'proposal' ? 'Client name…' : 'Topic or context…'}
          style={{ width: '100%', background: '#0f172a', border: '1px solid #1e2a45', borderRadius: 8, padding: '10px 14px', color: '#f1f5f9', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
        />
      </div>
      <button onClick={generate} disabled={loading} style={{ background: 'linear-gradient(135deg,#F97316,#ea580c)', border: 'none', borderRadius: 8, padding: 11, color: '#fff', fontWeight: 700, fontSize: 14, cursor: loading ? 'wait' : 'pointer', opacity: loading ? .7 : 1 }}>
        {loading ? '✍️ Pen is writing…' : '✍️ Generate content'}
      </button>
      {output && (
        <div style={{ position: 'relative' }}>
          <pre style={{ background: '#0f172a', border: '1px solid #1e2a45', borderRadius: 10, padding: 14, fontSize: 13, color: '#cbd5e1', lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0, fontFamily: 'inherit' }}>{output}</pre>
          <button onClick={copy} style={{ position: 'absolute', top: 10, right: 10, background: copied ? '#22c55e' : '#1e3a5f', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 12, color: '#fff', cursor: 'pointer', transition: 'background .3s' }}>{copied ? '✓ Copied' : 'Copy'}</button>
        </div>
      )}
    </div>
  )
}

// ─── Langa — Business Academy Mentor ──────────────────────────────────────────
const LANGA_FRAMEWORKS = [
  { id: 'cashflow',   label: '💰 Cash Flow Management',   modules: 6,  completed: 4, level: 'Foundation' },
  { id: 'labour',     label: '⚖️ SA Labour Law 101',      modules: 8,  completed: 2, level: 'Foundation' },
  { id: 'pricing',    label: '📊 Pricing Strategy',       modules: 5,  completed: 5, level: 'Foundation' },
  { id: 'delegation', label: '👥 Delegation & Systems',   modules: 7,  completed: 1, level: 'Grow' },
  { id: 'valuation',  label: '🏦 Business Valuation',     modules: 10, completed: 0, level: 'Scale' },
]

const LANGA_QA: { q: string; a: string }[] = [
  {
    q: "What's the most important thing I can do to improve cash flow right now?",
    a: "Based on your business profile, your biggest cash flow risk is the 45-day average invoice payment gap. Here are 3 actions specific to a legal practice:\n\n1. **Switch to 50% upfront deposits** for all new matters — standard for SA attorneys.\n2. **Run Chase daily at 08:00** — automated WhatsApp reminders increase collection speed by 60%.\n3. **Offer payment plans via PayFast** for clients > R20,000 — reduces disputes and keeps them paying.\n\nThe 'Float Buffer' framework (Module 3 of Cash Flow Management) covers your 90-day safety net calculation.",
  },
  {
    q: "One of my employees handed in their notice. What do I need to do?",
    a: "For SA labour law compliance, here's your resignation checklist:\n\n✅ **Acknowledge in writing** within 24 hours (required)\n✅ **Confirm notice period** — standard is 4 weeks for your staff level (check the contract)\n✅ **Begin handover plan** immediately — document all active matters\n✅ **UIF final contribution** due in the month of departure\n✅ **Final payslip** must include leave payout for unused days\n\n⚠️ Do NOT withhold any pay as leverage — this is an LRA violation.\n\nLanga has pre-drafted a **resignation acknowledgement letter** — want me to send it to your inbox?",
  },
  {
    q: "I want to grow but I'm worried about hiring wrong.",
    a: "This is the #1 concern I hear from SA business owners at your stage.\n\n**The Delegation Readiness Framework (Module 1)** covers this. Key insight:\n\nBefore your first hire, document:\n→ Every task you do weekly (use AdminOS tasks for this)\n→ Which require your expertise vs which could be delegated\n→ Standard Operating Procedures for the delegatable ones\n\n**SA-specific hiring tip:** Use a 3-month probation period with clear, written KPIs from day 1. If you need to part ways, documented performance issues protect you at the CCMA.\n\nYour **Employee OS** is already set up to track this. Want to start the Delegation module now?",
  },
  {
    q: "How much is my business worth?",
    a: "A legal practice like yours is typically valued at **2–3× annual net profit** (EBITDA multiple for SA professional services).\n\n📊 Based on your revenue of R127,400 MTD (annualised ~R1.5M):\n\n| Scenario | Multiplier | Estimated Value |\n|----------|------------|-----------------|\n| Conservative | 2× | R 960,000 |\n| Standard | 2.5× | R 1,200,000 |\n| With systems | 3× | R 1,440,000 |\n\n**The key insight:** A business with documented systems and recurring clients commands 3× vs 1.5× for an owner-dependent practice.\n\nAdminOS tracks your **Exit Readiness Score**. Currently estimated at **41/100** — run the Business Valuation module (Scale plan) to get a full report with your specific uplift actions.",
  },
]

function LangaAgent() {
  const [msgs, setMsgs] = useState<{ from: 'user' | 'langa'; text: string }[]>([
    { from: 'langa', text: "Hi Thabo 👋 I'm Langa, your AdminOS business mentor. I've been studying your business — revenue trends, staff wellness, outstanding invoices, compliance calendar.\n\nWhat's on your mind today? I can help with cash flow, hiring, legal compliance, pricing, growth planning, or anything else you're navigating as a South African business owner." },
  ])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [activeFramework, setActiveFramework] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs, typing])

  function send(text?: string) {
    const msg = (text ?? input).trim(); if (!msg) return
    setMsgs(p => [...p, { from: 'user', text: msg }]); setInput(''); setTyping(true)
    setTimeout(() => {
      const lower = msg.toLowerCase()
      const match = LANGA_QA.find(qa => {
        const keywords = qa.q.toLowerCase().split(' ').filter(w => w.length > 4)
        return keywords.some(k => lower.includes(k))
      })
      const reply = match?.a ?? `That's a great question for a ${TENANT} at your stage. The AdminOS Business Academy has a framework specifically for this — let me pull the most relevant insight from your business data and the 40+ playbooks in the library.\n\n(In the full app, Langa has access to your actual revenue, staff data, compliance calendar, and industry benchmarks to give personalised guidance.)`
      setMsgs(p => [...p, { from: 'langa', text: reply }]); setTyping(false)
    }, 1800)
  }

  const SUGGESTED = [
    "How do I improve cash flow?",
    "Employee handed in notice — what now?",
    "How much is my business worth?",
    "I want to grow but afraid to hire wrong",
  ]

  const fw = LANGA_FRAMEWORKS.find(f => f.id === activeFramework)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Frameworks strip */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid #1e2a45', display: 'flex', gap: 8, overflowX: 'auto' }}>
        {LANGA_FRAMEWORKS.map(f => (
          <button key={f.id} onClick={() => setActiveFramework(activeFramework === f.id ? null : f.id)} style={{ flexShrink: 0, padding: '5px 12px', borderRadius: 20, border: `1px solid ${activeFramework === f.id ? '#fbbf24' : '#1e3a5f'}`, background: activeFramework === f.id ? 'rgba(251,191,36,.1)' : 'none', color: activeFramework === f.id ? '#fbbf24' : '#64748b', fontSize: 12, cursor: 'pointer', transition: 'all .2s', whiteSpace: 'nowrap' }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Framework card */}
      {fw && (
        <div style={{ margin: '12px 16px', padding: '14px', background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div><div style={{ fontWeight: 700, color: '#f1f5f9', fontSize: 14 }}>{fw.label}</div><div style={{ fontSize: 12, color: '#64748b' }}>{fw.level} level · {fw.modules} modules</div></div>
            <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: fw.completed === fw.modules ? 'rgba(34,197,94,.15)' : 'rgba(251,191,36,.15)', color: fw.completed === fw.modules ? '#22c55e' : '#fbbf24', fontWeight: 700 }}>{fw.completed === fw.modules ? '✓ Complete' : `${fw.completed}/${fw.modules} done`}</span>
          </div>
          <div style={{ background: '#0f172a', borderRadius: 99, height: 6, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: 'linear-gradient(90deg,#fbbf24,#f59e0b)', borderRadius: 99, width: `${(fw.completed / fw.modules) * 100}%`, transition: 'width .5s' }} />
          </div>
          <button onClick={() => send(`Tell me more about the ${fw.label} framework`)} style={{ marginTop: 10, background: 'none', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 8, padding: '6px 14px', color: '#fbbf24', fontSize: 12, cursor: 'pointer' }}>
            {fw.completed > 0 ? '▶ Continue learning' : '▶ Start this framework'} →
          </button>
        </div>
      )}

      {/* Chat */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.from === 'user' ? 'flex-end' : 'flex-start', gap: 10 }}>
            {m.from === 'langa' && <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(251,191,36,0.2)', border: '1px solid rgba(251,191,36,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0, alignSelf: 'flex-end' }}>🎓</div>}
            <div style={{ maxWidth: '72%', padding: '10px 14px', borderRadius: m.from === 'user' ? '14px 14px 4px 14px' : '4px 14px 14px 14px', background: m.from === 'user' ? '#F97316' : 'rgba(251,191,36,0.08)', border: m.from === 'langa' ? '1px solid rgba(251,191,36,0.2)' : 'none', color: '#f1f5f9', fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-line' }}>{m.text}</div>
          </div>
        ))}
        {typing && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(251,191,36,0.2)', border: '1px solid rgba(251,191,36,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>🎓</div>
            <div style={{ display: 'flex', gap: 4, padding: '12px 16px', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: '4px 14px 14px 14px', alignItems: 'center' }}>
              {[0,1,2].map(i => <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#fbbf24', animation: `tdot 1.2s ${i*.2}s infinite` }} />)}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Suggested questions */}
      {msgs.length < 3 && (
        <div style={{ padding: '8px 16px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {SUGGESTED.map(q => (
            <button key={q} onClick={() => send(q)} style={{ padding: '6px 12px', borderRadius: 20, border: '1px solid rgba(251,191,36,0.3)', background: 'rgba(251,191,36,0.06)', color: '#fbbf24', fontSize: 12, cursor: 'pointer', transition: 'all .15s', textAlign: 'left' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(251,191,36,0.15)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(251,191,36,0.06)' }}
            >{q}</button>
          ))}
        </div>
      )}

      <div style={{ padding: '8px 12px', borderTop: '1px solid #1e2a45' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Ask Langa anything about your business…" style={{ flex: 1, background: '#0f172a', border: '1px solid #1e2a45', borderRadius: 24, padding: '9px 16px', color: '#f1f5f9', fontSize: 13, outline: 'none' }} />
          <button onClick={() => send()} style={{ background: '#fbbf24', border: 'none', borderRadius: '50%', width: 38, height: 38, cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>→</button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Demo Page ───────────────────────────────────────────────────────────
export default function DemoPage() {
  const [activeAgent, setActiveAgent] = useState('alex')
  const [notifs, setNotifs] = useState<typeof LIVE_EVENTS>([])
  const [tourActive, setTourActive] = useState(false)
  const [tourStep, setTourStep] = useState(0)
  const [hint, setHint] = useState<string | null>(null)
  const notifTimerRef = useRef<NodeJS.Timeout | null>(null)
  const tourTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Live notification ticker
  useEffect(() => {
    let i = 0
    const fire = () => {
      setNotifs(p => [LIVE_EVENTS[i % LIVE_EVENTS.length], ...p].slice(0, 5))
      i++
      notifTimerRef.current = setTimeout(fire, 4000 + Math.random() * 3000)
    }
    notifTimerRef.current = setTimeout(fire, 3000)
    return () => { if (notifTimerRef.current) clearTimeout(notifTimerRef.current) }
  }, [])

  // Auto guided tour
  const advanceTour = useCallback((step: number) => {
    if (step >= TOUR_STEPS.length) { setTourActive(false); setHint(null); return }
    const s = TOUR_STEPS[step]
    setActiveAgent(s.agent); setHint(s.hint); setTourStep(step)
    tourTimerRef.current = setTimeout(() => advanceTour(step + 1), s.duration)
  }, [])

  function startTour() {
    setTourActive(true); setTourStep(0)
    if (tourTimerRef.current) clearTimeout(tourTimerRef.current)
    advanceTour(0)
  }

  function stopTour() {
    setTourActive(false); setHint(null)
    if (tourTimerRef.current) clearTimeout(tourTimerRef.current)
  }

  useEffect(() => () => { if (tourTimerRef.current) clearTimeout(tourTimerRef.current) }, [])

  const activeAgentMeta = AGENTS.find(a => a.id === activeAgent)!

  function renderAgent() {
    switch (activeAgent) {
      case 'alex':    return <AlexAgent />
      case 'chase':   return <ChaseAgent />
      case 'care':    return <CareAgent />
      case 'doc':     return <DocAgent />
      case 'insight': return <InsightAgent />
      case 'pen':     return <PenAgent />
      case 'langa':   return <LangaAgent />
      default:        return null
    }
  }

  return (
    <div className="demo-page">
      <style>{`
        * { box-sizing: border-box; }
        body { background: #050B1A; margin: 0; font-family: 'Geist', system-ui, sans-serif; }
        @keyframes tdot { 0%,80%,100%{transform:scale(0.6);opacity:0.4} 40%{transform:scale(1);opacity:1} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slideIn { from{opacity:0;transform:translateX(-10px)} to{opacity:1;transform:translateX(0)} }
        @keyframes pulse2 { 0%,100%{opacity:1} 50%{opacity:.4} }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: #0f172a; }
        ::-webkit-scrollbar-thumb { background: #1e3a5f; border-radius: 2px; }
        .agent-btn:hover { background: #0f172a !important; }
        .agent-btn.active { background: rgba(249,115,22,0.12) !important; }
        .notif-item { animation: slideIn .3s ease both; }
        .tour-hint { animation: fadeUp .4s ease both; }
        @media (max-width: 700px) {
          .demo-shell { flex-direction: column !important; height: auto !important; }
          .demo-sidebar { flex-direction: row !important; width: 100% !important; overflow-x: auto; border-right: none !important; border-bottom: 1px solid #1e2a45 !important; padding: 8px !important; gap: 4px !important; }
          .demo-sidebar-label, .demo-sidebar-footer, .demo-notifs, .demo-header-right { display: none !important; }
          .demo-agent-btn { flex-direction: row !important; padding: 8px 12px !important; border-radius: 20px !important; }
          .demo-agent-role { display: none !important; }
          .demo-banner-text { display: none; }
          .demo-page { display: flex; flex-direction: column; height: 100dvh; }
        }
      `}</style>

      {/* ── Top banner ─────────────────────────────── */}
      <div style={{ background: 'linear-gradient(90deg,rgba(249,115,22,.15),rgba(6,182,212,.1))', borderBottom: '1px solid rgba(249,115,22,.3)', padding: '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ background: '#F97316', color: '#fff', fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 20, letterSpacing: 1.5 }}>DEMO MODE</span>
          <span className="demo-banner-text" style={{ color: '#94a3b8', fontSize: 13 }}>Viewing <strong style={{ color: '#f1f5f9' }}>{TENANT}</strong> — fake data, no real API calls</span>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={tourActive ? stopTour : startTour} style={{ background: tourActive ? 'rgba(6,182,212,.2)' : 'rgba(255,255,255,.08)', border: `1px solid ${tourActive ? '#06B6D4' : 'rgba(255,255,255,.15)'}`, borderRadius: 8, padding: '7px 14px', color: tourActive ? '#06B6D4' : '#f1f5f9', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            {tourActive ? '⏹ Stop tour' : '▶ Auto-guided tour'}
          </button>
          <Link href="/#pricing" style={{ background: '#F97316', color: '#fff', textDecoration: 'none', padding: '8px 18px', borderRadius: 8, fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap' }}>Get AdminOS — from R349/mo →</Link>
        </div>
      </div>

      {/* ── Tour hint banner ───────────────────────── */}
      {hint && (
        <div className="tour-hint" style={{ background: 'rgba(6,182,212,0.1)', borderBottom: '1px solid rgba(6,182,212,.25)', padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {TOUR_STEPS.map((_, i) => (
              <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: i === tourStep ? '#06B6D4' : '#1e3a5f', transition: 'background .3s' }} />
            ))}
          </div>
          <span style={{ color: '#06B6D4', fontSize: 13, fontWeight: 500 }}>👀 {hint}</span>
        </div>
      )}

      {/* ── Header ─────────────────────────────────── */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid #1e2a45', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#0A0F2C' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'linear-gradient(135deg,#F97316,#ea580c)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 16, color: '#fff' }}>A</div>
          <div>
            <div style={{ fontWeight: 700, color: '#f1f5f9', fontSize: 15 }}>{TENANT}</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>AdminOS · {DATE}</div>
          </div>
        </div>
        <div className="demo-header-right" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, color: '#64748b' }}>Business Health Score</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#22c55e' }}>74 <span style={{ fontSize: 12, color: '#64748b', fontWeight: 400 }}>/ 100</span></div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', animation: 'pulse2 2s infinite' }} />
            <span style={{ fontSize: 12, color: '#22c55e' }}>7 agents active</span>
          </div>
        </div>
      </div>

      {/* ── Shell ──────────────────────────────────── */}
      <div className="demo-shell" style={{ display: 'flex', flex: 1, height: 'calc(100vh - 160px)', minHeight: 500, overflow: 'hidden' }}>

        {/* Sidebar */}
        <div className="demo-sidebar" style={{ width: 220, flexShrink: 0, background: '#0A0F2C', borderRight: '1px solid #1e2a45', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          <div className="demo-sidebar-label" style={{ fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: 1.2, padding: '14px 14px 6px', fontWeight: 600 }}>AI Agents</div>

          <div style={{ padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {AGENTS.map(a => (
              <button key={a.id} onClick={() => { setActiveAgent(a.id); if (tourActive) stopTour() }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', textAlign: 'left', background: activeAgent === a.id ? 'rgba(249,115,22,0.12)' : 'none', transition: 'background .15s', position: 'relative' }}
                onMouseEnter={e => { if (activeAgent !== a.id) e.currentTarget.style.background = '#0f172a' }}
                onMouseLeave={e => { if (activeAgent !== a.id) e.currentTarget.style.background = 'none' }}
              >
                <span style={{ fontSize: 18, flexShrink: 0 }}>{a.icon}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: activeAgent === a.id ? a.color : '#f1f5f9', transition: 'color .15s' }}>{a.label}</div>
                  <div className="demo-agent-role" style={{ fontSize: 11, color: '#475569' }}>{a.role}</div>
                </div>
                {a.id === 'langa' && <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 800, background: 'rgba(251,191,36,.2)', color: '#fbbf24', padding: '2px 6px', borderRadius: 20, flexShrink: 0 }}>NEW</span>}
              </button>
            ))}
          </div>

          {/* Live notifications */}
          <div className="demo-notifs" style={{ margin: '8px 10px 0', borderTop: '1px solid #1e2a45', paddingTop: 10 }}>
            <div style={{ fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600, marginBottom: 8, padding: '0 4px' }}>Live activity</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {notifs.length === 0 && <div style={{ fontSize: 12, color: '#334155', padding: '4px', fontStyle: 'italic' }}>Agents standing by…</div>}
              {notifs.map((n, i) => (
                <div key={i} className="notif-item" style={{ padding: '6px 8px', background: '#0f172a', borderRadius: 6, borderLeft: `2px solid ${n.color}`, opacity: 1 - i * 0.15 }}>
                  <div style={{ fontSize: 11, color: n.color, fontWeight: 600, marginBottom: 1 }}>{n.icon} {n.agent} · {n.time}</div>
                  <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.3 }}>{n.text}</div>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="demo-sidebar-footer" style={{ marginTop: 'auto', padding: '16px 10px', borderTop: '1px solid #1e2a45' }}>
            <Link href="/signup" style={{ display: 'block', background: '#F97316', borderRadius: 8, padding: '10px 12px', color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: 13, textAlign: 'center' }}>Start free trial →</Link>
            <Link href="/" style={{ display: 'block', marginTop: 8, color: '#475569', textDecoration: 'none', fontSize: 12, textAlign: 'center' }}>← Back to site</Link>
          </div>
        </div>

        {/* Agent panel */}
        <div style={{ flex: 1, overflowY: 'auto', background: '#050B1A', display: 'flex', flexDirection: 'column' }}>
          {/* Panel header */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #1e2a45', background: '#0A0F2C', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <span style={{ fontSize: 22 }}>{activeAgentMeta.icon}</span>
            <div>
              <div style={{ fontWeight: 700, color: '#f1f5f9', fontSize: 15 }}>{activeAgentMeta.label}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>{activeAgentMeta.role} Agent · Live</div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: activeAgentMeta.color, animation: 'pulse2 2s infinite' }} />
              <span style={{ fontSize: 12, color: activeAgentMeta.color }}>Active</span>
            </div>
          </div>

          <div style={{ animation: 'fadeUp .3s ease both', flex: 1 }} key={activeAgent}>
            {renderAgent()}
          </div>
        </div>
      </div>

      {/* Bottom CTA */}
      <div style={{ background: '#0A0F2C', borderTop: '1px solid #1e2a45', padding: '16px 24px', textAlign: 'center' }}>
        <span style={{ color: '#64748b', fontSize: 14 }}>
          Ready for the real thing?{' '}
          <Link href="/signup" style={{ color: '#F97316', fontWeight: 700, textDecoration: 'none' }}>
            Start your 14-day free trial from R349/month →
          </Link>
        </span>
      </div>
    </div>
  )
}
