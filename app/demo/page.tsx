'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'

// ─── Fake tenant data ────────────────────────────────────────────────────────
const TENANT = 'Thabo Dlamini Attorneys'
const DATE = '28 April 2026'

const AGENTS = [
  { id: 'alex',    label: 'Alex',    role: 'Inbox',              icon: '💬' },
  { id: 'chase',   label: 'Chase',   role: 'Debt Recovery',      icon: '💰' },
  { id: 'care',    label: 'Care',    role: 'Staff Wellness',      icon: '💚' },
  { id: 'doc',     label: 'Doc',     role: 'Document Intel',      icon: '📄' },
  { id: 'insight', label: 'Insight', role: 'Analytics',           icon: '📊' },
  { id: 'pen',     label: 'Pen',     role: 'Content',             icon: '✍️' },
]

// ─── Alex — WhatsApp inbox ────────────────────────────────────────────────────
const ALEX_CONTACTS = [
  { name: 'Sipho Mthembu', time: '09:14', unread: 2, preview: 'Good morning, re: the lease agreement…' },
  { name: 'Fatima Mokoena', time: '08:52', unread: 1, preview: 'When will the contract be ready?' },
  { name: 'David van Rensburg', time: 'Yesterday', unread: 0, preview: 'Thanks for the update!' },
  { name: 'Nompumelelo Dube', time: 'Yesterday', unread: 0, preview: 'Invoice received, processing now.' },
]

const ALEX_SCRIPTED: Record<string, { from: string; text: string }[]> = {
  'Sipho Mthembu': [
    { from: 'sipho', text: 'Good morning. I wanted to follow up on the lease agreement review.' },
    { from: 'sipho', text: 'My tenant needs to sign by end of month.' },
    { from: 'alex',  text: "Hi Sipho 👋 Your lease agreement is ready for review. I've flagged 3 clauses that need your attention before signing. Shall I send you a summary?" },
  ],
  'Fatima Mokoena': [
    { from: 'fatima', text: 'Hi, when will my employment contract be ready?' },
    { from: 'alex',   text: "Hi Fatima! Your employment contract (EMP-2026-044) is 90% complete. Expected: tomorrow by 14:00. I'll notify you as soon as it's ready to sign. 📋" },
  ],
}

const ALEX_QUICKREPLIES = ['Confirm appointment', 'Request document', 'Check invoice status', 'Schedule callback']

const ALEX_AI_RESPONSES: Record<string, string> = {
  'confirm appointment': "✅ Appointment confirmed for Thursday 30 April at 10:00. I've sent a calendar invite and WhatsApp reminder to the client.",
  'request document':    "📎 Document request sent via WhatsApp to the client. They have 48 hours to upload. I'll notify you when received.",
  'check invoice status':"Invoice INV-2026-031 (R8,500) — OVERDUE by 12 days. I've already sent 2 automated reminders. Want me to escalate to a call?",
  'schedule callback':   "📅 Callback scheduled for 29 April at 15:00. Client has been notified via WhatsApp and email. Reminder set for 30 mins before.",
}

function AlexAgent() {
  const [activeContact, setActiveContact] = useState<string | null>(null)
  const [messages, setMessages] = useState<{ from: string; text: string }[]>([])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  function openChat(name: string) {
    setActiveContact(name)
    setMessages(ALEX_SCRIPTED[name] ?? [
      { from: 'client', text: 'Hi, I have a question about my case.' },
      { from: 'alex', text: "Hi there! 👋 I'm Alex, your AI inbox assistant for Thabo Dlamini Attorneys. How can I help you today?" },
    ])
    setInput('')
  }

  function sendMessage(text?: string) {
    const msg = (text ?? input).trim()
    if (!msg) return
    setMessages(prev => [...prev, { from: 'you', text: msg }])
    setInput('')
    setTyping(true)
    setTimeout(() => {
      const key = msg.toLowerCase()
      const reply = ALEX_AI_RESPONSES[key] ??
        `Got it! I've noted your message and will follow up with ${activeContact} shortly. Is there anything else you need?`
      setMessages(prev => [...prev, { from: 'alex', text: reply }])
      setTyping(false)
    }, 1200)
  }

  if (!activeContact) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e2a45', fontSize: 13, color: '#94a3b8' }}>
        4 active conversations
      </div>
      {ALEX_CONTACTS.map(c => (
        <button key={c.name} onClick={() => openChat(c.name)} style={{
          display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px',
          background: 'none', border: 'none', borderBottom: '1px solid #0f172a',
          cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s',
        }}
          onMouseEnter={e => (e.currentTarget.style.background = '#0f172a')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        >
          <div style={{
            width: 42, height: 42, borderRadius: '50%', background: '#1e3a5f',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, flexShrink: 0, position: 'relative',
          }}>
            {c.name[0]}
            {c.unread > 0 && (
              <span style={{
                position: 'absolute', top: -2, right: -2, background: '#F97316',
                color: '#fff', borderRadius: '50%', width: 18, height: 18,
                fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{c.unread}</span>
            )}
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
        <button onClick={() => setActiveContact(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 18, padding: 0 }}>←</button>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#1e3a5f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{activeContact[0]}</div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, color: '#f1f5f9' }}>{activeContact}</div>
          <div style={{ fontSize: 12, color: '#06B6D4' }}>● online</div>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.from === 'you' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '72%', padding: '9px 13px', borderRadius: m.from === 'you' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
              background: m.from === 'you' ? '#F97316' : m.from === 'alex' ? '#1e3a5f' : '#162032',
              color: '#f1f5f9', fontSize: 13, lineHeight: 1.5,
            }}>{m.text}</div>
          </div>
        ))}
        {typing && (
          <div style={{ display: 'flex', gap: 4, padding: '10px 14px', background: '#1e3a5f', borderRadius: '14px 14px 14px 4px', width: 'fit-content' }}>
            {[0, 1, 2].map(i => <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#06B6D4', animation: `tdot 1.2s ${i * 0.2}s infinite` }} />)}
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div style={{ padding: '8px 12px', borderTop: '1px solid #1e2a45' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {ALEX_QUICKREPLIES.map(r => (
            <button key={r} onClick={() => sendMessage(r)} style={{
              padding: '5px 10px', borderRadius: 20, border: '1px solid #1e3a5f',
              background: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 12,
              transition: 'all 0.15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#F97316'; e.currentTarget.style.color = '#F97316' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#1e3a5f'; e.currentTarget.style.color = '#94a3b8' }}
            >{r}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            placeholder="Type a message…"
            style={{
              flex: 1, background: '#0f172a', border: '1px solid #1e2a45', borderRadius: 24,
              padding: '9px 16px', color: '#f1f5f9', fontSize: 13, outline: 'none',
            }}
          />
          <button onClick={() => sendMessage()} style={{
            background: '#F97316', border: 'none', borderRadius: '50%', width: 38, height: 38,
            cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>→</button>
        </div>
      </div>
    </div>
  )
}

// ─── Chase — Debt Recovery ────────────────────────────────────────────────────
const CHASE_INVOICES = [
  { id: 'INV-031', client: 'Sipho Mthembu', amount: 'R 8,500', due: '2026-04-16', days: 12, status: 'overdue' },
  { id: 'INV-028', client: 'Fatima Mokoena', amount: 'R 15,000', due: '2026-04-10', days: 18, status: 'overdue' },
  { id: 'INV-034', client: 'City of Joburg', amount: 'R 42,000', due: '2026-04-25', days: 3, status: 'overdue' },
  { id: 'INV-035', client: 'Nexus Logistics', amount: 'R 6,200', due: '2026-05-05', days: 0, status: 'pending' },
]

function ChaseAgent() {
  const [sent, setSent] = useState<Record<string, string>>({})
  const [selected, setSelected] = useState<string[]>([])
  const [bulkResult, setBulkResult] = useState<string | null>(null)

  function sendReminder(inv: typeof CHASE_INVOICES[0]) {
    setSent(prev => ({ ...prev, [inv.id]: 'sending' }))
    setTimeout(() => {
      setSent(prev => ({ ...prev, [inv.id]: 'sent' }))
    }, 1000)
  }

  function sendBulk() {
    const targets = CHASE_INVOICES.filter(i => selected.includes(i.id))
    setBulkResult(`✅ Chase sent WhatsApp reminders to ${targets.length} clients: ${targets.map(t => t.client).join(', ')}. Total outstanding: ${targets.reduce((_, __) => 0, 0)} — average collection time after AI reminder: 3.2 days.`)
    setSelected([])
  }

  return (
    <div style={{ padding: '0 0 16px' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e2a45', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 13, color: '#94a3b8' }}>Outstanding balance</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#F97316' }}>R 71,700</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 13, color: '#94a3b8' }}>Avg collection (AI)</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#06B6D4' }}>3.2 days</div>
        </div>
      </div>

      {selected.length > 0 && (
        <div style={{ margin: '12px 20px', padding: '10px 14px', background: '#1a2540', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: '#94a3b8' }}>{selected.length} invoice(s) selected</span>
          <button onClick={sendBulk} style={{
            background: '#F97316', border: 'none', borderRadius: 6, padding: '7px 14px',
            color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer',
          }}>Send bulk reminders</button>
        </div>
      )}

      {bulkResult && (
        <div style={{ margin: '0 20px 12px', padding: '12px 14px', background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.3)', borderRadius: 8, fontSize: 13, color: '#06B6D4', lineHeight: 1.5 }}>
          {bulkResult}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {CHASE_INVOICES.map(inv => (
          <div key={inv.id} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px',
            borderBottom: '1px solid #0f172a',
          }}>
            <input type="checkbox" checked={selected.includes(inv.id)}
              onChange={e => setSelected(p => e.target.checked ? [...p, inv.id] : p.filter(x => x !== inv.id))}
              style={{ accentColor: '#F97316', width: 16, height: 16, cursor: 'pointer' }}
            />
            <div style={{ flex: 1 }}>
              <div className="demo-chase-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontWeight: 600, color: '#f1f5f9', fontSize: 14 }}>{inv.client}</span>
                <span style={{ fontWeight: 700, color: inv.status === 'overdue' ? '#F97316' : '#94a3b8', fontSize: 14 }}>{inv.amount}</span>
              </div>
              <div className="demo-chase-meta" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: '#64748b' }}>{inv.id} · Due {inv.due}</span>
                {inv.status === 'overdue'
                  ? <span style={{ fontSize: 12, color: '#ef4444' }}>⚠ {inv.days} days overdue</span>
                  : <span style={{ fontSize: 12, color: '#94a3b8' }}>Upcoming</span>
                }
              </div>
            </div>
            {inv.status === 'overdue' && (
              <button onClick={() => sendReminder(inv)} disabled={!!sent[inv.id]} style={{
                padding: '6px 12px', borderRadius: 6, border: 'none', cursor: sent[inv.id] ? 'default' : 'pointer',
                background: sent[inv.id] === 'sent' ? 'rgba(6,182,212,0.2)' : sent[inv.id] === 'sending' ? '#1e2a45' : '#F97316',
                color: sent[inv.id] === 'sent' ? '#06B6D4' : '#fff', fontSize: 12, fontWeight: 600,
                transition: 'all 0.3s', whiteSpace: 'nowrap',
              }}>
                {sent[inv.id] === 'sent' ? '✓ Sent' : sent[inv.id] === 'sending' ? '…' : 'Remind'}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Care — Staff Wellness ────────────────────────────────────────────────────
const CARE_STAFF = [
  { name: 'Thandi Dlamini',   role: 'Paralegal',     score: 82, trend: '↑', last: '2 hrs ago', flag: false },
  { name: 'Bongani Nkosi',    role: 'Senior Attorney', score: 61, trend: '↓', last: '1 day ago', flag: true  },
  { name: 'Priya Naidoo',     role: 'Conveyancing',  score: 90, trend: '→', last: '3 hrs ago', flag: false },
  { name: 'Lebo Sithole',     role: 'Admin',         score: 54, trend: '↓', last: '2 days ago', flag: true  },
]

const CARE_RESPONSES = [
  "💚 Wellness check sent to all 4 staff via WhatsApp. Bongani and Lebo have been flagged — anonymous support resources shared. I'll follow up in 48 hours.",
  "📋 Anonymous pulse survey deployed. Average response time: 4.2 minutes. Results will be aggregated and anonymised before sharing with management.",
  "🌿 Stress resources sent to flagged staff: SA EAP helpline (0800 131 333), breathing exercise link, and a 1:1 scheduling invite. No names shared with management.",
]

function CareAgent() {
  const [checkResult, setCheckResult] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [responseIdx, setResponseIdx] = useState(0)

  function sendCheck() {
    setLoading(true)
    setTimeout(() => {
      setCheckResult(CARE_RESPONSES[responseIdx % CARE_RESPONSES.length])
      setResponseIdx(i => i + 1)
      setLoading(false)
    }, 1400)
  }

  function scoreColor(n: number) {
    if (n >= 80) return '#22c55e'
    if (n >= 65) return '#F97316'
    return '#ef4444'
  }

  return (
    <div>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e2a45', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 13, color: '#94a3b8' }}>Team wellness score</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#22c55e' }}>71.75 <span style={{ fontSize: 14, color: '#64748b', fontWeight: 400 }}>/ 100</span></div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12, color: '#ef4444', fontWeight: 600 }}>2 staff flagged</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>Needs attention</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {CARE_STAFF.map(s => (
          <div key={s.name} style={{
            display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px',
            borderBottom: '1px solid #0f172a',
            background: s.flag ? 'rgba(239,68,68,0.04)' : 'none',
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%', background: '#1e3a5f',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0,
            }}>{s.name[0]}</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 600, color: '#f1f5f9', fontSize: 14 }}>{s.name}</span>
                {s.flag && <span style={{ fontSize: 11, color: '#ef4444', background: 'rgba(239,68,68,0.15)', padding: '2px 8px', borderRadius: 20 }}>Needs support</span>}
              </div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{s.role} · {s.last}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: scoreColor(s.score) }}>{s.score}</div>
              <div style={{ fontSize: 12, color: s.trend === '↑' ? '#22c55e' : s.trend === '↓' ? '#ef4444' : '#94a3b8' }}>{s.trend}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ padding: '16px 20px' }}>
        {checkResult && (
          <div style={{ marginBottom: 12, padding: '12px 14px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 8, fontSize: 13, color: '#86efac', lineHeight: 1.6 }}>
            {checkResult}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={sendCheck} disabled={loading} style={{
            background: '#22c55e', border: 'none', borderRadius: 8, padding: '10px 18px',
            color: '#fff', fontWeight: 600, fontSize: 13, cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1,
          }}>{loading ? 'Sending…' : '💚 Send wellness check'}</button>
          <button onClick={sendCheck} disabled={loading} style={{
            background: 'none', border: '1px solid #1e3a5f', borderRadius: 8, padding: '10px 18px',
            color: '#94a3b8', fontWeight: 600, fontSize: 13, cursor: loading ? 'wait' : 'pointer',
          }}>{loading ? '…' : '📋 Deploy pulse survey'}</button>
        </div>
      </div>
    </div>
  )
}

// ─── Doc — Document Intelligence ─────────────────────────────────────────────
const DOC_FAKE_RESULT = {
  title: 'Employment Contract — Priya Naidoo',
  type: 'Employment Agreement',
  parties: ['Thabo Dlamini Attorneys (Employer)', 'Priya Naidoo (Employee)'],
  date: '1 May 2026',
  clauses: [
    { label: 'Probation',        value: '3 months',        flag: false },
    { label: 'Notice period',    value: '4 weeks',          flag: false },
    { label: 'Non-compete',      value: '24 months — ⚠ long', flag: true },
    { label: 'IP Assignment',    value: 'All work product', flag: false },
    { label: 'Governing law',    value: 'South Africa',     flag: false },
  ],
  risk: 'Medium',
  riskDetail: 'Non-compete clause (24 months) may be unenforceable under SA labour law. Recommend reducing to 12 months.',
}

function DocAgent() {
  const [phase, setPhase] = useState<'idle' | 'scanning' | 'done'>('idle')
  const [progress, setProgress] = useState(0)

  function scan() {
    setPhase('scanning')
    setProgress(0)
    const iv = setInterval(() => {
      setProgress(p => {
        if (p >= 100) { clearInterval(iv); setPhase('done'); return 100 }
        return p + 8
      })
    }, 100)
  }

  return (
    <div style={{ padding: '16px 20px' }}>
      {phase === 'idle' && (
        <div>
          <div style={{
            border: '2px dashed #1e3a5f', borderRadius: 12, padding: '40px 20px',
            textAlign: 'center', cursor: 'pointer', transition: 'border-color 0.2s',
          }}
            onClick={scan}
            onMouseEnter={e => (e.currentTarget.style.borderColor = '#F97316')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = '#1e3a5f')}
          >
            <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
            <div style={{ fontWeight: 600, color: '#f1f5f9', marginBottom: 6 }}>employment_contract_priya.pdf</div>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>128 KB · PDF · Ready to scan</div>
            <button onClick={scan} style={{
              background: '#F97316', border: 'none', borderRadius: 8, padding: '10px 24px',
              color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer',
            }}>Scan with Doc AI →</button>
          </div>
          <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
            {['NDA', 'Lease', 'Invoice', 'Will'].map(t => (
              <div key={t} onClick={scan} style={{
                padding: '8px 14px', border: '1px solid #1e2a45', borderRadius: 8,
                fontSize: 12, color: '#64748b', cursor: 'pointer', transition: 'all 0.15s',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#F97316'; e.currentTarget.style.color = '#F97316' }}
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
            <div style={{ height: '100%', background: 'linear-gradient(90deg,#F97316,#06B6D4)', borderRadius: 99, width: `${progress}%`, transition: 'width 0.1s' }} />
          </div>
          <div style={{ marginTop: 12, fontSize: 13, color: '#64748b' }}>Extracting clauses, parties, dates, risk flags…</div>
        </div>
      )}

      {phase === 'done' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#f1f5f9' }}>{DOC_FAKE_RESULT.title}</div>
              <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>{DOC_FAKE_RESULT.type} · Signed {DOC_FAKE_RESULT.date}</div>
            </div>
            <span style={{
              padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700,
              background: DOC_FAKE_RESULT.risk === 'Medium' ? 'rgba(249,115,22,0.15)' : 'rgba(239,68,68,0.15)',
              color: DOC_FAKE_RESULT.risk === 'Medium' ? '#F97316' : '#ef4444',
            }}>{DOC_FAKE_RESULT.risk} risk</span>
          </div>

          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Parties</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {DOC_FAKE_RESULT.parties.map(p => (
              <span key={p} style={{ padding: '5px 12px', background: '#1e3a5f', borderRadius: 20, fontSize: 13, color: '#94a3b8' }}>{p}</span>
            ))}
          </div>

          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Key clauses</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
            {DOC_FAKE_RESULT.clauses.map(c => (
              <div key={c.label} style={{
                display: 'flex', justifyContent: 'space-between', padding: '9px 14px',
                background: c.flag ? 'rgba(249,115,22,0.06)' : '#0f172a', borderRadius: 8,
                border: c.flag ? '1px solid rgba(249,115,22,0.3)' : '1px solid transparent',
              }}>
                <span style={{ fontSize: 13, color: '#94a3b8' }}>{c.label}</span>
                <span style={{ fontSize: 13, color: c.flag ? '#F97316' : '#f1f5f9', fontWeight: c.flag ? 600 : 400 }}>{c.value}</span>
              </div>
            ))}
          </div>

          <div style={{ padding: '12px 14px', background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.25)', borderRadius: 8, fontSize: 13, color: '#fbbf24', lineHeight: 1.5 }}>
            ⚠ {DOC_FAKE_RESULT.riskDetail}
          </div>

          <button onClick={() => setPhase('idle')} style={{
            marginTop: 16, background: 'none', border: '1px solid #1e3a5f', borderRadius: 8,
            padding: '8px 16px', color: '#64748b', cursor: 'pointer', fontSize: 13,
          }}>← Scan another document</button>
        </div>
      )}
    </div>
  )
}

// ─── Insight — Analytics ──────────────────────────────────────────────────────
const INSIGHT_METRICS = [
  { label: 'Revenue MTD',        value: 'R 127,400', change: '+18%', up: true },
  { label: 'Invoices collected', value: '23 / 31',   change: '74%',  up: true },
  { label: 'Avg response time',  value: '4.2 min',   change: '-31%', up: true },
  { label: 'Staff wellness',     value: '71.75',     change: '-4pt', up: false },
]

const INSIGHT_BRIEFS = [
  `Good morning, ${TENANT}. Here's your daily brief for ${DATE}:\n\n💰 Revenue is tracking R 127,400 for April — 18% above target. Key driver: Chase recovered 3 overdue accounts worth R 65,500 this week.\n\n⚠️ Bongani Nkosi's wellness score dropped 12 points — recommend a private check-in today.\n\n📅 4 contract deadlines this week: Sipho Mthembu (lease review) due Friday is the highest priority.\n\n🔥 Action today: Approve INV-034 (City of Joburg, R 42,000) before the 10:00 deadline.`,
  `Afternoon snapshot for ${DATE}:\n\n📞 Alex handled 12 WhatsApp messages while you were in court — 9 resolved automatically, 3 awaiting your reply.\n\n📄 Doc scanned 4 contracts today. 1 flagged: employment agreement non-compete clause (24 months) likely unenforceable — review before Friday signing.\n\n💡 Insight: Clients who receive WhatsApp reminders pay 4.8× faster than email-only clients. Chase has saved your practice an estimated R 18,000 in collection costs this month.`,
]

function InsightAgent() {
  const [brief, setBrief] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [briefIdx, setBriefIdx] = useState(0)

  function generateBrief() {
    setLoading(true)
    setBrief(null)
    setTimeout(() => {
      setBrief(INSIGHT_BRIEFS[briefIdx % INSIGHT_BRIEFS.length])
      setBriefIdx(i => i + 1)
      setLoading(false)
    }, 1600)
  }

  const BAR_DATA = [
    { label: 'Mon', h: 55, color: '#F97316' },
    { label: 'Tue', h: 80, color: '#F97316' },
    { label: 'Wed', h: 65, color: '#F97316' },
    { label: 'Thu', h: 90, color: '#06B6D4' },
    { label: 'Fri', h: 45, color: '#F97316' },
  ]

  return (
    <div style={{ padding: '0 0 16px' }}>
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
          {BAR_DATA.map(b => (
            <div key={b.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: '100%', height: `${b.h}%`, borderRadius: '4px 4px 0 0',
                background: b.color, opacity: 0.85,
              }} />
              <span style={{ fontSize: 11, color: '#64748b' }}>{b.label}</span>
            </div>
          ))}
        </div>

        <button onClick={generateBrief} disabled={loading} style={{
          background: 'linear-gradient(135deg, #F97316, #ea580c)', border: 'none', borderRadius: 8,
          padding: '11px 20px', color: '#fff', fontWeight: 700, fontSize: 14,
          cursor: loading ? 'wait' : 'pointer', width: '100%', opacity: loading ? 0.7 : 1,
        }}>{loading ? '🧠 Generating brief…' : '🧠 Generate daily AI brief'}</button>

        {brief && (
          <div style={{
            marginTop: 14, padding: '14px 16px', background: '#0f172a',
            border: '1px solid #1e2a45', borderRadius: 10, fontSize: 13,
            color: '#cbd5e1', lineHeight: 1.7, whiteSpace: 'pre-line',
          }}>{brief}</div>
        )}
      </div>
    </div>
  )
}

// ─── Pen — Content Agent ──────────────────────────────────────────────────────
const PEN_TEMPLATES = [
  { id: 'whatsapp', label: '💬 WhatsApp broadcast' },
  { id: 'linkedin', label: '💼 LinkedIn post' },
  { id: 'invoice',  label: '📧 Invoice email' },
  { id: 'reminder', label: '🔔 Payment reminder' },
  { id: 'proposal', label: '📋 Service proposal' },
]

const PEN_SCRIPTED: Record<string, (topic: string) => string> = {
  whatsapp: (t) => `Hi [Client Name] 👋\n\n${t ? `Re: ${t}\n\n` : ''}Thabo Dlamini Attorneys is ready to assist you with professional, affordable legal services.\n\n✅ Fast turnaround\n✅ POPI compliant\n✅ 15+ years experience\n\nReply YES to schedule a free 20-minute consultation.\n\n— Thabo Dlamini Attorneys\n📞 011 234 5678`,
  linkedin: (t) => `🏛️ Why South African SMEs can't afford to skip legal advice in 2026\n\n${t || 'Contracts protect your business. Without them, a single dispute can cost more than a year of legal fees.'}\n\nAt Thabo Dlamini Attorneys, we've seen it too many times:\n→ Verbal agreements gone wrong\n→ Lease clauses that favour landlords\n→ Employee disputes without documentation\n\nWe now offer affordable retainer packages starting at R1,800/month.\n\nDM me or visit thabodlamini.co.za\n\n#LegalAdvice #SouthAfrica #SME #BusinessLaw #ThaboDlaminiAttorneys`,
  invoice:  (t) => `Subject: Invoice ${t || 'INV-2026-035'} — Thabo Dlamini Attorneys\n\nDear [Client Name],\n\nPlease find attached invoice ${t || 'INV-2026-035'} for professional legal services rendered.\n\n📋 Amount due: R [AMOUNT]\n📅 Payment due: 30 days from invoice date\n🏦 FNB: Account 62345678901 (Branch 250655)\n\nKindly use your invoice number as reference.\n\nQueries? Reply to this email or WhatsApp +27 82 123 4567.\n\nThank you for your business.\n\nWarm regards,\nThabo Dlamini\nThabo Dlamini Attorneys`,
  reminder: (t) => `Hi [Client Name] 🔔\n\nThis is a friendly reminder that invoice ${t || 'INV-2026-031'} (R 8,500) was due on 16 April.\n\nWe know things get busy — please arrange payment within 48 hours to avoid further action.\n\n💳 Payment options:\n→ EFT: FNB 62345678901\n→ PayFast: thabodlamini.co.za/pay\n\nAlready paid? Please send proof to accounts@thabodlamini.co.za\n\nThank you 🙏`,
  proposal: (t) => `SERVICE PROPOSAL\nThabo Dlamini Attorneys\n\nPrepared for: ${t || '[Prospective Client]'}\nDate: ${DATE}\n\n─────────────────────────────\nSCOPE OF SERVICES\n─────────────────────────────\n✓ Commercial contract drafting & review\n✓ Employment law compliance\n✓ Property law & conveyancing\n✓ Dispute resolution & mediation\n\n─────────────────────────────\nPRICING\n─────────────────────────────\nRetainer (10 hrs/mo): R 4,500/month\nAd hoc rate: R 850/hour\nDocument review: R 350/document\n\n─────────────────────────────\nNEXT STEPS\n─────────────────────────────\nSign & return by: 5 May 2026\nKick-off call: 7 May 2026\n\nQuestions? 011 234 5678`,
}

function PenAgent() {
  const [template, setTemplate] = useState('whatsapp')
  const [topic, setTopic] = useState('')
  const [output, setOutput] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  function generate() {
    setLoading(true)
    setOutput(null)
    setCopied(false)
    setTimeout(() => {
      setOutput(PEN_SCRIPTED[template]?.(topic) ?? '')
      setLoading(false)
    }, 1000)
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
            <button key={t.id} onClick={() => setTemplate(t.id)} style={{
              padding: '7px 13px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12,
              background: template === t.id ? '#F97316' : '#1e2a45',
              color: template === t.id ? '#fff' : '#94a3b8',
              transition: 'all 0.2s',
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Topic / reference (optional)</div>
        <input value={topic} onChange={e => setTopic(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && generate()}
          placeholder={template === 'invoice' ? 'Invoice number, e.g. INV-035' : template === 'proposal' ? 'Client name' : 'Topic or context…'}
          style={{
            width: '100%', background: '#0f172a', border: '1px solid #1e2a45', borderRadius: 8,
            padding: '10px 14px', color: '#f1f5f9', fontSize: 13, outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>

      <button onClick={generate} disabled={loading} style={{
        background: 'linear-gradient(135deg, #F97316, #ea580c)', border: 'none', borderRadius: 8,
        padding: '11px', color: '#fff', fontWeight: 700, fontSize: 14,
        cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1,
      }}>{loading ? '✍️ Pen is writing…' : '✍️ Generate content'}</button>

      {output && (
        <div style={{ position: 'relative' }}>
          <pre style={{
            background: '#0f172a', border: '1px solid #1e2a45', borderRadius: 10,
            padding: '14px', fontSize: 13, color: '#cbd5e1', lineHeight: 1.7,
            whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0, fontFamily: 'inherit',
          }}>{output}</pre>
          <button onClick={copy} style={{
            position: 'absolute', top: 10, right: 10, background: copied ? '#22c55e' : '#1e3a5f',
            border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 12,
            color: '#fff', cursor: 'pointer', transition: 'background 0.3s',
          }}>{copied ? '✓ Copied' : 'Copy'}</button>
        </div>
      )}
    </div>
  )
}

// ─── Main Demo page ───────────────────────────────────────────────────────────
export default function DemoPage() {
  const [activeAgent, setActiveAgent] = useState('alex')

  const renderAgent = () => {
    switch (activeAgent) {
      case 'alex':    return <AlexAgent />
      case 'chase':   return <ChaseAgent />
      case 'care':    return <CareAgent />
      case 'doc':     return <DocAgent />
      case 'insight': return <InsightAgent />
      case 'pen':     return <PenAgent />
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
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #0f172a; }
        ::-webkit-scrollbar-thumb { background: #1e3a5f; border-radius: 2px; }
        @media (max-width: 640px) {
          .demo-shell { flex-direction: column !important; height: auto !important; min-height: 0 !important; flex: 1; }
          .demo-sidebar { flex-direction: row !important; width: 100% !important; overflow-x: auto; border-right: none !important; border-bottom: 1px solid #1e2a45 !important; padding: 8px !important; gap: 4px !important; }
          .demo-sidebar-label { display: none !important; }
          .demo-agent-btn { flex-direction: row !important; gap: 8px !important; padding: 8px 12px !important; min-width: max-content; border-radius: 20px !important; }
          .demo-agent-btn span:last-child { display: none; }
          .demo-sidebar-footer { display: none !important; }
          .demo-banner { padding: 8px 12px !important; }
          .demo-banner-text { display: none; }
          .demo-content { flex: 1; min-height: 0; }
          .demo-page { display: flex; flex-direction: column; height: 100dvh; }
          .demo-header { padding: 12px 16px !important; }
          .demo-header-date { display: none; }
          .demo-header-right { display: none !important; }
          .demo-bottom-cta { padding: 10px 16px !important; }
          .demo-chase-row { flex-wrap: wrap; gap: 6px !important; }
          .demo-chase-meta { flex-direction: column !important; gap: 2px !important; }
        }
      `}</style>

      {/* Top demo banner */}
      <div className="demo-banner" style={{
        background: 'linear-gradient(90deg, rgba(249,115,22,0.15), rgba(6,182,212,0.1))',
        borderBottom: '1px solid rgba(249,115,22,0.3)',
        padding: '12px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{
            background: '#F97316', color: '#fff', fontSize: 11, fontWeight: 800,
            padding: '3px 10px', borderRadius: 20, letterSpacing: 1.5,
          }}>DEMO MODE</span>
          <span className="demo-banner-text" style={{ color: '#94a3b8', fontSize: 13 }}>
            You're viewing <strong style={{ color: '#f1f5f9' }}>Thabo Dlamini Attorneys</strong> — fake data, no real API calls
          </span>
        </div>
        <Link href="/#pricing" style={{
          background: '#F97316', color: '#fff', textDecoration: 'none',
          padding: '8px 18px', borderRadius: 8, fontWeight: 700, fontSize: 13,
          whiteSpace: 'nowrap',
        }}>Get AdminOS — from R2,500/mo →</Link>
      </div>

      {/* Header */}
      <div className="demo-header" style={{
        padding: '20px 24px', borderBottom: '1px solid #1e2a45',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: '#0A0F2C',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: 'linear-gradient(135deg, #F97316, #ea580c)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 900, fontSize: 16, color: '#fff',
          }}>A</div>
          <div>
            <div style={{ fontWeight: 700, color: '#f1f5f9', fontSize: 15 }}>{TENANT}</div>
            <div className="demo-header-date" style={{ fontSize: 12, color: '#64748b' }}>AdminOS Demo · {DATE}</div>
          </div>
        </div>
        <div className="demo-header-right" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }} />
          <span style={{ fontSize: 12, color: '#22c55e' }}>6 agents active</span>
        </div>
      </div>

      {/* Shell */}
      <div className="demo-shell" style={{
        display: 'flex', flex: 1, height: 'calc(100vh - 130px)', minHeight: 500, overflow: 'hidden',
      }}>
        {/* Sidebar */}
        <div className="demo-sidebar" style={{
          width: 200, flexShrink: 0, background: '#0A0F2C',
          borderRight: '1px solid #1e2a45', padding: '16px 8px',
          display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto',
        }}>
          <div className="demo-sidebar-label" style={{ fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: 1.2, padding: '4px 12px 8px', fontWeight: 600 }}>
            AI Agents
          </div>
          {AGENTS.map(a => (
            <button key={a.id} className="demo-agent-btn" onClick={() => setActiveAgent(a.id)} style={{
              display: 'flex', flexDirection: 'column', gap: 2,
              padding: '10px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', textAlign: 'left',
              background: activeAgent === a.id ? 'rgba(249,115,22,0.12)' : 'none',
              transition: 'background 0.15s',
            }}
              onMouseEnter={e => { if (activeAgent !== a.id) e.currentTarget.style.background = '#0f172a' }}
              onMouseLeave={e => { if (activeAgent !== a.id) e.currentTarget.style.background = 'none' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18 }}>{a.icon}</span>
                <span style={{
                  fontWeight: 600, fontSize: 14,
                  color: activeAgent === a.id ? '#F97316' : '#f1f5f9',
                }}>{a.label}</span>
              </div>
              <span style={{ fontSize: 12, color: '#475569', paddingLeft: 26 }}>{a.role}</span>
            </button>
          ))}

          <div className="demo-sidebar-footer" style={{ marginTop: 'auto', padding: '16px 12px 0', borderTop: '1px solid #1e2a45' }}>
            <Link href="/#pricing" style={{
              display: 'block', background: '#F97316', borderRadius: 8,
              padding: '10px 12px', color: '#fff', textDecoration: 'none',
              fontWeight: 700, fontSize: 13, textAlign: 'center',
            }}>Get started →</Link>
            <Link href="/" style={{
              display: 'block', marginTop: 8, color: '#475569', textDecoration: 'none',
              fontSize: 12, textAlign: 'center',
            }}>← Back to site</Link>
          </div>
        </div>

        {/* Agent panel */}
        <div className="demo-content" style={{ flex: 1, overflowY: 'auto', background: '#050B1A' }}>
          <div style={{
            padding: '14px 20px', borderBottom: '1px solid #1e2a45',
            background: '#0A0F2C', display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 22 }}>{AGENTS.find(a => a.id === activeAgent)?.icon}</span>
            <div>
              <div style={{ fontWeight: 700, color: '#f1f5f9', fontSize: 15 }}>
                {AGENTS.find(a => a.id === activeAgent)?.label}
              </div>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                {AGENTS.find(a => a.id === activeAgent)?.role} Agent · Live
              </div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', animation: 'tdot 2s infinite' }} />
              <span style={{ fontSize: 12, color: '#22c55e' }}>Active</span>
            </div>
          </div>

          <div style={{ animation: 'fadeUp 0.3s ease both' }} key={activeAgent}>
            {renderAgent()}
          </div>
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="demo-bottom-cta" style={{
        background: '#0A0F2C', borderTop: '1px solid #1e2a45',
        padding: '20px 24px', textAlign: 'center',
      }}>
        <span style={{ color: '#64748b', fontSize: 14 }}>
          Ready for the real thing?{' '}
          <Link href="/#pricing" style={{ color: '#F97316', fontWeight: 700, textDecoration: 'none' }}>
            Start your 14-day free trial →
          </Link>
        </span>
      </div>
    </div>
  )
}
