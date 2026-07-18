import Link from 'next/link'
import type { Metadata } from 'next'
import MobileNav from '@/components/MobileNav'

export const metadata: Metadata = {
  title: 'AdminOS — The Business OS Built for South Africa',
  description:
    'AdminOS is the complete business operating system for South African SMEs — AI agents, Employee OS, Business Academy, Payroll, Compliance, Operations and more. From R349/month.',
  alternates: { canonical: 'https://adminos.co.za' },
}

// ─── Data ────────────────────────────────────────────────────────────────────

const replacements = [
  { tool: 'WhatsApp Business Manager',  cost: 'R1,200', agent: 'Alex · Inbox Agent' },
  { tool: 'Debt collection service',    cost: 'R2,500', agent: 'Chase · Debt Recovery' },
  { tool: 'HR & wellness software',     cost: 'R800',   agent: 'Care · Wellness Agent' },
  { tool: 'Payroll bureau fees',        cost: 'R1,800', agent: 'Payroll Module (built-in)' },
  { tool: 'Business analyst / reports', cost: 'R4,000', agent: 'Insight · Daily Brief' },
  { tool: 'Document processing',        cost: 'R1,200', agent: 'Doc · Document AI' },
  { tool: 'Copywriter / social media',  cost: 'R3,500', agent: 'Pen · Content Agent' },
]

const addons = [
  {
    icon: '💰',
    name: 'Payroll Module',
    tag: 'PAYE / UIF / SDL',
    tagColor: '#a78bfa',
    tagBg: 'rgba(139,92,246,.1)',
    tagBorder: 'rgba(139,92,246,.25)',
    cardBg: 'rgba(139,92,246,.05)',
    cardBorder: 'rgba(139,92,246,.18)',
    desc: 'Run payroll in one place — AdminOS works out PAYE, UIF and SDL from the SARS rates you confirm, you check the figures, and payslips go to staff on WhatsApp. Monthly EMP201 summary for you to file.',
    bullets: ['PAYE / UIF / SDL worked out from rates you confirm', 'WhatsApp payslip delivery', 'EMP201 summary to file yourself', 'Every run kept on record'],
    price: 'R299/mo',
  },
  {
    icon: '📱',
    name: 'Social Inbox',
    tag: 'Unified Channels',
    tagColor: '#34d399',
    tagBg: 'rgba(52,211,153,.1)',
    tagBorder: 'rgba(52,211,153,.25)',
    cardBg: 'rgba(52,211,153,.04)',
    cardBorder: 'rgba(52,211,153,.18)',
    desc: 'Manage Facebook, Instagram, and Google Reviews alongside WhatsApp in one inbox. AI drafts replies, detects sentiment, and flags urgent messages for human review.',
    bullets: ['Facebook + Instagram messages', 'Google Reviews management', 'AI-drafted replies', 'Unified sentiment view'],
    price: 'R249/mo',
  },
  {
    icon: '📅',
    name: 'Booking Engine',
    tag: 'Online Appointments',
    tagColor: '#06B6D4',
    tagBg: 'rgba(6,182,212,.1)',
    tagBorder: 'rgba(6,182,212,.25)',
    cardBg: 'rgba(6,182,212,.04)',
    cardBorder: 'rgba(6,182,212,.18)',
    desc: 'Embeddable online booking widget for your website. Clients self-book appointments; AdminOS sends WhatsApp confirmations, reminders, and follow-ups automatically.',
    bullets: ['Embeddable on any website', 'WhatsApp confirmations + reminders', 'Staff calendar sync', 'No-show follow-up automation'],
    price: 'R199/mo',
  },
  {
    icon: '✍️',
    name: 'eSignature',
    tag: 'Signatures',
    tagColor: '#F97316',
    tagBg: 'rgba(249,115,22,.1)',
    tagBorder: 'rgba(249,115,22,.25)',
    cardBg: 'rgba(249,115,22,.05)',
    cardBorder: 'rgba(249,115,22,.18)',
    desc: 'Send contracts, proposals and employment agreements for signature, and keep every signed copy with a full audit trail of who signed what, and when.',
    bullets: ['Sign via link (no account needed)', 'Audit trail on every signature', 'Auto-archive to document store', 'Built around the ECT Act'],
    price: 'R149/mo',
  },
]

const pricingPlans = [
  {
    name: 'Solo',
    price: 'R349',
    sub: '1 person · 100 conversations/mo',
    features: ['1 WhatsApp number', '100 AI conversations/month', 'Inbox + Debt Recovery agents', 'Daily business brief', 'POPIA compliance centre', 'Email support'],
    highlight: false,
    cta: 'Start free trial',
    href: '/signup',
  },
  {
    name: 'Grow',
    price: 'R899',
    sub: 'Up to 5 staff · 500 conversations/mo',
    badge: 'MOST POPULAR',
    features: ['1 WhatsApp number', '500 AI conversations/month', 'All 6 AI agents', 'Employee OS (clock-in, shifts, leave)', 'Business Academy access', 'Document intelligence', 'Priority support'],
    highlight: true,
    cta: 'Start free trial',
    href: '/signup',
  },
  {
    name: 'Operate',
    price: 'R1,999',
    sub: 'Up to 20 staff · 2,000 conversations/mo',
    features: ['2 WhatsApp numbers', '2,000 AI conversations/month', 'Full operations suite (tasks, SOPs, inventory)', 'Payroll + PAYE/UIF/SDL', 'Compliance calendar', 'Business health score + daily brief', 'Dedicated support'],
    highlight: false,
    cta: 'Start free trial',
    href: '/signup',
  },
  {
    name: 'Scale',
    price: 'R3,999',
    sub: 'Up to 100 staff · Unlimited conversations',
    features: ['3 WhatsApp numbers', 'Unlimited AI conversations', 'Business valuation engine', 'Exit readiness score', 'Multi-location branches', 'Board pack generation', 'SLA guarantee'],
    highlight: false,
    cta: 'Book a demo',
    href: 'https://cal.com/nanda/adminos-demo',
  },
]

const faqs = [
  { q: "We already use WhatsApp Business. Why do we need AdminOS?", a: "WhatsApp Business is a messaging tool. AdminOS adds 6 AI agents that respond, recover debt, check in on staff, process documents, brief you every morning, and generate content — automatically. It uses WhatsApp as the channel, not the tool." },
  { q: "We're not a tech company. Is this hard to set up?", a: "Our 15-minute onboarding wizard walks you through everything. No coding. No IT support needed. Most businesses are live within the same day." },
  { q: "What happens to our data?", a: "Your data stays yours. We comply with POPIA. You can export everything at any time. We use bank-grade encryption and row-level security on all business communications." },
  { q: "Does it integrate with our existing accounting software?", a: "AdminOS includes a built-in payroll engine (PAYE/UIF/SDL) and cash flow forecasting. Xero sync is on the integrations roadmap. You can also export payroll runs and financial summaries in standard formats." },
  { q: "Is there a lock-in contract?", a: "No lock-in contracts. Monthly billing, cancel anytime. Scale and Partner clients can negotiate annual contracts at a 15% discount." },
  { q: "How does load-shedding affect AdminOS?", a: "AdminOS is a PWA with offline capability. Queued actions retry automatically when connectivity returns. Your WhatsApp bot stays live on Meta's infrastructure (WhatsApp Cloud API) even during outages." },
]

const stats = [
  { value: '< 3s',   label: 'WhatsApp response time' },
  { value: 'R349',   label: 'Starting price per month' },
  { value: '15 min', label: 'Time to go live' },
  { value: '11',     label: 'SA languages supported' },
  { value: '6',      label: 'Core AI agents included' },
  { value: '95+',    label: 'Platform features & automations' },
]

const industries = [
  '⚖️ Legal Firms', '🏥 Clinics', '🏫 Schools', '🏢 NGOs',
  '🛍️ Retail', '🏗️ Property', '🚚 Logistics', '🔧 Trades',
  '🏦 Financial Services', '🎓 Training Providers', '💊 Pharmacies', '🏠 Estate Agents',
]

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'AdminOS',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web, Android, iOS',
  url: 'https://adminos.co.za',
  description: 'Complete business operating system for South African SMEs — 6 AI agents, Employee OS, Business Academy, Payroll, Compliance, Operations, and Community features. From R349/month.',
  author: { '@type': 'Organization', name: 'Mirembe Muse (Pty) Ltd', url: 'https://adminos.co.za' },
  offers: { '@type': 'AggregateOffer', priceCurrency: 'ZAR', lowPrice: '349', highPrice: '9999', offerCount: '5' },
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <style>{`
        /* ── Palette ── */
        :root {
          --black: #050B1A;
          --navy:  #0A0F2C;
          --navy2: #0D1535;
          --orange: #F97316;
          --orange-dim: rgba(249,115,22,0.15);
          --orange-border: rgba(249,115,22,0.25);
          --teal: #06B6D4;
          --teal-dim: rgba(6,182,212,0.12);
          --teal-border: rgba(6,182,212,0.25);
          --white: #FFFFFF;
          --dim: rgba(255,255,255,0.5);
          --dimmer: rgba(255,255,255,0.28);
          --dimmest: rgba(255,255,255,0.1);
        }

        /* ── Keyframes ── */
        @keyframes fadeUp   { from { opacity:0; transform:translateY(32px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeIn   { from { opacity:0; } to { opacity:1; } }
        @keyframes slideRight { from { opacity:0; transform:translateX(56px); } to { opacity:1; transform:translateX(0); } }
        @keyframes float    { 0%,100% { transform:translateY(0) rotate(0deg); } 50% { transform:translateY(-12px) rotate(.8deg); } }
        @keyframes orb1     { 0%,100%{transform:translate(0,0) scale(1)} 40%{transform:translate(30px,-24px) scale(1.12)} 70%{transform:translate(-18px,18px) scale(.9)} }
        @keyframes orb2     { 0%,100%{transform:translate(0,0)} 35%{transform:translate(-28px,20px)} 65%{transform:translate(22px,-15px)} }
        @keyframes pulse    { 0%,100%{opacity:.5;transform:scale(1)} 50%{opacity:1;transform:scale(1.2)} }
        @keyframes scanLine { 0%{top:0;opacity:1} 100%{top:100%;opacity:0} }
        @keyframes barGrow  { from{height:0;opacity:0} to{opacity:1} }
        @keyframes msgIn    { from{opacity:0;transform:translateY(10px) scale(.96)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes typingDot { 0%,60%,100%{transform:translateY(0);opacity:.4} 30%{transform:translateY(-5px);opacity:1} }
        @keyframes blink    { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes fillBar  { from{width:0} to{width:72%} }
        @keyframes countIn  { from{opacity:0;transform:scale(.8)} to{opacity:1;transform:scale(1)} }
        @keyframes shimmer  { 0%{background-position:-200% center} 100%{background-position:200% center} }
        @keyframes lineFade { from{opacity:0;transform:translateX(-6px)} to{opacity:1;transform:translateX(0)} }
        @keyframes heartbeat { 0%,100%{transform:scale(1)} 15%{transform:scale(1.25)} 30%{transform:scale(1)} 45%{transform:scale(1.15)} 60%{transform:scale(1)} }

        /* ── Utility ── */
        .fu  { animation: fadeUp   .7s cubic-bezier(.22,1,.36,1) both; }
        .fi  { animation: fadeIn   .6s ease both; }
        .sr  { animation: slideRight .8s cubic-bezier(.22,1,.36,1) both; }
        .fl  { animation: float    6s ease-in-out infinite; }
        .o1  { animation: orb1     13s ease-in-out infinite; }
        .o2  { animation: orb2     16s ease-in-out infinite; }
        .ci  { animation: countIn  .6s cubic-bezier(.22,1,.36,1) both; }

        .shimmer-text {
          background: linear-gradient(90deg,#fff 0%,var(--orange) 40%,var(--teal) 60%,#fff 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: shimmer 5s linear infinite;
        }

        /* ── Nav ── */
        .glass-nav {
          background: rgba(5,11,26,.88);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(255,255,255,.06);
        }

        /* ── Cards ── */
        .card {
          transition: transform .25s cubic-bezier(.22,1,.36,1), border-color .25s, box-shadow .25s;
        }
        .card:hover {
          transform: translateY(-5px);
          border-color: var(--orange-border) !important;
          box-shadow: 0 16px 48px rgba(249,115,22,.1);
        }

        /* ── Buttons ── */
        .btn-orange {
          background: var(--orange);
          box-shadow: 0 4px 24px rgba(249,115,22,.35);
          transition: all .2s cubic-bezier(.22,1,.36,1);
        }
        .btn-orange:hover {
          background: #fb923c;
          transform: translateY(-2px);
          box-shadow: 0 8px 36px rgba(249,115,22,.5);
        }
        .btn-ghost {
          border: 1px solid rgba(255,255,255,.18);
          background: rgba(255,255,255,.04);
          transition: all .2s ease;
        }
        .btn-ghost:hover {
          background: rgba(255,255,255,.08);
          border-color: rgba(255,255,255,.3);
        }
        .btn-demo {
          background: linear-gradient(135deg, var(--teal) 0%, #0891b2 100%);
          box-shadow: 0 4px 24px rgba(6,182,212,.3);
          transition: all .2s cubic-bezier(.22,1,.36,1);
        }
        .btn-demo:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 36px rgba(6,182,212,.45);
        }

        /* ── Grid bg ── */
        .grid-bg {
          background-image:
            linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px);
          background-size: 64px 64px;
        }

        /* ── Hero layout ── */
        .hero-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 64px;
          align-items: center;
        }

        /* ── Agent grid ── */
        .agents-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
        }

        /* ── Pricing grid ── */
        .pricing-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
        }

        /* ── Stats grid ── */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 24px;
          text-align: center;
        }

        /* ── Steps grid ── */
        .steps-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 32px;
        }

        /* ── Africa features ── */
        .africa-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
        }

        /* ── Footer grid ── */
        .footer-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 32px;
        }

        /* ── Diagonal divider ── */
        .diagonal-top { clip-path: polygon(0 5%, 100% 0, 100% 100%, 0 100%); margin-top: -40px; padding-top: 80px; }
        .diagonal-btm { clip-path: polygon(0 0, 100% 0, 100% 95%, 0 100%); padding-bottom: 80px; }

        /* ── Mockup containers ── */
        .mockup-shell {
          background: #0d1535;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,.08);
          overflow: hidden;
          font-size: 12px;
          user-select: none;
        }
        .mockup-titlebar {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          border-bottom: 1px solid rgba(255,255,255,.06);
        }
        .mockup-dot { width: 7px; height: 7px; border-radius: 50%; }

        /* ─ Chat mockup ─ */
        .chat-area { padding: 12px; display: flex; flex-direction: column; gap: 7px; min-height: 140px; }
        .chat-row-in  { display:flex; justify-content:flex-start; }
        .chat-row-out { display:flex; justify-content:flex-end; }
        .chat-bubble-in  { background:#1e2a3a; border-radius:10px 10px 10px 3px; padding:7px 10px; max-width:78%; line-height:1.45; color:rgba(255,255,255,.8); }
        .chat-bubble-out { background:var(--orange); border-radius:10px 10px 3px 10px; padding:7px 10px; max-width:78%; line-height:1.45; }
        .cm1 { animation: msgIn .5s cubic-bezier(.22,1,.36,1) .8s both; }
        .cm2 { animation: msgIn .5s cubic-bezier(.22,1,.36,1) 2.1s both; }
        .cm3 { animation: msgIn .5s cubic-bezier(.22,1,.36,1) 3.3s both; }
        .typing-row { display:flex; justify-content:flex-end; animation: msgIn .4s .5s both; }
        .typing-bubble { background:rgba(249,115,22,.25); border-radius:10px 10px 3px 10px; padding:8px 12px; display:flex; gap:4px; align-items:center; }
        .td1 { animation: typingDot 1.2s 1.6s ease-in-out infinite; }
        .td2 { animation: typingDot 1.2s 1.8s ease-in-out infinite; }
        .td3 { animation: typingDot 1.2s 2.0s ease-in-out infinite; }

        /* ─ Invoice mockup ─ */
        .inv-body { padding: 12px; display: flex; flex-direction: column; gap: 8px; }
        .inv-row { display:flex; justify-content:space-between; align-items:center; }
        .inv-amount { font-size:22px; font-weight:900; color:var(--orange); }
        .inv-overdue { font-size:10px; background:rgba(239,68,68,.15); border:1px solid rgba(239,68,68,.3); color:#f87171; padding:3px 8px; border-radius:100px; }
        .inv-bar-track { height:6px; background:rgba(255,255,255,.08); border-radius:100px; overflow:hidden; }
        .inv-bar-fill  { height:100%; background:linear-gradient(90deg,var(--orange),#fb923c); border-radius:100px; animation: fillBar 2s 1.5s cubic-bezier(.22,1,.36,1) both; }
        .inv-status { font-size:11px; color:var(--orange); font-weight:600; animation: fadeIn .5s 3.5s both; opacity:0; }

        /* ─ Wellness mockup ─ */
        .well-body { padding: 12px; display: flex; flex-direction: column; gap: 6px; }
        .well-row { display:flex; align-items:center; justify-content:space-between; padding:6px 8px; background:rgba(255,255,255,.03); border-radius:8px; }
        .well-name { color:rgba(255,255,255,.7); font-size:12px; }
        .well-badge { font-size:10px; padding:2px 8px; border-radius:100px; font-weight:600; }
        .badge-ok  { background:rgba(6,182,212,.15); color:var(--teal); border:1px solid rgba(6,182,212,.25); }
        .badge-warn { background:rgba(249,115,22,.15); color:var(--orange); border:1px solid rgba(249,115,22,.25); }
        .badge-good { background:rgba(34,197,94,.12); color:#4ade80; border:1px solid rgba(34,197,94,.25); }
        .pulse-icon { animation: heartbeat 2.5s ease-in-out infinite; display:inline-block; }
        .well-alert { font-size:10px; color:var(--teal); margin-top:4px; padding:5px 8px; background:var(--teal-dim); border-radius:8px; border:1px solid var(--teal-border); animation: fadeIn .5s 2s both; opacity:0; }

        /* ─ Document mockup ─ */
        .doc-body { padding: 12px; position: relative; }
        .doc-preview { background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.07); border-radius:8px; padding:8px 10px; position:relative; overflow:hidden; margin-bottom:8px; }
        .doc-filename { font-size:11px; color:rgba(255,255,255,.5); margin-bottom:6px; }
        .doc-scanline { position:absolute; left:0; right:0; height:2px; background:linear-gradient(90deg,transparent,var(--teal),transparent); animation: scanLine 2s 1s ease-in-out infinite; }
        .doc-line { height:4px; background:rgba(255,255,255,.1); border-radius:2px; margin-bottom:5px; }
        .doc-line.w80 { width:80%; } .doc-line.w60 { width:60%; } .doc-line.w90 { width:90%; } .doc-line.w50 { width:50%; }
        .doc-extracted { display:flex; flex-direction:column; gap:5px; }
        .doc-field { display:flex; align-items:center; gap:6px; font-size:11px; color:rgba(255,255,255,.6); }
        .doc-field-icon { color:var(--teal); font-weight:700; }
        .doc-ef1 { animation: lineFade .4s 1.8s both; opacity:0; }
        .doc-ef2 { animation: lineFade .4s 2.4s both; opacity:0; }
        .doc-ef3 { animation: lineFade .4s 3.0s both; opacity:0; }

        /* ─ Chart mockup ─ */
        .chart-body { padding: 12px; }
        .chart-title { font-size:11px; color:var(--teal); font-weight:700; margin-bottom:10px; }
        .chart-bars { display:flex; align-items:flex-end; gap:6px; height:72px; margin-bottom:8px; }
        .chart-bar { flex:1; border-radius:4px 4px 0 0; }
        .cb1 { background:rgba(6,182,212,.35); animation: barGrow .5s 1.0s cubic-bezier(.22,1,.36,1) both; height:48px; }
        .cb2 { background:rgba(6,182,212,.45); animation: barGrow .5s 1.2s cubic-bezier(.22,1,.36,1) both; height:62px; }
        .cb3 { background:var(--teal); animation: barGrow .5s 1.4s cubic-bezier(.22,1,.36,1) both; height:70px; }
        .cb4 { background:rgba(6,182,212,.45); animation: barGrow .5s 1.6s cubic-bezier(.22,1,.36,1) both; height:56px; }
        .cb5 { background:rgba(6,182,212,.55); animation: barGrow .5s 1.8s cubic-bezier(.22,1,.36,1) both; height:66px; }
        .chart-stat { font-size:11px; color:rgba(255,255,255,.5); }
        .chart-stat strong { color:#4ade80; }

        /* ─ Pen/Writing mockup ─ */
        .pen-body { padding: 12px; }
        .pen-type { font-size:10px; color:var(--orange); font-weight:700; text-transform:uppercase; letter-spacing:.07em; margin-bottom:8px; }
        .pen-lines { display:flex; flex-direction:column; gap:5px; }
        .pen-line { height:4px; border-radius:2px; background:rgba(255,255,255,.15); }
        .pl1 { width:88%; animation: lineFade .4s 1.0s both; opacity:0; }
        .pl2 { width:72%; animation: lineFade .4s 1.6s both; opacity:0; }
        .pl3 { width:82%; animation: lineFade .4s 2.2s both; opacity:0; }
        .pl4 { width:60%; animation: lineFade .4s 2.8s both; opacity:0; }
        .pen-cursor { display:inline-block; width:2px; height:14px; background:var(--orange); margin-left:2px; animation: blink 1s 3s step-end infinite; opacity:0; animation-fill-mode:both; }
        .pen-action { font-size:11px; color:var(--orange); font-weight:600; margin-top:8px; animation: fadeIn .5s 3.5s both; opacity:0; }

        /* ── Add-ons grid (4 cards, 2×2) ── */
        .addons-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 24px;
        }

        /* ── Responsive ── */
        @media (max-width: 900px) {
          .hero-grid { grid-template-columns: 1fr; gap: 40px; }
          .agents-grid { grid-template-columns: repeat(2, 1fr); }
          .addons-grid { grid-template-columns: repeat(2, 1fr); }
          .pricing-grid { grid-template-columns: repeat(2, 1fr); }
          .stats-grid  { grid-template-columns: repeat(3, 1fr); gap: 20px; }
          .steps-grid  { grid-template-columns: 1fr; gap: 24px; }
          .africa-grid { grid-template-columns: 1fr; }
          .footer-grid { grid-template-columns: repeat(2, 1fr); }
          .bi-grid { grid-template-columns: 1fr !important; }
          .ubuntu-grid { grid-template-columns: 1fr !important; }
          .academy-grid { grid-template-columns: 1fr !important; }
          .impact-counter-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }

        @media (max-width: 560px) {
          .agents-grid  { grid-template-columns: 1fr; }
          .addons-grid  { grid-template-columns: 1fr; }
          .pricing-grid { grid-template-columns: 1fr; }
          .stats-grid   { grid-template-columns: repeat(2, 1fr); gap: 12px; }
          .footer-grid  { grid-template-columns: 1fr; }
          .hero-demo-hide { display: none !important; }
          .hero-section { padding: 56px 20px 48px !important; }
          .roi-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
          .roi-table { min-width: 480px; }
          .cta-inner { padding: 44px 24px !important; }
          .hero-ctas { flex-direction: column !important; align-items: stretch !important; }
          .hero-cta-btn { width: 100% !important; justify-content: center !important; text-align: center !important; }
          .section-title { font-size: clamp(22px, 6vw, 32px) !important; }
          .impact-counter-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .footer-bottom { flex-direction: column !important; align-items: center !important; gap: 10px !important; }
          .testimonials-grid { grid-template-columns: 1fr !important; }
        }

        @media (max-width: 380px) {
          .hero-section { padding: 44px 16px 40px !important; }
          .stats-grid { grid-template-columns: 1fr 1fr; }
          .pricing-grid { grid-template-columns: 1fr; }
          .impact-counter-grid { grid-template-columns: 1fr 1fr; }
        }

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; }
        }
      `}</style>

      <div style={{ background: 'var(--black)', minHeight: '100vh', color: '#fff' }}>

        {/* ── Nav ─────────────────────────────────────────────────────── */}
        <header className="sticky top-0 z-50 glass-nav">
          <nav className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--orange)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 13, letterSpacing: '-.5px', color: '#fff' }}>AO</div>
              <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-.5px' }}>AdminOS</span>
            </div>

            <div className="hidden md:flex items-center gap-8 text-sm" style={{ color: 'var(--dimmer)' }}>
              <a href="#agents"  className="hover:text-white transition-colors">Agents</a>
              <a href="#addons"  className="hover:text-white transition-colors">Add-ons</a>
              <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
              <a href="#faq"     className="hover:text-white transition-colors">FAQ</a>
              <Link href="/contact" className="hover:text-white transition-colors">Contact</Link>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Link href="/login" className="text-sm hidden sm:block transition-colors" style={{ color: 'var(--dimmer)' }}>Sign in</Link>
              <Link href="/demo" className="btn-demo text-sm px-4 py-2 rounded-lg font-bold text-white hidden sm:inline-flex items-center gap-1.5" style={{ textDecoration: 'none' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><polygon points="5,3 19,12 5,21" fill="white"/></svg>
                Try demo
              </Link>
              <Link href="/signup" className="btn-orange text-sm px-4 py-2 rounded-lg font-bold text-white" style={{ textDecoration: 'none' }}>Free trial</Link>
              <MobileNav />
            </div>
          </nav>
        </header>

        <main>

          {/* ── Hero ────────────────────────────────────────────────────── */}
          <section className="hero-section relative overflow-hidden" style={{ padding: '96px 24px 80px' }}>

            {/* BG orbs */}
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
              <div className="o1" style={{ position: 'absolute', top: '-15%', left: '-8%', width: 700, height: 700, borderRadius: '50%', background: 'radial-gradient(circle, rgba(249,115,22,.1) 0%, transparent 65%)', filter: 'blur(50px)' }} />
              <div className="o2" style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(6,182,212,.1) 0%, transparent 65%)', filter: 'blur(60px)' }} />
              <div className="grid-bg fi" style={{ position: 'absolute', inset: 0, opacity: .6, animationDelay: '.4s' }} />
            </div>

            <div className="max-w-7xl mx-auto relative hero-grid">

              {/* Left — copy */}
              <div>
                <div className="fu" style={{ animationDelay: '.1s', display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--orange-dim)', border: '1px solid var(--orange-border)', borderRadius: 100, padding: '6px 16px', fontSize: 13, color: 'var(--orange)', marginBottom: 28 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--orange)', display: 'inline-block', animation: 'pulse 2s ease-in-out infinite' }} />
                  Built for South African business
                </div>

                <h1 className="fu" style={{ animationDelay: '.2s', fontSize: 'clamp(42px, 5.5vw, 72px)', fontWeight: 900, lineHeight: 1.02, letterSpacing: '-2.5px', marginBottom: 22 }}>
                  Your whole business.<br />
                  <span className="shimmer-text">One workspace.</span>
                </h1>

                <p className="fu" style={{ animationDelay: '.3s', fontSize: 18, lineHeight: 1.65, color: 'var(--dim)', marginBottom: 10, maxWidth: 490 }}>
                  Invoices, payroll, staff, contracts, bookings, documents and compliance dates — organised in one place, with AI that drafts the admin so you can check it and move on. From R349/month.
                </p>

                <p className="fu" style={{ animationDelay: '.35s', fontSize: 14, color: 'var(--orange)', fontWeight: 700, marginBottom: 32 }}>
                  One workspace instead of a folder, a spreadsheet, a chat thread, and three apps.
                </p>

                <div className="fu hero-ctas" style={{ animationDelay: '.45s', display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                  <Link href="/signup" className="btn-orange hero-cta-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 28px', borderRadius: 14, fontWeight: 800, fontSize: 16, color: 'white', textDecoration: 'none' }}>
                    Start 14-day free trial
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </Link>
                  <Link href="/demo" className="btn-demo hero-cta-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 28px', borderRadius: 14, fontWeight: 700, fontSize: 16, color: 'white', textDecoration: 'none' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><polygon points="5,3 19,12 5,21" fill="white"/></svg>
                    Try interactive demo
                  </Link>
                </div>

                <p className="fu" style={{ animationDelay: '.5s', fontSize: 13, color: 'var(--dimmest)' }}>
                  No credit card · Cancel anytime · Your data is yours to export
                </p>
              </div>

              {/* Right — animated chat phone */}
              <div className="sr hero-demo-hide" style={{ animationDelay: '.4s', display: 'flex', justifyContent: 'center' }}>
                <div className="fl" style={{ animationDelay: '1s' }}>
                  <div style={{ width: 310, background: '#111827', borderRadius: 32, border: '2px solid rgba(255,255,255,.08)', boxShadow: '0 40px 100px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.04)', overflow: 'hidden' }}>

                    {/* Header */}
                    <div style={{ background: '#0A0F2C', padding: '10px 14px 12px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid rgba(249,115,22,.15)' }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--orange)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 13 }}>A</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, letterSpacing: '-.2px' }}>Alex · AdminOS</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--teal)', display: 'inline-block' }} />Online
                        </div>
                      </div>
                    </div>

                    {/* Chat */}
                    <div className="chat-area" style={{ background: '#0d1117' }}>

                      <div className="chat-row-in cm1">
                        <div className="chat-bubble-in">Hey, Thabo still hasn&apos;t paid his invoice 😤
                          <div style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', marginTop: 3, textAlign: 'right' }}>09:14</div>
                        </div>
                      </div>

                      <div className="typing-row">
                        <div className="typing-bubble">
                          <span className="td1" style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(255,255,255,.7)', display: 'inline-block' }} />
                          <span className="td2" style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(255,255,255,.7)', display: 'inline-block' }} />
                          <span className="td3" style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(255,255,255,.7)', display: 'inline-block' }} />
                        </div>
                      </div>

                      <div className="chat-row-out cm2">
                        <div className="chat-bubble-out">On it — Chase agent activated. Escalation if no response in 3 days. 📋
                          <div style={{ fontSize: 10, color: 'rgba(255,255,255,.65)', marginTop: 3, textAlign: 'right' }}>09:14 ✓✓</div>
                        </div>
                      </div>

                      <div className="cm3" style={{ textAlign: 'center' }}>
                        <span style={{ background: 'var(--orange-dim)', border: '1px solid var(--orange-border)', borderRadius: 100, padding: '4px 12px', fontSize: 10, color: 'var(--orange)' }}>
                          ✓ Invoice R8,400 · Chase escalation queued
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ── Demo CTA banner ─────────────────────────────────────────── */}
          <div style={{ background: 'linear-gradient(135deg, rgba(6,182,212,.08) 0%, rgba(249,115,22,.06) 100%)', borderTop: '1px solid rgba(6,182,212,.15)', borderBottom: '1px solid rgba(6,182,212,.15)', padding: '24px', textAlign: 'center' }}>
            <div className="max-w-4xl mx-auto" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, flexWrap: 'wrap' }}>
              <div>
                <p style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-.3px' }}>See AdminOS in action — no account needed</p>
                <p style={{ fontSize: 13, color: 'var(--dim)', marginTop: 2 }}>Explore all 6 agents with a fake SA business. Scripted real-world scenarios.</p>
              </div>
              <Link href="/demo" className="btn-demo" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 28px', borderRadius: 12, fontWeight: 800, fontSize: 15, color: 'white', textDecoration: 'none', flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><polygon points="5,3 19,12 5,21" fill="white"/></svg>
                Open Interactive Demo
              </Link>
            </div>
          </div>

          {/* ── Stats ───────────────────────────────────────────────────── */}
          <section style={{ borderBottom: '1px solid rgba(255,255,255,.05)', background: 'rgba(255,255,255,.015)', padding: '56px 24px' }}>
            <div className="max-w-4xl mx-auto stats-grid">
              {stats.map((s, i) => (
                <div key={s.label} className="ci" style={{ animationDelay: `${i * .1}s` }}>
                  <div style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 900, color: i % 2 === 0 ? 'var(--orange)' : 'var(--teal)', letterSpacing: '-1.5px', lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: 13, color: 'var(--dimmer)', marginTop: 8, lineHeight: 1.3 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </section>

          {/* ── ROI table ───────────────────────────────────────────────── */}
          <section className="max-w-5xl mx-auto px-6 py-24">
            <div style={{ textAlign: 'center', marginBottom: 48 }}>
              <p style={{ color: 'var(--orange)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 12 }}>What it replaces</p>
              <h2 style={{ fontSize: 'clamp(28px, 4vw, 46px)', fontWeight: 800, letterSpacing: '-1.5px', marginBottom: 16 }}>One workspace<br />instead of eight subscriptions</h2>
              <p style={{ color: 'var(--dim)', maxWidth: 480, margin: '0 auto', lineHeight: 1.6 }}>
                Here is what South African businesses typically pay to cover the same ground, at each tool&rsquo;s advertised price. AdminOS Operate is <strong style={{ color: '#fff' }}>R1,999/month</strong>.
              </p>
            </div>

            <div className="roi-wrap" style={{ borderRadius: 20, border: '1px solid rgba(255,255,255,.07)' }}>
            <div className="roi-table" style={{ borderRadius: 20, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', background: 'rgba(255,255,255,.03)', padding: '12px 24px' }}>
                {['What you pay for now', 'Monthly cost', 'Replaced by'].map((h, i) => (
                  <span key={h} style={{ fontSize: 11, color: 'var(--dimmest)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 700, textAlign: i === 1 ? 'center' : i === 2 ? 'right' : 'left' }}>{h}</span>
                ))}
              </div>
              {replacements.map((r) => (
                <div key={r.tool} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '15px 24px', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,.04)' }}>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,.65)' }}>{r.tool}</span>
                  <span style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#f87171', textDecoration: 'line-through' }}>{r.cost}</span>
                  <span style={{ textAlign: 'right', fontSize: 13, color: 'var(--teal)' }}>{r.agent}</span>
                </div>
              ))}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '16px 24px', alignItems: 'center', background: 'rgba(249,115,22,.06)', borderTop: '1px solid rgba(249,115,22,.15)' }}>
                <span style={{ fontWeight: 800 }}>Combined</span>
                <span style={{ textAlign: 'center', fontWeight: 800, color: '#f87171', textDecoration: 'line-through' }}>R15,000/mo</span>
                <span style={{ textAlign: 'right', fontWeight: 800, color: 'var(--orange)' }}>AdminOS Operate: R1,999/mo</span>
              </div>
            </div>
            </div>
            <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--dimmest)', marginTop: 16, maxWidth: 620, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.6 }}>
              Based on the advertised list prices of comparable tools, not a measured client average. What you actually spend today depends on which of these you use. No setup cost on Grow, Operate, and Scale tiers.
            </p>
          </section>

          {/* ── 6 Agents ────────────────────────────────────────────────── */}
          <section id="agents" style={{ background: 'rgba(255,255,255,.012)', borderTop: '1px solid rgba(255,255,255,.05)', borderBottom: '1px solid rgba(255,255,255,.05)', padding: '96px 24px' }}>
            <div className="max-w-7xl mx-auto">

              <div style={{ textAlign: 'center', marginBottom: 60 }}>
                <p style={{ color: 'var(--teal)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 12 }}>Your AI team</p>
                <h2 style={{ fontSize: 'clamp(28px, 4vw, 52px)', fontWeight: 900, letterSpacing: '-2px', marginBottom: 16 }}>6 agents. Always on.</h2>
                <p style={{ color: 'var(--dim)', maxWidth: 420, margin: '0 auto', lineHeight: 1.65, fontSize: 16 }}>
                  Each agent has a name, a job, and a target. Together they run your operations without being asked.
                </p>
              </div>

              <div className="agents-grid">

                {/* ─ Alex ─ */}
                <article className="fu card" style={{ animationDelay: '0s', background: 'rgba(249,115,22,.06)', border: '1px solid rgba(249,115,22,.18)', borderRadius: 20, padding: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--orange-dim)', border: '1px solid var(--orange-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>💬</div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 17 }}>Alex</div>
                      <div style={{ fontSize: 11, color: 'var(--dim)' }}>Inbox Agent</div>
                    </div>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.65, marginBottom: 14 }}>Handles all WhatsApp conversations 24/7 — FAQs, bookings, quotes, escalations. In your customer&apos;s language.</p>
                  {/* Mini mockup */}
                  <div className="mockup-shell">
                    <div className="mockup-titlebar" style={{ background: '#0d1535' }}>
                      <div className="mockup-dot" style={{ background: '#ef4444' }} />
                      <div className="mockup-dot" style={{ background: '#f59e0b' }} />
                      <div className="mockup-dot" style={{ background: '#22c55e' }} />
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', marginLeft: 4 }}>alex · whatsapp</span>
                    </div>
                    <div className="chat-area" style={{ minHeight: 110, padding: '10px' }}>
                      <div className="chat-row-in cm1">
                        <div className="chat-bubble-in" style={{ fontSize: 11 }}>Can I get a quote for cleaning?</div>
                      </div>
                      <div className="typing-row">
                        <div className="typing-bubble">
                          <span className="td1" style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(255,255,255,.7)', display: 'inline-block' }} />
                          <span className="td2" style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(255,255,255,.7)', display: 'inline-block' }} />
                          <span className="td3" style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(255,255,255,.7)', display: 'inline-block' }} />
                        </div>
                      </div>
                      <div className="chat-row-out cm2">
                        <div className="chat-bubble-out" style={{ fontSize: 11 }}>Sure! Quote QT-1047 sent ✓</div>
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop: 12, background: 'rgba(0,0,0,.2)', border: '1px solid rgba(249,115,22,.15)', borderRadius: 8, padding: '7px 10px', fontSize: 11, color: 'var(--orange)', fontWeight: 600 }}>
                    📈 80% of messages handled without you
                  </div>
                </article>

                {/* ─ Chase ─ */}
                <article className="fu card" style={{ animationDelay: '.08s', background: 'rgba(6,182,212,.06)', border: '1px solid rgba(6,182,212,.18)', borderRadius: 20, padding: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--teal-dim)', border: '1px solid var(--teal-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>💰</div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 17 }}>Chase</div>
                      <div style={{ fontSize: 11, color: 'var(--dim)' }}>Debt Recovery Agent</div>
                    </div>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.65, marginBottom: 14 }}>Follows up on overdue invoices with escalating, professional messages — friendly reminder to letter of demand.</p>
                  {/* Invoice mockup */}
                  <div className="mockup-shell">
                    <div className="mockup-titlebar" style={{ background: '#0d1535' }}>
                      <div className="mockup-dot" style={{ background: '#ef4444' }} />
                      <div className="mockup-dot" style={{ background: '#f59e0b' }} />
                      <div className="mockup-dot" style={{ background: '#22c55e' }} />
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', marginLeft: 4 }}>chase · invoices</span>
                    </div>
                    <div className="inv-body">
                      <div className="inv-row">
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,.4)' }}>INV-0142</span>
                        <span className="inv-overdue">45 days overdue</span>
                      </div>
                      <div className="inv-amount">R8,400</div>
                      <div className="inv-row">
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,.35)' }}>Recovery progress</span>
                        <span style={{ fontSize: 10, color: 'var(--teal)' }}>72%</span>
                      </div>
                      <div className="inv-bar-track">
                        <div className="inv-bar-fill" />
                      </div>
                      <p className="inv-status">✓ Reminder sent · Escalation scheduled</p>
                    </div>
                  </div>
                  <div style={{ marginTop: 12, background: 'rgba(0,0,0,.2)', border: '1px solid rgba(6,182,212,.15)', borderRadius: 8, padding: '7px 10px', fontSize: 11, color: 'var(--teal)', fontWeight: 600 }}>
                    📈 60% faster average invoice settlement
                  </div>
                </article>

                {/* ─ Care ─ */}
                <article className="fu card" style={{ animationDelay: '.16s', background: 'rgba(6,182,212,.05)', border: '1px solid rgba(6,182,212,.15)', borderRadius: 20, padding: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--teal-dim)', border: '1px solid var(--teal-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                      <span className="pulse-icon">❤️</span>
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 17 }}>Care</div>
                      <div style={{ fontSize: 11, color: 'var(--dim)' }}>Wellness Agent</div>
                    </div>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.65, marginBottom: 14 }}>Regular AI-driven staff check-ins via WhatsApp. Identifies burnout signals early and keeps your team supported.</p>
                  {/* Wellness mockup */}
                  <div className="mockup-shell">
                    <div className="mockup-titlebar" style={{ background: '#0d1535' }}>
                      <div className="mockup-dot" style={{ background: '#ef4444' }} />
                      <div className="mockup-dot" style={{ background: '#f59e0b' }} />
                      <div className="mockup-dot" style={{ background: '#22c55e' }} />
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', marginLeft: 4 }}>care · pulse</span>
                    </div>
                    <div className="well-body">
                      <div className="well-row">
                        <span className="well-name">Sipho M.</span>
                        <span className="well-badge badge-ok">Happy</span>
                      </div>
                      <div className="well-row">
                        <span className="well-name">Thabo D.</span>
                        <span className="well-badge badge-warn">Stressed</span>
                      </div>
                      <div className="well-row">
                        <span className="well-name">Zanele K.</span>
                        <span className="well-badge badge-good">Motivated</span>
                      </div>
                      <p className="well-alert">↗ Care checking in with Thabo now</p>
                    </div>
                  </div>
                  <div style={{ marginTop: 12, background: 'rgba(0,0,0,.2)', border: '1px solid rgba(6,182,212,.15)', borderRadius: 8, padding: '7px 10px', fontSize: 11, color: 'var(--teal)', fontWeight: 600 }}>
                    📈 Burnout caught before it costs you
                  </div>
                </article>

                {/* ─ Doc ─ */}
                <article className="fu card" style={{ animationDelay: '.24s', background: 'rgba(139,92,246,.06)', border: '1px solid rgba(139,92,246,.18)', borderRadius: 20, padding: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(139,92,246,.1)', border: '1px solid rgba(139,92,246,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📄</div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 17 }}>Doc</div>
                      <div style={{ fontSize: 11, color: 'var(--dim)' }}>Document Intelligence</div>
                    </div>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.65, marginBottom: 14 }}>Upload contracts, quotes, invoices. AI classifies, extracts key data, flags expiry dates, and auto-creates debtors.</p>
                  {/* Document scan mockup */}
                  <div className="mockup-shell">
                    <div className="mockup-titlebar" style={{ background: '#0d1535' }}>
                      <div className="mockup-dot" style={{ background: '#ef4444' }} />
                      <div className="mockup-dot" style={{ background: '#f59e0b' }} />
                      <div className="mockup-dot" style={{ background: '#22c55e' }} />
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', marginLeft: 4 }}>doc · scanning</span>
                    </div>
                    <div className="doc-body">
                      <div className="doc-preview">
                        <div className="doc-filename">Contract_TL_2024.pdf</div>
                        <div className="doc-scanline" />
                        <div className="doc-line w90" />
                        <div className="doc-line w60" />
                        <div className="doc-line w80" />
                        <div className="doc-line w50" />
                      </div>
                      <div className="doc-extracted">
                        <div className="doc-field doc-ef1">
                          <span className="doc-field-icon">✓</span> Client: Dlamini Attorneys
                        </div>
                        <div className="doc-field doc-ef2">
                          <span className="doc-field-icon">✓</span> Value: R124,000
                        </div>
                        <div className="doc-field doc-ef3">
                          <span style={{ color: 'var(--orange)', fontWeight: 700 }}>⚠</span> Expiry: 14 days
                        </div>
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop: 12, background: 'rgba(0,0,0,.2)', border: '1px solid rgba(139,92,246,.15)', borderRadius: 8, padding: '7px 10px', fontSize: 11, color: '#a78bfa', fontWeight: 600 }}>
                    📈 90% faster document processing
                  </div>
                </article>

                {/* ─ Insight ─ */}
                <article className="fu card" style={{ animationDelay: '.32s', background: 'rgba(6,182,212,.05)', border: '1px solid rgba(6,182,212,.15)', borderRadius: 20, padding: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--teal-dim)', border: '1px solid var(--teal-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📊</div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 17 }}>Insight</div>
                      <div style={{ fontSize: 11, color: 'var(--dim)' }}>Analytics Agent</div>
                    </div>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.65, marginBottom: 14 }}>Daily 05:00 AI brief. Revenue trends, debt aging, staff pulse, growth opportunities — before your team starts.</p>
                  {/* Chart mockup */}
                  <div className="mockup-shell">
                    <div className="mockup-titlebar" style={{ background: '#0d1535' }}>
                      <div className="mockup-dot" style={{ background: '#ef4444' }} />
                      <div className="mockup-dot" style={{ background: '#f59e0b' }} />
                      <div className="mockup-dot" style={{ background: '#22c55e' }} />
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', marginLeft: 4 }}>insight · daily brief</span>
                    </div>
                    <div className="chart-body">
                      <div className="chart-title">📋 Morning Brief · 05:00 AM</div>
                      <div className="chart-bars">
                        <div className="chart-bar cb1" />
                        <div className="chart-bar cb2" />
                        <div className="chart-bar cb3" />
                        <div className="chart-bar cb4" />
                        <div className="chart-bar cb5" />
                      </div>
                      <div className="chart-stat">Revenue <strong>+23%</strong> this month · 4 invoices overdue</div>
                    </div>
                  </div>
                  <div style={{ marginTop: 12, background: 'rgba(0,0,0,.2)', border: '1px solid rgba(6,182,212,.15)', borderRadius: 8, padding: '7px 10px', fontSize: 11, color: 'var(--teal)', fontWeight: 600 }}>
                    📈 You see problems before they happen
                  </div>
                </article>

                {/* ─ Pen ─ */}
                <article className="fu card" style={{ animationDelay: '.4s', background: 'rgba(249,115,22,.06)', border: '1px solid rgba(249,115,22,.18)', borderRadius: 20, padding: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--orange-dim)', border: '1px solid var(--orange-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>✍️</div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 17 }}>Pen</div>
                      <div style={{ fontSize: 11, color: 'var(--dim)' }}>Content Agent</div>
                    </div>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.65, marginBottom: 14 }}>Drafts proposals, LinkedIn posts, newsletters, and WhatsApp broadcasts in your brand voice — on demand.</p>
                  {/* Writing mockup */}
                  <div className="mockup-shell">
                    <div className="mockup-titlebar" style={{ background: '#0d1535' }}>
                      <div className="mockup-dot" style={{ background: '#ef4444' }} />
                      <div className="mockup-dot" style={{ background: '#f59e0b' }} />
                      <div className="mockup-dot" style={{ background: '#22c55e' }} />
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', marginLeft: 4 }}>pen · drafting</span>
                    </div>
                    <div className="pen-body">
                      <div className="pen-type">LinkedIn Post</div>
                      <div className="pen-lines">
                        <div className="pen-line pl1" />
                        <div className="pen-line pl2" />
                        <div className="pen-line pl3" />
                        <div className="pen-line pl4" />
                        <div style={{ height: 14, display: 'flex', alignItems: 'center' }}>
                          <div className="pen-line" style={{ width: '40%', animation: 'lineFade .4s 3.4s both', opacity: 0 }} />
                          <span className="pen-cursor" />
                        </div>
                      </div>
                      <p className="pen-action">✓ Draft ready · 1 LinkedIn + 1 WhatsApp blast</p>
                    </div>
                  </div>
                  <div style={{ marginTop: 12, background: 'rgba(0,0,0,.2)', border: '1px solid rgba(249,115,22,.15)', borderRadius: 8, padding: '7px 10px', fontSize: 11, color: 'var(--orange)', fontWeight: 600 }}>
                    📈 Hours of writing done in seconds
                  </div>
                </article>

              </div>

              <div style={{ marginTop: 40, textAlign: 'center' }}>
                <Link href="/demo" className="btn-demo" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 32px', borderRadius: 14, fontWeight: 800, fontSize: 15, color: 'white', textDecoration: 'none' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><polygon points="5,3 19,12 5,21" fill="white"/></svg>
                  Try all 6 agents in the interactive demo
                </Link>
              </div>
            </div>
          </section>

          {/* ── Platform Depth ──────────────────────────────────────────── */}
          <section style={{ background: 'rgba(255,255,255,.012)', borderTop: '1px solid rgba(255,255,255,.05)', borderBottom: '1px solid rgba(255,255,255,.05)', padding: '96px 24px' }}>
            <div className="max-w-7xl mx-auto">
              <div style={{ textAlign: 'center', marginBottom: 60 }}>
                <p style={{ color: 'var(--orange)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 12 }}>Beyond the agents</p>
                <h2 style={{ fontSize: 'clamp(28px, 4vw, 52px)', fontWeight: 900, letterSpacing: '-2px', marginBottom: 16 }}>A complete business OS.</h2>
                <p style={{ color: 'var(--dim)', maxWidth: 480, margin: '0 auto', lineHeight: 1.65, fontSize: 16 }}>
                  AdminOS goes deeper than messaging. Every system your business needs — built in, not bolted on.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }} className="agents-grid">

                {[
                  {
                    icon: '🧑‍💼',
                    title: 'Employee OS',
                    color: 'var(--orange)',
                    dimColor: 'var(--orange-dim)',
                    borderColor: 'var(--orange-border)',
                    items: ['Digital clock-in & clock-out', 'Shift scheduling', 'Leave requests & approval', 'Expense capture on WhatsApp', 'Performance reviews', 'Disciplinary records'],
                  },
                  {
                    icon: '🎓',
                    title: 'Business Academy',
                    color: 'var(--teal)',
                    dimColor: 'var(--teal-dim)',
                    borderColor: 'var(--teal-border)',
                    items: ['Langa AI mentor (your business)', '40+ frameworks & playbooks', 'Achievement system', 'Contextual lesson triggers', 'SA-specific business content', 'Streak & progress tracking'],
                  },
                  {
                    icon: '⚙️',
                    title: 'Operations',
                    color: '#a78bfa',
                    dimColor: 'rgba(139,92,246,.1)',
                    borderColor: 'rgba(139,92,246,.25)',
                    items: ['Task & project management', 'SOPs with staff acknowledgement', 'Inventory tracking', 'Supplier management', 'Quote-to-contract workflow', 'Online booking engine'],
                  },
                  {
                    icon: '📋',
                    title: 'Compliance',
                    color: '#34d399',
                    dimColor: 'rgba(52,211,153,.1)',
                    borderColor: 'rgba(52,211,153,.25)',
                    items: ['SA compliance calendar (pre-seeded)', 'Professional licence tracking', 'Health & safety incident log', 'Employment equity data (EEA)', 'POPIA right-to-erasure tools', 'Immutable audit trail'],
                  },
                  {
                    icon: '📈',
                    title: 'Business Intelligence',
                    color: 'var(--teal)',
                    dimColor: 'var(--teal-dim)',
                    borderColor: 'var(--teal-border)',
                    items: ['Business Health Score engine', '90-day cash flow forecast', 'Sector benchmarking', 'Business valuation model', 'Exit readiness score', 'Impact dashboard'],
                  },
                  {
                    icon: '🤝',
                    title: 'Ubuntu & Community',
                    color: 'var(--orange)',
                    dimColor: 'var(--orange-dim)',
                    borderColor: 'var(--orange-border)',
                    items: ['Stokvel group management', 'Peer mentorship matching', 'Community knowledge board', 'Informal-to-formal tracker', 'B-BBEE data capture', 'Formalization pathway'],
                  },
                ].map((section, i) => (
                  <article key={section.title} className="fu card" style={{ animationDelay: `${i * .08}s`, background: section.dimColor, border: `1px solid ${section.borderColor}`, borderRadius: 20, padding: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(0,0,0,.2)', border: `1px solid ${section.borderColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{section.icon}</div>
                      <h3 style={{ fontWeight: 800, fontSize: 16, color: section.color }}>{section.title}</h3>
                    </div>
                    <ul style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                      {section.items.map(item => (
                        <li key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: 'rgba(255,255,255,.65)' }}>
                          <span style={{ color: section.color, fontWeight: 700, flexShrink: 0 }}>✓</span>{item}
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </div>
          </section>

          {/* ── Business Intelligence ───────────────────────────────────── */}
          <section style={{ background: 'linear-gradient(180deg,#050B1A 0%,#071020 100%)', borderTop: '1px solid rgba(6,182,212,.12)', borderBottom: '1px solid rgba(6,182,212,.12)', padding: '96px 24px' }}>
            <div className="max-w-6xl mx-auto">
              <div style={{ textAlign: 'center', marginBottom: 64 }}>
                <p style={{ color: '#06B6D4', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 12 }}>Business Intelligence</p>
                <h2 className="section-title" style={{ fontSize: 'clamp(26px, 3.5vw, 46px)', fontWeight: 900, letterSpacing: '-1.5px', marginBottom: 16 }}>Your numbers, contextualised</h2>
                <p style={{ color: 'var(--dim)', maxWidth: 520, margin: '0 auto', lineHeight: 1.65, fontSize: 16 }}>
                  AdminOS doesn&apos;t just track data — it interprets it against your sector, your stage, and your goals.
                </p>
              </div>

              <div className="bi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
                {/* Health Score card */}
                <div style={{ background: '#0A1628', border: '1px solid rgba(34,197,94,.2)', borderRadius: 16, padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(34,197,94,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>📊</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: '#f1f5f9' }}>Business Health Score</div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>Updated weekly · AI-driven</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                    <div style={{ position: 'relative', width: 80, height: 80, flexShrink: 0 }}>
                      <svg viewBox="0 0 80 80" style={{ transform: 'rotate(-90deg)', width: 80, height: 80 }}>
                        <circle cx="40" cy="40" r="32" fill="none" stroke="#1e3a5f" strokeWidth="8"/>
                        <circle cx="40" cy="40" r="32" fill="none" stroke="#22c55e" strokeWidth="8" strokeDasharray={`${2*Math.PI*32*0.74} ${2*Math.PI*32}`} strokeLinecap="round"/>
                      </svg>
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 22, color: '#22c55e' }}>74</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                      {[['Cash flow', 82, '#22c55e'], ['Collections', 71, '#F97316'], ['Staff wellness', 68, '#F97316'], ['Compliance', 90, '#22c55e']].map(([label, val, color]) => (
                        <div key={String(label)}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                            <span style={{ fontSize: 11, color: '#64748b' }}>{label}</span>
                            <span style={{ fontSize: 11, color: String(color), fontWeight: 600 }}>{val}</span>
                          </div>
                          <div style={{ height: 4, background: '#1e2a45', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${val}%`, background: String(color), borderRadius: 2, transition: 'width 1s ease' }}/>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ padding: '10px 14px', background: 'rgba(34,197,94,.08)', borderRadius: 8, fontSize: 13, color: '#22c55e', border: '1px solid rgba(34,197,94,.15)' }}>
                    ↑ 6 pts vs last quarter — your sector avg is 61
                  </div>
                </div>

                {/* Cash Flow Forecast */}
                <div style={{ background: '#0A1628', border: '1px solid rgba(249,115,22,.2)', borderRadius: 16, padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(249,115,22,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>📈</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: '#f1f5f9' }}>90-Day Cash Forecast</div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>AI-modelled from your data</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 80 }}>
                    {[
                      { m: 'Jun', h: 55, act: true }, { m: 'Jul', h: 72, act: false }, { m: 'Aug', h: 68, act: false }, { m: 'Sep', h: 84, act: false }, { m: 'Oct', h: 91, act: false }, { m: 'Nov', h: 78, act: false }
                    ].map(({ m, h, act }) => (
                      <div key={m} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: '100%', height: `${h}%`, background: act ? '#F97316' : 'rgba(249,115,22,.3)', borderRadius: '4px 4px 0 0', border: act ? 'none' : '1px dashed rgba(249,115,22,.4)' }}/>
                        <div style={{ fontSize: 10, color: '#475569' }}>{m}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[['Projected inflow (Jul)', 'R 142,000', '#22c55e'], ['Outstanding debtors', 'R 38,500', '#F97316'], ['30-day runway', '94 days', '#06B6D4']].map(([label, val, color]) => (
                      <div key={String(label)} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#0f172a', borderRadius: 8 }}>
                        <span style={{ fontSize: 13, color: '#64748b' }}>{label}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: String(color) }}>{val}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Valuation Engine */}
                <div style={{ background: '#0A1628', border: '1px solid rgba(167,139,250,.2)', borderRadius: 16, padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(167,139,250,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🏦</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: '#f1f5f9' }}>Valuation Engine</div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>Exit readiness · Investor-ready</div>
                    </div>
                  </div>
                  <div style={{ padding: '16px', background: '#050B1A', borderRadius: 12, border: '1px solid rgba(167,139,250,.15)' }}>
                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Estimated business value</div>
                    <div style={{ fontSize: 32, fontWeight: 900, color: '#a78bfa', letterSpacing: '-1px' }}>R 1.84M</div>
                    <div style={{ fontSize: 12, color: '#22c55e', marginTop: 4 }}>↑ R 240k from last quarter</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[['Revenue multiple', '2.4×', '#a78bfa'], ['EBITDA multiple', '6.1×', '#a78bfa'], ['Exit readiness score', '73 / 100', '#F97316'], ['Board pack ready', 'Yes', '#22c55e']].map(([label, val, color]) => (
                      <div key={String(label)} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                        <span style={{ fontSize: 13, color: '#64748b' }}>{label}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: String(color) }}>{val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 40, textAlign: 'center' }}>
                <p style={{ color: 'var(--dim)', fontSize: 14 }}>Available on Operate, Scale & Partner plans · <a href="#pricing" style={{ color: '#06B6D4', textDecoration: 'none', fontWeight: 600 }}>See pricing →</a></p>
              </div>
            </div>
          </section>

          {/* ── Academy & Langa ─────────────────────────────────────────── */}
          <section style={{ padding: '96px 24px' }}>
            <div className="max-w-6xl mx-auto">
              <div className="academy-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }}>
                {/* Left: content */}
                <div>
                  <p style={{ color: 'var(--orange)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 16 }}>Business Academy</p>
                  <h2 className="section-title" style={{ fontSize: 'clamp(24px, 3vw, 42px)', fontWeight: 900, letterSpacing: '-1px', marginBottom: 20 }}>Langa: your AI business mentor</h2>
                  <p style={{ color: 'var(--dim)', lineHeight: 1.7, fontSize: 16, marginBottom: 28 }}>
                    Langa knows your financials, your team, your clients — and meets you exactly where you are. Not generic advice: <em style={{ color: '#f1f5f9' }}>your next move, with your numbers</em>.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 32 }}>
                    {[
                      { icon: '📚', title: '200+ frameworks & books', desc: 'Built from African business classics + global playbooks. SA Labour Law, Ubuntu Leadership, Cash Flow Mastery.' },
                      { icon: '🎯', title: 'Knows your numbers', desc: 'Langa can see your own health score, revenue trend, and team pulse, so you are not re-explaining your business every time you ask something.' },
                      { icon: '🏆', title: 'Achievement system', desc: 'Earn badges as your business grows. Complete the Pricing Audit → unlock the Pitch Deck framework.' },
                      { icon: '🛤️', title: 'Formalisation reading', desc: 'For businesses getting ready to formalise — plain-language material on what registration and accreditation actually involve.' },
                    ].map(item => (
                      <div key={item.title} style={{ display: 'flex', gap: 14 }}>
                        <div style={{ fontSize: 20, flexShrink: 0, marginTop: 2 }}>{item.icon}</div>
                        <div>
                          <div style={{ fontWeight: 700, color: '#f1f5f9', marginBottom: 3, fontSize: 15 }}>{item.title}</div>
                          <div style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.55 }}>{item.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Link href="/demo" className="btn-orange" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '13px 24px', borderRadius: 12, fontWeight: 700, fontSize: 15, color: 'white', textDecoration: 'none' }}>
                    Ask Langa a question →
                  </Link>
                </div>
                {/* Right: Langa chat mockup */}
                <div style={{ background: '#0A1628', borderRadius: 20, padding: 24, border: '1px solid rgba(249,115,22,.2)', boxShadow: '0 24px 64px rgba(0,0,0,.5)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid rgba(255,255,255,.06)' }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg,#F97316,#a78bfa)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🦁</div>
                    <div>
                      <div style={{ fontWeight: 700, color: '#f1f5f9', fontSize: 14 }}>Langa</div>
                      <div style={{ fontSize: 11, color: '#22c55e' }}>● Online · knows your business</div>
                    </div>
                  </div>
                  {[
                    { from: 'user', msg: 'My revenue is up 18% but I\'m always short on cash. Why?' },
                    { from: 'langa', msg: 'Your revenue growth is outpacing your collections. Chase shows 74% collection rate this month vs 91% in April. You have R 38,500 sitting in outstanding invoices.\n\nI\'d suggest running a collections campaign today targeting the 3 clients overdue by 30+ days. Want me to draft the WhatsApp messages now?' },
                    { from: 'user', msg: 'Yes, and what framework covers cash flow management?' },
                    { from: 'langa', msg: '📚 I\'ll open **Profit First by Mike Michalowicz** — it\'s in your Academy library. Given your stage, the 5-account system will fix this in 90 days. Unlocking it for you now.' },
                  ].map((m, i) => (
                    <div key={i} style={{ marginBottom: 14, display: 'flex', flexDirection: m.from === 'user' ? 'row-reverse' : 'row', gap: 8 }}>
                      <div style={{ maxWidth: '80%', padding: '10px 14px', borderRadius: m.from === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px', background: m.from === 'user' ? 'rgba(249,115,22,.2)' : '#0f172a', border: m.from === 'user' ? '1px solid rgba(249,115,22,.3)' : '1px solid rgba(255,255,255,.06)', fontSize: 13, color: m.from === 'user' ? '#f1f5f9' : '#94a3b8', lineHeight: 1.55, whiteSpace: 'pre-line' }}>
                        {m.msg}
                      </div>
                    </div>
                  ))}
                  <div style={{ marginTop: 16, padding: '10px 14px', background: '#050B1A', borderRadius: 10, border: '1px solid rgba(255,255,255,.06)', fontSize: 13, color: '#334155', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>Ask Langa anything about your business…</span>
                    <span style={{ marginLeft: 'auto', fontSize: 18, cursor: 'pointer' }}>➤</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ── Add-on Power-Ups ────────────────────────────────────────── */}
          <section id="addons" className="max-w-7xl mx-auto px-6 py-24">
            <div style={{ textAlign: 'center', marginBottom: 56 }}>
              <p style={{ color: 'var(--orange)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 12 }}>Power-ups</p>
              <h2 style={{ fontSize: 'clamp(26px, 3.5vw, 46px)', fontWeight: 900, letterSpacing: '-1.5px', marginBottom: 14 }}>Extend your OS with add-ons</h2>
              <p style={{ color: 'var(--dim)', maxWidth: 440, margin: '0 auto', lineHeight: 1.65, fontSize: 16 }}>
                Available on all plans. Activate any add-on in one click — no setup, no developer needed.
              </p>
            </div>
            <div className="addons-grid">
              {addons.map((addon, i) => (
                <article key={addon.name} className="fu card" style={{ animationDelay: `${i * .1}s`, background: addon.cardBg, border: `1px solid ${addon.cardBorder}`, borderRadius: 20, padding: 28, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: addon.tagBg, border: `1px solid ${addon.tagBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{addon.icon}</div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 18 }}>{addon.name}</div>
                      <div style={{ fontSize: 11, padding: '2px 8px', borderRadius: 100, display: 'inline-block', marginTop: 2, background: addon.tagBg, border: `1px solid ${addon.tagBorder}`, color: addon.tagColor, fontWeight: 700 }}>{addon.tag}</div>
                    </div>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.7 }}>{addon.desc}</p>
                  <ul style={{ display: 'flex', flexDirection: 'column', gap: 7, flex: 1 }}>
                    {addon.bullets.map(b => (
                      <li key={b} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'rgba(255,255,255,.65)' }}>
                        <span style={{ color: addon.tagColor, fontWeight: 700, flexShrink: 0 }}>✓</span>{b}
                      </li>
                    ))}
                  </ul>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, paddingTop: 8, borderTop: `1px solid ${addon.tagBorder}` }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: addon.tagColor }}>{addon.price}</span>
                    <Link href="/signup" style={{ fontSize: 12, fontWeight: 700, color: addon.tagColor, textDecoration: 'none', background: addon.tagBg, border: `1px solid ${addon.tagBorder}`, padding: '5px 14px', borderRadius: 8, flexShrink: 0 }}>Add to plan →</Link>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {/* ── Ubuntu & Economic Liberation ────────────────────────────── */}
          <section style={{ background: 'rgba(167,139,250,.04)', borderTop: '1px solid rgba(167,139,250,.1)', borderBottom: '1px solid rgba(167,139,250,.1)', padding: '96px 24px' }}>
            <div className="max-w-6xl mx-auto">
              <div className="ubuntu-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }}>
                {/* Left: stats + message */}
                <div>
                  <p style={{ color: '#a78bfa', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 16 }}>Ubuntu OS</p>
                  <h2 className="section-title" style={{ fontSize: 'clamp(24px, 3vw, 40px)', fontWeight: 900, letterSpacing: '-1px', marginBottom: 20 }}>
                    Built by African women.<br/>
                    <span style={{ color: '#a78bfa' }}>For African businesses.</span>
                  </h2>
                  <p style={{ color: 'var(--dim)', lineHeight: 1.7, fontSize: 16, marginBottom: 32 }}>
                    International tools ignore informal economies, load-shedding, and B-BBEE. AdminOS is built from the ground up for the R76 billion stokvel economy and the 3.3 million township businesses that power South Africa.
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 32 }}>
                    {[
                      { val: 'R76B', label: 'Informal stokvel economy — built for how it already works' },
                      { val: '3.3M', label: 'Township businesses in SA needing tools built for them' },
                      { val: '68%', label: 'Women-owned businesses in AdminOS\'s target market' },
                      { val: '15min', label: 'Time to go live, even without IT support' },
                    ].map(({ val, label }) => (
                      <div key={val} style={{ padding: '16px', background: '#0A1628', borderRadius: 12, border: '1px solid rgba(167,139,250,.15)' }}>
                        <div style={{ fontSize: 24, fontWeight: 900, color: '#a78bfa', letterSpacing: '-1px', marginBottom: 4 }}>{val}</div>
                        <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.4 }}>{label}</div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Right: Ubuntu features list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {[
                    { icon: '🤝', title: 'Stokvel group records', desc: 'Keep track of who contributed what, whose turn is next, and where each member stands. Members handle the money between themselves — AdminOS keeps the book.' },
                    { icon: '📋', title: 'Formalisation checklist', desc: 'Work through the steps from unregistered business → CIPC registration → B-BBEE → SARS, and tick off what you have done.' },
                    { icon: '📊', title: 'B-BBEE evidence in one place', desc: 'Capture qualifying spend, employment equity data, and ownership as you go, so your verification agency is not a scramble.' },
                    { icon: '🌐', title: 'Community knowledge board', desc: 'Share supplier wins, client red flags, and pricing benchmarks with vetted local peers.' },
                    { icon: '👥', title: 'Peer mentorship network', desc: 'Match with experienced business owners in your sector through the AdminOS community.' },
                    { icon: '🔆', title: 'Load-shedding resilience', desc: 'Offline mode, SMS fallback for WhatsApp, and auto-reschedule reminders around Eskom schedules.' },
                  ].map(item => (
                    <div key={item.title} style={{ display: 'flex', gap: 14, padding: '16px', background: '#0A1628', borderRadius: 12, border: '1px solid rgba(167,139,250,.08)' }}>
                      <div style={{ fontSize: 22, flexShrink: 0, marginTop: 2 }}>{item.icon}</div>
                      <div>
                        <div style={{ fontWeight: 700, color: '#f1f5f9', marginBottom: 4, fontSize: 14 }}>{item.title}</div>
                        <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>{item.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* ── How it works ────────────────────────────────────────────── */}
          <section className="max-w-4xl mx-auto px-6 py-24 text-center">
            <p style={{ color: 'var(--orange)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 12 }}>Getting started</p>
            <h2 style={{ fontSize: 'clamp(26px, 3vw, 42px)', fontWeight: 800, letterSpacing: '-1px', marginBottom: 56 }}>Three steps to your workspace</h2>
            <div className="steps-grid">
              {[
                { step: '01', title: 'Connect your WhatsApp', desc: 'Link your existing number via Meta WhatsApp Cloud API. 3 minutes. No new SIM or number needed.' },
                { step: '02', title: 'Configure your agents', desc: 'Tell AdminOS about your business, products, pricing, and tone. AI handles the rest.' },
                { step: '03', title: 'Watch it work', desc: 'Agents respond to clients, chase invoices, and check in on staff while you focus on growth.' },
              ].map((item, i) => (
                <div key={item.step} className="fu" style={{ animationDelay: `${i * .1}s` }}>
                  <div style={{ fontSize: 72, fontWeight: 900, color: 'rgba(255,255,255,.04)', lineHeight: 1, marginBottom: 4 }}>{item.step}</div>
                  <h3 style={{ fontWeight: 700, color: '#fff', marginBottom: 8, fontSize: 16 }}>{item.title}</h3>
                  <p style={{ fontSize: 14, color: 'var(--dim)', lineHeight: 1.65 }}>{item.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── Africa-first ────────────────────────────────────────────── */}
          <section className="diagonal-top diagonal-btm" style={{ background: 'rgba(6,182,212,.04)', borderTop: '1px solid rgba(6,182,212,.08)', borderBottom: '1px solid rgba(6,182,212,.08)', padding: '96px 24px' }}>
            <div className="max-w-5xl mx-auto">
              <div style={{ textAlign: 'center', marginBottom: 48 }}>
                <h2 style={{ fontSize: 'clamp(24px, 3vw, 38px)', fontWeight: 800, letterSpacing: '-.5px', marginBottom: 12 }}>Designed for African realities</h2>
                <p style={{ color: 'var(--dim)', fontSize: 16 }}>International SaaS tools are built for Silicon Valley. AdminOS is built for yours.</p>
              </div>
              <div className="africa-grid">
                {[
                  { icon: '🔋', title: 'Load-shedding resilient', desc: "PWA with offline capability. Queued actions retry when power returns. WhatsApp bot stays live on Meta's infrastructure during outages." },
                  { icon: '🗣️', title: '11 SA languages', desc: "English, Zulu, Xhosa, Afrikaans, Setswana, Sesotho, and more. AI detects your customer's language and responds in kind — automatically." },
                  { icon: '🔒', title: 'Built for POPIA', desc: "Designed around South Africa's Protection of Personal Information Act — right-to-erasure, audit trail, per-tenant data isolation, and a compliance centre. Compliance is yours to determine; we build the tooling for it." },
                ].map((item) => (
                  <div key={item.title} className="card" style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 20, padding: 24 }}>
                    <div style={{ fontSize: 32, marginBottom: 12 }}>{item.icon}</div>
                    <h3 style={{ fontWeight: 700, color: 'var(--teal)', marginBottom: 8 }}>{item.title}</h3>
                    <p style={{ fontSize: 14, color: 'var(--dim)', lineHeight: 1.65 }}>{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── Industries ──────────────────────────────────────────────── */}
          <section style={{ borderBottom: '1px solid rgba(255,255,255,.05)', padding: '64px 24px' }}>
            <div className="max-w-5xl mx-auto text-center">
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--dimmer)', marginBottom: 28 }}>Built for South African industries</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 10 }}>
                {industries.map((ind, i) => (
                  <div key={ind} className="fi card" style={{ animationDelay: `${i * .04}s`, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 100, padding: '10px 20px', fontSize: 14, color: 'rgba(255,255,255,.55)', cursor: 'default' }}>
                    {ind}
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── Pricing ─────────────────────────────────────────────────── */}
          <section id="pricing" className="max-w-7xl mx-auto px-6 py-24">
            <div style={{ textAlign: 'center', marginBottom: 56 }}>
              <p style={{ color: 'var(--orange)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 12 }}>Pricing</p>
              <h2 style={{ fontSize: 'clamp(28px, 4vw, 50px)', fontWeight: 900, letterSpacing: '-2px', marginBottom: 12 }}>Simple, transparent pricing</h2>
              <p style={{ color: 'var(--dim)' }}>All prices in South African Rand. No hidden fees. Cancel anytime.</p>
            </div>

            <div className="pricing-grid">
              {pricingPlans.map((plan, i) => (
                <div
                  key={plan.name}
                  className={`fu ${!plan.highlight ? 'card' : ''}`}
                  style={{
                    animationDelay: `${i * .08}s`,
                    position: 'relative',
                    borderRadius: 20,
                    padding: 24,
                    display: 'flex',
                    flexDirection: 'column',
                    ...(plan.highlight
                      ? { background: 'linear-gradient(135deg, rgba(249,115,22,.2) 0%, rgba(249,115,22,.08) 100%)', border: '1px solid rgba(249,115,22,.45)', boxShadow: '0 0 60px rgba(249,115,22,.12), 0 20px 60px rgba(0,0,0,.3)' }
                      : { background: 'rgba(255,255,255,.025)', border: '1px solid rgba(255,255,255,.07)' }
                    ),
                  }}
                >
                  {plan.badge && (
                    <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: 'var(--orange)', color: 'white', fontSize: 10, fontWeight: 800, padding: '4px 14px', borderRadius: 100, whiteSpace: 'nowrap' }}>
                      {plan.badge}
                    </div>
                  )}
                  <div style={{ marginBottom: 20 }}>
                    <h3 style={{ fontWeight: 800, fontSize: 18 }}>{plan.name}</h3>
                    <p style={{ fontSize: 12, color: 'var(--dimmer)', marginTop: 2 }}>{plan.sub}</p>
                    <div style={{ fontSize: 40, fontWeight: 900, letterSpacing: '-2px', marginTop: 16, lineHeight: 1 }}>
                      {plan.price}
                      <span style={{ fontSize: 15, fontWeight: 400, color: 'var(--dimmer)' }}>/mo</span>
                    </div>
                  </div>
                  <ul style={{ flex: 1, marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 9 }}>
                    {plan.features.map((f) => (
                      <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: plan.highlight ? 'rgba(255,255,255,.8)' : 'var(--dim)' }}>
                        <span style={{ color: plan.highlight ? 'var(--orange)' : 'var(--teal)', flexShrink: 0, fontWeight: 700 }}>✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={plan.href}
                    {...(plan.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    style={{
                      display: 'block', textAlign: 'center', padding: '12px 16px', borderRadius: 12,
                      fontWeight: 700, fontSize: 14, textDecoration: 'none',
                      ...(plan.highlight
                        ? { background: 'var(--orange)', color: 'white' }
                        : { border: '1px solid rgba(255,255,255,.15)', color: 'rgba(255,255,255,.65)' }
                      ),
                    }}
                  >
                    {plan.cta}
                  </Link>
                </div>
              ))}
            </div>
            <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--dimmest)', marginTop: 24 }}>
              Annual billing available (save 2 months). Partner plan (R9,999/mo) for white-label resellers — <Link href="/contact" style={{ color: 'var(--dimmer)', textDecoration: 'underline' }}>contact us</Link>.
            </p>
          </section>

          {/* ── FAQ ─────────────────────────────────────────────────────── */}
          <section id="faq" style={{ background: 'rgba(255,255,255,.012)', borderTop: '1px solid rgba(255,255,255,.05)', borderBottom: '1px solid rgba(255,255,255,.05)', padding: '96px 24px' }}>
            <div className="max-w-3xl mx-auto">
              <div style={{ textAlign: 'center', marginBottom: 48 }}>
                <p style={{ color: 'var(--teal)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 12 }}>FAQ</p>
                <h2 style={{ fontSize: 'clamp(26px, 3vw, 42px)', fontWeight: 800, letterSpacing: '-1px' }}>Common questions</h2>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {faqs.map((faq) => (
                  <details key={faq.q} style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 16, overflow: 'hidden' }}>
                    <summary style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', cursor: 'pointer', listStyle: 'none', userSelect: 'none', fontWeight: 600, fontSize: 15 }}>
                      {faq.q}
                      <span style={{ color: 'var(--dimmer)', flexShrink: 0, marginLeft: 16, fontSize: 20, lineHeight: 1 }}>+</span>
                    </summary>
                    <div style={{ padding: '0 20px 18px' }}>
                      <p style={{ fontSize: 14, color: 'var(--dim)', lineHeight: 1.7 }}>{faq.a}</p>
                    </div>
                  </details>
                ))}
              </div>
            </div>
          </section>

          {/* ── Final CTA ───────────────────────────────────────────────── */}
          <section className="max-w-4xl mx-auto px-6 py-24 text-center">
            <div className="cta-inner" style={{ borderRadius: 28, border: '1px solid rgba(249,115,22,.2)', padding: '72px 48px', background: 'linear-gradient(135deg, rgba(249,115,22,.07) 0%, rgba(6,182,212,.05) 60%)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: '-50%', left: '50%', transform: 'translateX(-50%)', width: 500, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(249,115,22,.1) 0%, transparent 70%)', pointerEvents: 'none' }} />
              <h2 style={{ fontSize: 'clamp(28px, 4vw, 50px)', fontWeight: 900, letterSpacing: '-2px', marginBottom: 16, position: 'relative' }}>Your business OS is ready.</h2>
              <p style={{ color: 'var(--dim)', fontSize: 18, marginBottom: 36, lineHeight: 1.6, position: 'relative' }}>
                Join South African businesses saving time and money with AdminOS.<br />Try the demo first — no account, no commitment.
              </p>
              <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', position: 'relative' }}>
                <Link href="/demo" className="btn-demo" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '16px 32px', borderRadius: 14, fontWeight: 800, fontSize: 17, color: 'white', textDecoration: 'none' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><polygon points="5,3 19,12 5,21" fill="white"/></svg>
                  Try interactive demo
                </Link>
                <Link href="/signup" className="btn-orange" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '16px 32px', borderRadius: 14, fontWeight: 800, fontSize: 17, color: 'white', textDecoration: 'none' }}>
                  Start 14-day free trial →
                </Link>
              </div>
              <p style={{ fontSize: 13, color: 'var(--dimmest)', marginTop: 20, position: 'relative' }}>14-day free trial · No credit card · Built for POPIA</p>
            </div>
          </section>

        </main>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <footer style={{ borderTop: '1px solid rgba(255,255,255,.05)', padding: '48px 24px 32px' }}>
          <div className="max-w-7xl mx-auto">
            <div className="footer-grid" style={{ marginBottom: 40 }}>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--orange)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 11 }}>AO</div>
                  <span style={{ fontWeight: 700 }}>AdminOS</span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--dimmest)', lineHeight: 1.6 }}>
                  AI-powered business OS for South African SMEs. Built by Mirembe Muse (Pty) Ltd.
                </p>
              </div>

              <nav aria-label="Product">
                <p style={{ fontSize: 11, color: 'var(--dimmest)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 700, marginBottom: 12 }}>Product</p>
                <ul style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14, color: 'var(--dimmer)' }}>
                  {[['#agents', 'AI Agents'], ['#addons', 'Add-ons'], ['#pricing', 'Pricing'], ['/demo', 'Try Demo'], ['https://cal.com/nanda/adminos-demo', 'Book a demo']].map(([href, label]) => (
                    <li key={label}>
                      <a href={href} style={{ color: 'inherit', textDecoration: 'none' }} className="hover:text-white transition-colors" {...(href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{label}</a>
                    </li>
                  ))}
                </ul>
              </nav>

              <nav aria-label="Account">
                <p style={{ fontSize: 11, color: 'var(--dimmest)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 700, marginBottom: 12 }}>Account</p>
                <ul style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14, color: 'var(--dimmer)' }}>
                  {[['signup', 'Start free trial'], ['login', 'Sign in'], ['contact', 'Contact']].map(([href, label]) => (
                    <li key={label}><Link href={`/${href}`} style={{ color: 'inherit', textDecoration: 'none' }} className="hover:text-white transition-colors">{label}</Link></li>
                  ))}
                </ul>
              </nav>

              <nav aria-label="Legal">
                <p style={{ fontSize: 11, color: 'var(--dimmest)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 700, marginBottom: 12 }}>Legal</p>
                <ul style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14, color: 'var(--dimmer)' }}>
                  {[['privacy', 'Privacy Policy'], ['terms', 'Terms of Service'], ['privacy#popia', 'POPIA Compliance']].map(([href, label]) => (
                    <li key={label}><Link href={`/${href}`} style={{ color: 'inherit', textDecoration: 'none' }} className="hover:text-white transition-colors">{label}</Link></li>
                  ))}
                </ul>
              </nav>
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,.05)', paddingTop: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--dimmest)', marginBottom: 12 }}>
                <div style={{ width: 14, height: 14, borderRadius: '50%', background: 'var(--teal)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 8, fontWeight: 800, flexShrink: 0 }}>✓</div>
                <span>Built for POPIA · Reg. No. 2026-005658 · Information Officer: N. Kabali-Kagwa ·</span>
                <Link href="/privacy" style={{ color: 'inherit', textDecoration: 'none' }} className="hover:text-white transition-colors">Privacy Policy</Link>
              </div>
              <div className="footer-bottom" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <p style={{ fontSize: 12, color: 'var(--dimmest)' }}>© {new Date().getFullYear()} Mirembe Muse (Pty) Ltd · All rights reserved</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12, color: 'var(--dimmest)' }}>
                  <span>Powered by Claude AI</span>
                  <span>·</span>
                  <span>Built for Africa</span>
                  <span>·</span>
                  <a href="https://twitter.com/CreativelyNanda" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }} aria-label="Twitter / X">𝕏</a>
                </div>
              </div>
            </div>
          </div>
        </footer>

      </div>
    </>
  )
}
