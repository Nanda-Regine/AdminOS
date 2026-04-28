import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'AdminOS — The AI System That Runs Your Business',
  description:
    'AdminOS replaces your WhatsApp chaos, invoice chasing, HR tools, and business analyst with 5 AI agents running 24/7. Built for South African SMEs. R2,500/month.',
  alternates: { canonical: 'https://adminos.co.za' },
}

// ─── Data ───────────────────────────────────────────────────────────────────

const replacements = [
  { tool: 'WhatsApp Business Manager', cost: 'R1,200', agent: 'AI Inbox Agent (Alex)' },
  { tool: 'Debt collection service', cost: 'R2,500', agent: 'Debt Recovery Agent (Chase)' },
  { tool: 'HR check-in software', cost: 'R800', agent: 'Wellness Agent (Care)' },
  { tool: 'Xero accountant time', cost: 'R1,500', agent: 'Xero Integration' },
  { tool: 'Business analyst / reports', cost: 'R4,000', agent: 'Analytics Agent (Insight)' },
  { tool: 'Document processing (manual)', cost: 'R1,200', agent: 'Document Intelligence (Doc)' },
]

const agents = [
  {
    name: 'Alex',
    role: 'Inbox Agent',
    color: '#25D366',
    bgColor: 'rgba(37,211,102,0.08)',
    borderColor: 'rgba(37,211,102,0.25)',
    description:
      'Handles all WhatsApp conversations with clients around the clock. Answers FAQs, books appointments, escalates complex queries — in your customer\'s language.',
    metric: '80% of client messages handled without you',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="#25D366" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    name: 'Chase',
    role: 'Debt Recovery Agent',
    color: '#F59E0B',
    bgColor: 'rgba(245,158,11,0.08)',
    borderColor: 'rgba(245,158,11,0.25)',
    description:
      'Follows up on overdue invoices with escalating, professional messages. From friendly reminder to letter of demand — automated, never awkward, never forgotten.',
    metric: '60% faster average invoice settlement',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="#F59E0B" strokeWidth="2"/>
        <path d="M12 6v6l4 2" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    name: 'Care',
    role: 'Wellness Agent',
    color: '#14B8A6',
    bgColor: 'rgba(20,184,166,0.08)',
    borderColor: 'rgba(20,184,166,0.25)',
    description:
      'Regular AI-driven staff check-ins via WhatsApp. Identifies burnout signals early. Keeps your team feeling seen and supported between your 1:1s.',
    metric: 'Burnout caught before it costs you',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke="#14B8A6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    name: 'Doc',
    role: 'Document Intelligence',
    color: '#8B5CF6',
    bgColor: 'rgba(139,92,246,0.08)',
    borderColor: 'rgba(139,92,246,0.25)',
    description:
      'Upload contracts, quotes, invoices, reports. AI classifies, extracts key data, flags expiry dates, and auto-creates debtors from invoice data.',
    metric: '90% faster document processing',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <polyline points="14 2 14 8 20 8" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <line x1="16" y1="13" x2="8" y2="13" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round"/>
        <line x1="16" y1="17" x2="8" y2="17" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round"/>
        <polyline points="10 9 9 9 8 9" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    name: 'Insight',
    role: 'Analytics Agent',
    color: '#38BDF8',
    bgColor: 'rgba(56,189,248,0.08)',
    borderColor: 'rgba(56,189,248,0.25)',
    description:
      'Daily 05:00 AI business brief delivered every weekday. Revenue trends, debt aging, staff pulse, and growth opportunities — before your team starts.',
    metric: 'You see problems before they happen',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <line x1="18" y1="20" x2="18" y2="10" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round"/>
        <line x1="12" y1="20" x2="12" y2="4" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round"/>
        <line x1="6" y1="20" x2="6" y2="14" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
  },
]

const pricingPlans = [
  {
    name: 'Starter',
    price: 'R2,500',
    subtitle: '1–10 staff',
    features: [
      '1 WhatsApp number',
      '500 AI conversations/month',
      'Inbox + Debt Recovery agents',
      'Basic analytics dashboard',
      'POPIA compliance centre',
      'Email support',
    ],
    highlight: false,
    cta: 'Start free trial',
    href: '/signup',
  },
  {
    name: 'Growth',
    price: 'R4,500',
    subtitle: '11–50 staff',
    badge: 'MOST POPULAR',
    features: [
      '3 WhatsApp numbers',
      '5,000 AI conversations/month',
      'All 5 AI agents',
      'Xero integration',
      'Advanced analytics + daily brief',
      'Document intelligence',
      'Priority support',
    ],
    highlight: true,
    cta: 'Start free trial',
    href: '/signup',
  },
  {
    name: 'Enterprise',
    price: 'R8,500',
    subtitle: '50+ staff',
    features: [
      'Unlimited AI conversations',
      'Custom agent configuration',
      'Dedicated onboarding manager',
      'SLA guarantee',
      'Multi-location support',
      '2FA enforcement',
      'Custom integrations',
    ],
    highlight: false,
    cta: 'Book a demo',
    href: 'https://cal.com/nanda/adminos-demo',
  },
  {
    name: 'White Label',
    price: 'R14,999',
    subtitle: 'Accountants & resellers',
    features: [
      'Rebrand & resell as your own',
      'Manage 50+ SME clients',
      'Revenue share model',
      'Full whitelabel dashboard',
      'Partner onboarding support',
    ],
    highlight: false,
    cta: 'Contact us',
    href: '/contact',
  },
]

const faqs = [
  {
    q: 'We already use WhatsApp Business. Why do we need AdminOS?',
    a: "WhatsApp Business is a messaging tool. AdminOS adds 5 AI agents that respond, recover debt, check in on staff, process documents, and brief you every morning — automatically. It uses WhatsApp as the channel, not the tool.",
  },
  {
    q: "We're not a tech company. Is this hard to set up?",
    a: "Our 15-minute onboarding wizard walks you through everything. No coding. No IT support needed. Most businesses are live within the same day.",
  },
  {
    q: 'What happens to our data?',
    a: "Your data stays yours. We comply with POPIA (South Africa's Protection of Personal Information Act). You can export everything at any time. We use bank-grade encryption and row-level security on all business communications.",
  },
  {
    q: 'Does it integrate with our existing accounting software?',
    a: 'AdminOS integrates natively with Xero. Sage and QuickBooks integrations are on the roadmap.',
  },
  {
    q: 'Is there a lock-in contract?',
    a: 'No lock-in contracts. Monthly billing, cancel anytime. Enterprise clients can negotiate annual contracts at a 15% discount.',
  },
  {
    q: 'What if we need something custom?',
    a: 'Enterprise tier clients get custom agent configuration. We also offer bespoke builds — email hello@mirembemuse.co.za.',
  },
  {
    q: 'What kind of businesses use AdminOS?',
    a: 'Law firms, medical practices, NGOs, schools, logistics companies, retail stores, property companies — any South African SME with clients, staff, and invoices.',
  },
  {
    q: 'How does load-shedding affect AdminOS?',
    a: "AdminOS is a PWA with offline capability. Queued actions retry automatically when connectivity returns. Your WhatsApp bot stays live on Meta's infrastructure even during outages.",
  },
]

const industries = [
  '⚖️ Legal Firms',
  '🏥 Clinics',
  '🏫 Schools',
  '🏢 NGOs',
  '🛍️ Retail',
  '🏗️ Property',
  '🚚 Logistics',
  '🔧 Trades',
  '🏦 Financial Services',
  '🎓 Training Providers',
  '💊 Pharmacies',
  '🏠 Estate Agents',
]

const stats = [
  { value: '< 3s', label: 'WhatsApp response time' },
  { value: 'R11,200', label: 'Avg monthly toolstack replaced' },
  { value: '15 min', label: 'Time to go live' },
  { value: '11', label: 'SA languages supported' },
]

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'AdminOS',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web, Android, iOS',
  url: 'https://adminos.co.za',
  description: 'AI-powered business operating system for South African SMEs. 5 AI agents: WhatsApp automation, debt recovery, staff wellness, document intelligence, and daily AI business briefs.',
  author: { '@type': 'Organization', name: 'Mirembe Muse (Pty) Ltd', url: 'https://adminos.co.za' },
  offers: { '@type': 'AggregateOffer', priceCurrency: 'ZAR', lowPrice: '2500', highPrice: '14999', offerCount: '4' },
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <style>{`
        :root { --navy: #0A0F2C; --green: #25D366; --rose: #C4566A; }

        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(28px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(48px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50%       { transform: translateY(-14px) rotate(1deg); }
        }
        @keyframes orb1 {
          0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.5; }
          33%       { transform: translate(40px, -30px) scale(1.15); opacity: 0.7; }
          66%       { transform: translate(-25px, 25px) scale(0.9); opacity: 0.4; }
        }
        @keyframes orb2 {
          0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.4; }
          33%       { transform: translate(-35px, 25px) scale(1.1); opacity: 0.6; }
          66%       { transform: translate(30px, -20px) scale(0.85); opacity: 0.35; }
        }
        @keyframes msgAppear {
          from { opacity: 0; transform: translateY(10px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes typingDot {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30%            { transform: translateY(-5px); opacity: 1; }
        }
        @keyframes shimmerText {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes borderPulse {
          0%, 100% { border-color: rgba(37,211,102,0.3); }
          50%       { border-color: rgba(37,211,102,0.7); }
        }
        @keyframes countUp {
          from { opacity: 0; transform: scale(0.8); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes gridFade {
          from { opacity: 0; }
          to   { opacity: 0.04; }
        }

        .animate-fadeInUp  { animation: fadeInUp  0.7s cubic-bezier(.22,1,.36,1) both; }
        .animate-slideInRight { animation: slideInRight 0.8s cubic-bezier(.22,1,.36,1) both; }
        .animate-float     { animation: float 6s ease-in-out infinite; }
        .animate-orb1      { animation: orb1 12s ease-in-out infinite; }
        .animate-orb2      { animation: orb2 15s ease-in-out infinite; }
        .animate-fadeIn    { animation: fadeIn 0.6s ease both; }
        .animate-borderPulse { animation: borderPulse 2.5s ease-in-out infinite; }
        .animate-countUp   { animation: countUp 0.6s cubic-bezier(.22,1,.36,1) both; }
        .animate-gridFade  { animation: gridFade 1.2s ease both; }

        .msg-1  { animation: msgAppear 0.5s cubic-bezier(.22,1,.36,1) 0.8s both; }
        .msg-2  { animation: msgAppear 0.5s cubic-bezier(.22,1,.36,1) 2.0s both; }
        .msg-3  { animation: msgAppear 0.5s cubic-bezier(.22,1,.36,1) 3.4s both; }
        .msg-4  { animation: msgAppear 0.5s cubic-bezier(.22,1,.36,1) 4.6s both; }
        .typing { animation: msgAppear 0.4s cubic-bezier(.22,1,.36,1) 1.5s both; }
        .typing-hidden { animation: fadeIn 0s 3.2s both; display: none; }

        .dot-1 { animation: typingDot 1.2s ease-in-out 1.6s infinite; }
        .dot-2 { animation: typingDot 1.2s ease-in-out 1.8s infinite; }
        .dot-3 { animation: typingDot 1.2s ease-in-out 2.0s infinite; }

        .shimmer-text {
          background: linear-gradient(90deg, #fff 0%, #25D366 40%, #fff 60%, #fff 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: shimmerText 4s linear infinite;
        }

        .card-hover {
          transition: transform 0.25s cubic-bezier(.22,1,.36,1), border-color 0.25s ease, box-shadow 0.25s ease;
        }
        .card-hover:hover {
          transform: translateY(-4px);
          border-color: rgba(37,211,102,0.35) !important;
          box-shadow: 0 12px 40px rgba(37,211,102,0.08);
        }

        .grid-bg {
          background-image:
            linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px);
          background-size: 60px 60px;
        }

        .glass-nav {
          background: rgba(10,15,44,0.85);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }

        .pricing-card-highlight {
          background: linear-gradient(135deg, #1a5c3a 0%, #0d3d26 100%);
          border-color: rgba(37,211,102,0.5);
          box-shadow: 0 0 60px rgba(37,211,102,0.12), 0 20px 60px rgba(0,0,0,0.3);
        }

        .cta-primary {
          background: linear-gradient(135deg, #25D366 0%, #1da851 100%);
          box-shadow: 0 4px 24px rgba(37,211,102,0.35);
          transition: all 0.2s cubic-bezier(.22,1,.36,1);
        }
        .cta-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 36px rgba(37,211,102,0.5);
          background: linear-gradient(135deg, #30e070 0%, #25D366 100%);
        }

        .cta-secondary {
          border: 1px solid rgba(255,255,255,0.18);
          background: rgba(255,255,255,0.04);
          transition: all 0.2s ease;
        }
        .cta-secondary:hover {
          background: rgba(255,255,255,0.08);
          border-color: rgba(255,255,255,0.3);
        }

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; }
        }
      `}</style>

      <div style={{ background: '#0A0F2C', minHeight: '100vh', color: 'white' }}>

        {/* ─── Navigation ─────────────────────────────────────────────── */}
        <header className="sticky top-0 z-50 glass-nav">
          <nav className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <div style={{ background: 'linear-gradient(135deg, #25D366, #1da851)', width: 32, height: 32, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, letterSpacing: '-0.5px' }}>
                AO
              </div>
              <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: '-0.5px' }}>AdminOS</span>
            </div>

            <div className="hidden md:flex items-center gap-8 text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
              <a href="#agents" className="hover:text-white transition-colors">Agents</a>
              <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
              <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
              <Link href="/contact" className="hover:text-white transition-colors">Contact</Link>
            </div>

            <div className="flex items-center gap-3">
              <Link href="/login" className="text-sm hidden sm:block transition-colors" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Sign in
              </Link>
              <Link href="https://cal.com/nanda/adminos-demo" target="_blank" rel="noopener noreferrer"
                className="text-sm px-4 py-2 rounded-lg font-semibold hidden sm:block cta-secondary text-white">
                Book demo
              </Link>
              <Link href="/signup" className="text-sm px-4 py-2 rounded-lg font-bold text-white cta-primary">
                Free trial
              </Link>
            </div>
          </nav>
        </header>

        <main>
          {/* ─── Hero ─────────────────────────────────────────────────── */}
          <section className="relative overflow-hidden" style={{ padding: '100px 24px 80px' }}>
            {/* Animated background orbs */}
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
              <div className="animate-orb1" style={{
                position: 'absolute', top: '-10%', left: '-5%',
                width: 700, height: 700, borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(37,211,102,0.12) 0%, transparent 70%)',
                filter: 'blur(40px)',
              }} />
              <div className="animate-orb2" style={{
                position: 'absolute', bottom: '-20%', right: '-10%',
                width: 600, height: 600, borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(196,86,106,0.1) 0%, transparent 70%)',
                filter: 'blur(50px)',
              }} />
              <div className="animate-orb1 grid-bg animate-gridFade" style={{
                position: 'absolute', inset: 0,
                animationDelay: '0.5s',
              }} />
            </div>

            <div className="max-w-7xl mx-auto relative" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }}>
              {/* Left — Copy */}
              <div>
                <div className="animate-fadeInUp" style={{ animationDelay: '0.1s', display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.25)', borderRadius: 100, padding: '6px 16px', fontSize: 13, color: '#25D366', marginBottom: 28 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#25D366', display: 'inline-block', animation: 'typingDot 2s ease-in-out infinite' }} />
                  Built for South African Business · POPIA Compliant
                </div>

                <h1 className="animate-fadeInUp" style={{ animationDelay: '0.2s', fontSize: 'clamp(40px, 5vw, 68px)', fontWeight: 900, lineHeight: 1.04, letterSpacing: '-2px', marginBottom: 20 }}>
                  Your business
                  <br />
                  <span className="shimmer-text">runs itself.</span>
                </h1>

                <p className="animate-fadeInUp" style={{ animationDelay: '0.3s', fontSize: 18, lineHeight: 1.65, color: 'rgba(255,255,255,0.55)', marginBottom: 12, maxWidth: 480 }}>
                  5 AI agents handle WhatsApp, debt recovery, staff wellness, documents, and daily insights — 24/7, in your language, from R2,500/month.
                </p>

                <p className="animate-fadeInUp" style={{ animationDelay: '0.35s', fontSize: 14, color: 'rgba(245,158,11,0.9)', fontWeight: 600, marginBottom: 32 }}>
                  Average client saves <strong style={{ color: '#F59E0B' }}>R8,400/month</strong> in replaced software subscriptions.
                </p>

                <div className="animate-fadeInUp" style={{ animationDelay: '0.45s', display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
                  <Link href="/signup" className="cta-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 28px', borderRadius: 14, fontWeight: 800, fontSize: 16, color: 'white', textDecoration: 'none' }}>
                    Start 14-day free trial
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </Link>
                  <Link href="https://cal.com/nanda/adminos-demo" target="_blank" rel="noopener noreferrer" className="cta-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 28px', borderRadius: 14, fontWeight: 600, fontSize: 16, color: 'rgba(255,255,255,0.8)', textDecoration: 'none' }}>
                    Book a demo
                  </Link>
                </div>

                <p className="animate-fadeInUp" style={{ animationDelay: '0.5s', fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>
                  No credit card · Live in 15 minutes · Cancel anytime
                </p>
              </div>

              {/* Right — WhatsApp Mockup */}
              <div className="animate-slideInRight hidden md:flex" style={{ animationDelay: '0.4s', justifyContent: 'center' }}>
                <div className="animate-float" style={{ animationDelay: '1s' }}>
                  {/* Phone frame */}
                  <div style={{
                    width: 320, background: '#111827', borderRadius: 32,
                    border: '2px solid rgba(255,255,255,0.08)',
                    boxShadow: '0 40px 100px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)',
                    overflow: 'hidden',
                  }}>
                    {/* Status bar */}
                    <div style={{ background: '#075E54', padding: '10px 16px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #25D366, #1da851)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13 }}>
                        A
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, letterSpacing: '-0.2px' }}>Alex · AdminOS</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#25D366', display: 'inline-block' }} />
                          Online
                        </div>
                      </div>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="1" fill="rgba(255,255,255,0.6)"/><circle cx="19" cy="12" r="1" fill="rgba(255,255,255,0.6)"/><circle cx="5" cy="12" r="1" fill="rgba(255,255,255,0.6)"/></svg>
                    </div>

                    {/* Chat area */}
                    <div style={{ background: '#0d1117', padding: '16px 12px 20px', minHeight: 380, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {/* Client message */}
                      <div className="msg-1" style={{ display: 'flex', justifyContent: 'flex-start' }}>
                        <div style={{ background: '#1f2937', padding: '8px 12px', borderRadius: '12px 12px 12px 4px', maxWidth: '80%', fontSize: 13, lineHeight: 1.5, color: 'rgba(255,255,255,0.85)' }}>
                          Hey, Thabo still hasn&apos;t paid his invoice from March 😤
                          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 4, textAlign: 'right' }}>09:14</div>
                        </div>
                      </div>

                      {/* Typing indicator */}
                      <div className="typing" style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <div style={{ background: '#075E54', padding: '10px 14px', borderRadius: '12px 12px 4px 12px', display: 'flex', gap: 4, alignItems: 'center' }}>
                          <span className="dot-1" style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.8)', display: 'inline-block' }} />
                          <span className="dot-2" style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.8)', display: 'inline-block' }} />
                          <span className="dot-3" style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.8)', display: 'inline-block' }} />
                        </div>
                      </div>

                      {/* Alex response */}
                      <div className="msg-2" style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <div style={{ background: '#075E54', padding: '8px 12px', borderRadius: '12px 12px 4px 12px', maxWidth: '80%', fontSize: 13, lineHeight: 1.5 }}>
                          On it. Sending Thabo a professional reminder now. I&apos;ll escalate in 3 days if no response. 📋
                          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 4, textAlign: 'right', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 3 }}>
                            09:14
                            <svg width="12" height="8" viewBox="0 0 16 10" fill="none"><path d="M1 5l3 3 5-5M6 5l3 3 5-5" stroke="#25D366" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </div>
                        </div>
                      </div>

                      {/* System notice */}
                      <div className="msg-3" style={{ textAlign: 'center' }}>
                        <span style={{ background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.2)', borderRadius: 100, padding: '4px 12px', fontSize: 11, color: '#25D366' }}>
                          ✓ Chase agent activated · Invoice R8,400
                        </span>
                      </div>

                      {/* Client reply */}
                      <div className="msg-4" style={{ display: 'flex', justifyContent: 'flex-start' }}>
                        <div style={{ background: '#1f2937', padding: '8px 12px', borderRadius: '12px 12px 12px 4px', maxWidth: '80%', fontSize: 13, lineHeight: 1.5, color: 'rgba(255,255,255,0.85)' }}>
                          Amazing 🙌 Also book a quote for Sipho at 2pm Friday?
                          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 4, textAlign: 'right' }}>09:16</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ─── Stats bar ────────────────────────────────────────────── */}
          <section style={{ borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)', padding: '48px 24px' }}>
            <div className="max-w-4xl mx-auto">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 32, textAlign: 'center' }}>
                {stats.map((stat, i) => (
                  <div key={stat.label} className="animate-countUp" style={{ animationDelay: `${i * 0.1}s` }}>
                    <div style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 900, color: '#25D366', letterSpacing: '-1px', lineHeight: 1 }}>
                      {stat.value}
                    </div>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 8, lineHeight: 1.3 }}>{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ─── ROI table ────────────────────────────────────────────── */}
          <section className="max-w-5xl mx-auto px-6 py-24">
            <div style={{ textAlign: 'center', marginBottom: 48 }}>
              <p style={{ color: '#25D366', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Return on investment</p>
              <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, letterSpacing: '-1px', marginBottom: 16 }}>Replace R11,200/month<br />with one platform</h2>
              <p style={{ color: 'rgba(255,255,255,0.5)', maxWidth: 480, margin: '0 auto', lineHeight: 1.6 }}>
                AdminOS Growth at <strong style={{ color: 'white' }}>R4,500/month</strong> replaces over <strong style={{ color: '#F59E0B' }}>R11,200/month</strong> in tools, services, and admin time.
              </p>
            </div>

            <div style={{ borderRadius: 20, border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', background: 'rgba(255,255,255,0.04)', padding: '12px 24px' }}>
                {['What you pay for now', 'Monthly cost', 'Replaced by'].map((h, i) => (
                  <span key={h} style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, textAlign: i === 1 ? 'center' : i === 2 ? 'right' : 'left' }}>{h}</span>
                ))}
              </div>
              {replacements.map((row, i) => (
                <div key={row.tool} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '16px 24px', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.2s' }}>
                  <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>{row.tool}</span>
                  <span style={{ textAlign: 'center', fontSize: 14, fontWeight: 700, color: '#F87171', textDecoration: 'line-through' }}>{row.cost}</span>
                  <span style={{ textAlign: 'right', fontSize: 14, color: '#25D366' }}>{row.agent}</span>
                </div>
              ))}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '16px 24px', alignItems: 'center', background: 'rgba(37,211,102,0.06)', borderTop: '1px solid rgba(37,211,102,0.15)' }}>
                <span style={{ fontWeight: 800, color: 'white' }}>Total saved</span>
                <span style={{ textAlign: 'center', fontWeight: 800, color: '#F87171', textDecoration: 'line-through' }}>R11,200/mo</span>
                <span style={{ textAlign: 'right', fontWeight: 800, color: '#25D366' }}>AdminOS Growth: R4,500/mo</span>
              </div>
            </div>
            <p style={{ textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,0.25)', marginTop: 16 }}>ROI from month one. No setup cost on Growth and Enterprise tiers.</p>
          </section>

          {/* ─── 5 AI Agents ──────────────────────────────────────────── */}
          <section id="agents" style={{ background: 'rgba(255,255,255,0.015)', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '96px 24px' }}>
            <div className="max-w-7xl mx-auto">
              <div style={{ textAlign: 'center', marginBottom: 56 }}>
                <p style={{ color: '#25D366', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Your AI team</p>
                <h2 style={{ fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 800, letterSpacing: '-1.5px', marginBottom: 16 }}>5 agents. Always on.</h2>
                <p style={{ color: 'rgba(255,255,255,0.45)', maxWidth: 420, margin: '0 auto', lineHeight: 1.6, fontSize: 16 }}>
                  Each agent has a name, a job, and a target. Together they run your operations without being asked.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
                {agents.map((agent, i) => (
                  <article
                    key={agent.name}
                    className="animate-fadeInUp card-hover"
                    style={{
                      animationDelay: `${i * 0.08}s`,
                      background: agent.bgColor,
                      border: `1px solid ${agent.borderColor}`,
                      borderRadius: 20,
                      padding: 24,
                      cursor: 'default',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: `${agent.bgColor}`, border: `1px solid ${agent.borderColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {agent.icon}
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.5px' }}>{agent.name}</div>
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>{agent.role}</div>
                      </div>
                    </div>
                    <p style={{ fontSize: 14, lineHeight: 1.65, color: 'rgba(255,255,255,0.55)', marginBottom: 16 }}>{agent.description}</p>
                    <div style={{ background: 'rgba(0,0,0,0.2)', border: `1px solid ${agent.borderColor}`, borderRadius: 10, padding: '8px 12px' }}>
                      <p style={{ fontSize: 12, color: agent.color, fontWeight: 600 }}>📈 {agent.metric}</p>
                    </div>
                  </article>
                ))}

                {/* 6th card — Africa-first */}
                <article className="animate-fadeInUp card-hover" style={{
                  animationDelay: `${agents.length * 0.08}s`,
                  background: 'linear-gradient(135deg, rgba(196,86,106,0.08) 0%, rgba(10,15,44,0.5) 100%)',
                  border: '1px solid rgba(196,86,106,0.2)',
                  borderRadius: 20,
                  padding: 24,
                }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>⚡</div>
                  <h3 style={{ fontWeight: 800, fontSize: 18, marginBottom: 8 }}>Built for Africa</h3>
                  <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 1.65, marginBottom: 16 }}>
                    Load-shedding resilient PWA. 11 SA languages. POPIA compliant. Claude AI with prompt caching for sub-second responses.
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {['PWA Offline', '11 Languages', 'POPIA', 'Claude AI', 'Sub-second'].map((tag) => (
                      <span key={tag} style={{ fontSize: 11, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 100, padding: '3px 10px', color: 'rgba(255,255,255,0.5)' }}>{tag}</span>
                    ))}
                  </div>
                </article>
              </div>
            </div>
          </section>

          {/* ─── How it works ─────────────────────────────────────────── */}
          <section className="max-w-4xl mx-auto px-6 py-24 text-center">
            <p style={{ color: '#25D366', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Getting started</p>
            <h2 style={{ fontSize: 'clamp(26px, 3vw, 40px)', fontWeight: 800, letterSpacing: '-1px', marginBottom: 56 }}>Live in 15 minutes</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 32 }}>
              {[
                { step: '01', title: 'Connect your WhatsApp', desc: 'Link your business number via Meta Business API. Takes 3 minutes. No new number needed.' },
                { step: '02', title: 'Configure your agents', desc: 'Tell AdminOS about your business, products, pricing, and tone. The AI handles the rest.' },
                { step: '03', title: 'Watch it work', desc: 'Your AI agents respond to clients, chase invoices, and check in on staff while you focus on growth.' },
              ].map((item, i) => (
                <div key={item.step} className="animate-fadeInUp" style={{ animationDelay: `${i * 0.1}s` }}>
                  <div style={{ fontSize: 64, fontWeight: 900, color: 'rgba(255,255,255,0.04)', lineHeight: 1, marginBottom: 8 }}>{item.step}</div>
                  <h3 style={{ fontWeight: 700, color: 'white', marginBottom: 8 }}>{item.title}</h3>
                  <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', lineHeight: 1.65 }}>{item.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ─── Africa-First ─────────────────────────────────────────── */}
          <section style={{ background: 'rgba(37,211,102,0.03)', borderTop: '1px solid rgba(37,211,102,0.08)', borderBottom: '1px solid rgba(37,211,102,0.08)', padding: '80px 24px' }}>
            <div className="max-w-5xl mx-auto">
              <div style={{ textAlign: 'center', marginBottom: 48 }}>
                <h2 style={{ fontSize: 'clamp(24px, 3vw, 36px)', fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 12 }}>Designed for African realities</h2>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 16 }}>International SaaS tools are built for Silicon Valley problems. AdminOS is built for yours.</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
                {[
                  { icon: '🔋', title: 'Load-shedding resilient', desc: "PWA with offline capability. Queued actions retry when power returns. Your WhatsApp bot stays live on Meta's infrastructure during outages." },
                  { icon: '🗣️', title: '11 SA languages', desc: "English, Zulu, Xhosa, Afrikaans, Setswana, Sesotho, and more. AI detects your customer's language and responds in kind — automatically." },
                  { icon: '🔒', title: 'POPIA compliant', desc: "Built with South Africa's Protection of Personal Information Act. Right-to-erasure API, immutable audit trail, RLS enforcement, full compliance centre." },
                ].map((item) => (
                  <div key={item.title} className="card-hover" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 20, padding: 24 }}>
                    <div style={{ fontSize: 32, marginBottom: 12 }}>{item.icon}</div>
                    <h3 style={{ fontWeight: 700, color: '#25D366', marginBottom: 8 }}>{item.title}</h3>
                    <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', lineHeight: 1.65 }}>{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ─── Industries ───────────────────────────────────────────── */}
          <section style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '64px 24px' }}>
            <div className="max-w-5xl mx-auto text-center">
              <h2 style={{ fontSize: 22, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 32 }}>Trusted across South African industries</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 10 }}>
                {industries.map((ind, i) => (
                  <div key={ind} className="animate-fadeIn card-hover" style={{
                    animationDelay: `${i * 0.05}s`,
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 100,
                    padding: '10px 20px',
                    fontSize: 14,
                    color: 'rgba(255,255,255,0.6)',
                    cursor: 'default',
                  }}>
                    {ind}
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ─── Pricing ──────────────────────────────────────────────── */}
          <section id="pricing" className="max-w-7xl mx-auto px-6 py-24">
            <div style={{ textAlign: 'center', marginBottom: 56 }}>
              <p style={{ color: '#25D366', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Pricing</p>
              <h2 style={{ fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 800, letterSpacing: '-1.5px', marginBottom: 12 }}>Simple, transparent pricing</h2>
              <p style={{ color: 'rgba(255,255,255,0.4)' }}>All prices in South African Rand. No hidden fees. Cancel anytime.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
              {pricingPlans.map((plan, i) => (
                <div
                  key={plan.name}
                  className={`animate-fadeInUp ${plan.highlight ? '' : 'card-hover'}`}
                  style={{
                    animationDelay: `${i * 0.08}s`,
                    position: 'relative',
                    borderRadius: 20,
                    padding: 24,
                    display: 'flex',
                    flexDirection: 'column',
                    ...(plan.highlight
                      ? { background: 'linear-gradient(135deg, #1a5c3a 0%, #0d3d26 100%)', border: '1px solid rgba(37,211,102,0.5)', boxShadow: '0 0 60px rgba(37,211,102,0.12), 0 20px 60px rgba(0,0,0,0.3)' }
                      : { background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }
                    ),
                  }}
                >
                  {plan.badge && (
                    <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: '#F59E0B', color: '#0A0F2C', fontSize: 10, fontWeight: 800, padding: '4px 12px', borderRadius: 100, whiteSpace: 'nowrap' }}>
                      {plan.badge}
                    </div>
                  )}
                  <div style={{ marginBottom: 20 }}>
                    <h3 style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.3px' }}>{plan.name}</h3>
                    <p style={{ fontSize: 12, color: plan.highlight ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.35)', marginTop: 2 }}>{plan.subtitle}</p>
                    <div style={{ fontSize: 40, fontWeight: 900, letterSpacing: '-2px', marginTop: 16, lineHeight: 1 }}>
                      {plan.price}
                      <span style={{ fontSize: 15, fontWeight: 400, color: plan.highlight ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.3)' }}>/mo</span>
                    </div>
                  </div>
                  <ul style={{ flex: 1, marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {plan.features.map((f) => (
                      <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: plan.highlight ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.5)' }}>
                        <span style={{ color: '#25D366', flexShrink: 0, marginTop: 1, fontWeight: 700 }}>✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={plan.href}
                    {...(plan.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    style={{
                      display: 'block',
                      textAlign: 'center',
                      padding: '12px 16px',
                      borderRadius: 12,
                      fontWeight: 700,
                      fontSize: 14,
                      textDecoration: 'none',
                      transition: 'all 0.2s ease',
                      ...(plan.highlight
                        ? { background: 'white', color: '#0d3d26' }
                        : { border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)' }
                      ),
                    }}
                  >
                    {plan.cta}
                  </Link>
                </div>
              ))}
            </div>
            <p style={{ textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,0.25)', marginTop: 24 }}>
              Annual billing available at 15% discount. Onboarding support R5,000–R15,000 (optional).
            </p>
          </section>

          {/* ─── FAQ ──────────────────────────────────────────────────── */}
          <section id="faq" style={{ background: 'rgba(255,255,255,0.015)', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '96px 24px' }}>
            <div className="max-w-3xl mx-auto">
              <div style={{ textAlign: 'center', marginBottom: 48 }}>
                <p style={{ color: '#25D366', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>FAQ</p>
                <h2 style={{ fontSize: 'clamp(26px, 3vw, 40px)', fontWeight: 800, letterSpacing: '-1px' }}>Common questions</h2>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {faqs.map((faq) => (
                  <details
                    key={faq.q}
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden' }}
                  >
                    <summary style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', cursor: 'pointer', listStyle: 'none', userSelect: 'none', fontWeight: 600, fontSize: 15 }}>
                      {faq.q}
                      <span style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0, marginLeft: 16, fontSize: 20, lineHeight: 1 }}>+</span>
                    </summary>
                    <div style={{ padding: '0 20px 18px' }}>
                      <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>{faq.a}</p>
                    </div>
                  </details>
                ))}
              </div>
            </div>
          </section>

          {/* ─── Final CTA ────────────────────────────────────────────── */}
          <section className="max-w-4xl mx-auto px-6 py-24 text-center">
            <div style={{
              borderRadius: 28,
              border: '1px solid rgba(37,211,102,0.2)',
              padding: '72px 48px',
              background: 'linear-gradient(135deg, rgba(37,211,102,0.07) 0%, rgba(10,15,44,0.5) 60%)',
              position: 'relative',
              overflow: 'hidden',
            }}>
              {/* Glow */}
              <div style={{ position: 'absolute', top: '-50%', left: '50%', transform: 'translateX(-50%)', width: 500, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(37,211,102,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />

              <h2 style={{ fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 900, letterSpacing: '-1.5px', marginBottom: 16, position: 'relative' }}>
                Your business OS is ready.
              </h2>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 18, marginBottom: 36, lineHeight: 1.6, position: 'relative' }}>
                Join South African businesses already saving time and money with AdminOS.<br />Start free — no credit card, no commitment.
              </p>
              <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', position: 'relative' }}>
                <Link href="/signup" className="cta-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '16px 32px', borderRadius: 14, fontWeight: 800, fontSize: 17, color: 'white', textDecoration: 'none' }}>
                  Start 14-day free trial →
                </Link>
                <Link href="https://cal.com/nanda/adminos-demo" target="_blank" rel="noopener noreferrer" className="cta-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '16px 32px', borderRadius: 14, fontWeight: 600, fontSize: 17, color: 'rgba(255,255,255,0.75)', textDecoration: 'none' }}>
                  Book a 20-min demo
                </Link>
              </div>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.2)', marginTop: 20, position: 'relative' }}>14-day free trial · Live in 15 minutes · POPIA compliant</p>
            </div>
          </section>
        </main>

        {/* ─── Footer ───────────────────────────────────────────────── */}
        <footer style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '48px 24px 32px' }}>
          <div className="max-w-7xl mx-auto">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 32, marginBottom: 40 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, #25D366, #1da851)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 11 }}>AO</div>
                  <span style={{ fontWeight: 700 }}>AdminOS</span>
                </div>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', lineHeight: 1.6 }}>
                  AI-powered business OS for South African SMEs. Built by Mirembe Muse (Pty) Ltd.
                </p>
              </div>

              <nav aria-label="Product">
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 12 }}>Product</p>
                <ul style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>
                  {[['#agents', 'AI Agents'], ['#pricing', 'Pricing'], ['#faq', 'FAQ'], ['https://cal.com/nanda/adminos-demo', 'Book a demo']].map(([href, label]) => (
                    <li key={label}><a href={href} style={{ color: 'inherit', textDecoration: 'none' }} className="hover:text-white transition-colors" {...(href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{label}</a></li>
                  ))}
                </ul>
              </nav>

              <nav aria-label="Account">
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 12 }}>Account</p>
                <ul style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>
                  {[['signup', 'Start free trial'], ['login', 'Sign in'], ['contact', 'Contact']].map(([href, label]) => (
                    <li key={label}><Link href={`/${href}`} style={{ color: 'inherit', textDecoration: 'none' }} className="hover:text-white transition-colors">{label}</Link></li>
                  ))}
                </ul>
              </nav>

              <nav aria-label="Legal">
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 12 }}>Legal</p>
                <ul style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>
                  {[['privacy', 'Privacy Policy'], ['terms', 'Terms of Service'], ['privacy#popia', 'POPIA Compliance']].map(([href, label]) => (
                    <li key={label}><Link href={`/${href}`} style={{ color: 'inherit', textDecoration: 'none' }} className="hover:text-white transition-colors">{label}</Link></li>
                  ))}
                </ul>
              </nav>
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 20 }}>
              {/* POPIA badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'rgba(255,255,255,0.3)', marginBottom: 12 }}>
                <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 8, fontWeight: 800, flexShrink: 0 }}>✓</div>
                <span>POPIA Compliant · Reg. No. 2026-005658 · Information Officer: N. Kabali-Kagwa</span>
                <span>·</span>
                <Link href="/privacy" style={{ color: 'inherit', textDecoration: 'none' }} className="hover:text-white transition-colors">Privacy Policy</Link>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>
                  © {new Date().getFullYear()} Mirembe Muse (Pty) Ltd · All rights reserved
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>
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
