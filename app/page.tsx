import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'AdminOS — AI Business OS for South African SMEs',
  description:
    'AdminOS replaces your WhatsApp chaos, invoice chasing, HR tools, and business analyst with 5 AI agents running 24/7. Built for South African SMEs, NGOs, schools, and clinics. R2,500/month.',
  alternates: {
    canonical: 'https://adminos.co.za',
  },
}

const replacements = [
  { tool: 'WhatsApp Business Manager', cost: 'R1,200/mo', agent: 'AI Inbox Agent (Alex)' },
  { tool: 'Debt collection service', cost: 'R2,500/mo', agent: 'AI Debt Recovery Agent (Chase)' },
  { tool: 'HR check-in software', cost: 'R800/mo', agent: 'AI Wellness Agent (Care)' },
  { tool: 'Xero accountant time', cost: 'R1,500/mo', agent: 'Xero Integration' },
  { tool: 'Business analyst', cost: 'R4,000/mo', agent: 'AI Analytics Agent (Insight)' },
  { tool: 'Document processing (manual)', cost: 'R1,200/mo', agent: 'Document Intelligence (Doc)' },
]

const agents = [
  {
    name: 'Alex',
    role: 'Inbox Agent',
    icon: '📥',
    color: 'emerald',
    description:
      'Handles WhatsApp conversations with clients around the clock. Answers FAQs, books appointments, escalates complex queries to you — in your customer\'s language.',
    metric: 'Handles 80% of client messages without you',
  },
  {
    name: 'Chase',
    role: 'Debt Recovery Agent',
    icon: '💰',
    color: 'amber',
    description:
      'Automatically follows up on overdue invoices with escalating, professional messages. Never awkward. Never forgets. From friendly reminder to letter of demand.',
    metric: '60% faster average invoice payment',
  },
  {
    name: 'Care',
    role: 'Wellness Agent',
    icon: '🌿',
    color: 'teal',
    description:
      'Regular AI-driven staff check-ins via WhatsApp. Identifies burnout signals early. Keeps your team feeling seen and supported between your 1:1s.',
    metric: 'Burnout signals caught before they escalate',
  },
  {
    name: 'Doc',
    role: 'Document Intelligence',
    icon: '📄',
    color: 'violet',
    description:
      'Upload contracts, quotes, invoices, and reports. AI classifies, extracts key data, flags expiry dates, and creates debtors automatically from invoice data.',
    metric: '90% faster document processing',
  },
  {
    name: 'Insight',
    role: 'Analytics Agent',
    icon: '📊',
    color: 'sky',
    description:
      'Daily 05:00 AI business brief delivered to your dashboard every weekday. Revenue trends, debt aging, staff pulse, and growth opportunities — before your team starts.',
    metric: 'You see problems before they happen',
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
  },
  {
    name: 'Growth',
    price: 'R4,500',
    subtitle: '11–50 staff · Most popular',
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
  },
  {
    name: 'Enterprise',
    price: 'R8,500',
    subtitle: '50+ staff',
    features: [
      'Unlimited everything',
      'Custom AI agent config',
      'Dedicated onboarding',
      'SLA guarantee',
      'Multi-location support',
      '2FA enforcement',
      'Custom integrations',
    ],
    highlight: false,
    cta: 'Book a demo',
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
  },
]

const faqs = [
  {
    q: 'We already use WhatsApp Business. Why do we need AdminOS?',
    a: "WhatsApp Business is a messaging tool. AdminOS adds 5 AI agents that respond, recover debt, check in on staff, process documents, and brief you every morning — automatically. It uses WhatsApp as the channel, not the tool.",
  },
  {
    q: "We're not a tech company. Is this hard to set up?",
    a: "Our 15-minute onboarding wizard walks you through everything. No coding. No IT support needed. Most businesses are operational within the same day.",
  },
  {
    q: 'What happens to our data?',
    a: "Your data stays yours. We comply with POPIA (South Africa's Protection of Personal Information Act). You can export everything at any time. We use bank-grade encryption on all business communications.",
  },
  {
    q: 'Does it integrate with our existing accounting software?',
    a: 'AdminOS integrates natively with Xero. Additional integrations (Sage, QuickBooks) are on the roadmap for later this year.',
  },
  {
    q: 'Is there a contract?',
    a: 'No lock-in contracts. Monthly billing, cancel any time. Enterprise clients can negotiate annual contracts with a 15% discount.',
  },
  {
    q: 'What if we need something custom?',
    a: 'Enterprise tier clients get custom agent configuration. We also offer bespoke builds through our client services — email hello@mirembemuse.co.za.',
  },
  {
    q: 'What kind of businesses use AdminOS?',
    a: 'Carpentry businesses, law firms, medical practices, NGOs, schools, logistics companies, retail stores — any South African SME with clients, staff, and invoices.',
  },
  {
    q: 'How does load-shedding affect AdminOS?',
    a: "AdminOS is built as a PWA with offline capability. Queued actions retry automatically when connectivity returns. Your WhatsApp bot stays live on 360dialog's infrastructure even during outages.",
  },
]

const stats = [
  { value: '< 3s', label: 'WhatsApp response time' },
  { value: 'R11,200', label: 'Avg monthly toolstack replaced' },
  { value: '15 min', label: 'Setup time to go live' },
  { value: '11', label: 'SA languages supported' },
]

const industries = [
  { icon: '⚖️', label: 'Legal Firms' },
  { icon: '🏥', label: 'Clinics' },
  { icon: '🏫', label: 'Schools' },
  { icon: '🏢', label: 'NGOs' },
  { icon: '🛍️', label: 'Retail' },
  { icon: '🏗️', label: 'Property' },
  { icon: '🚚', label: 'Logistics' },
  { icon: '🔧', label: 'Trades' },
]

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'AdminOS',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web, Android, iOS',
  url: 'https://adminos.co.za',
  description:
    'AI-powered business operating system for South African SMEs, NGOs, schools and clinics. 5 AI agents: WhatsApp automation, debt recovery, staff wellness, document intelligence, and daily AI business briefs.',
  author: {
    '@type': 'Organization',
    name: 'Mirembe Muse (Pty) Ltd',
    url: 'https://adminos.co.za',
  },
  offers: {
    '@type': 'AggregateOffer',
    priceCurrency: 'ZAR',
    lowPrice: '2500',
    highPrice: '14999',
    offerCount: '4',
  },
  featureList: [
    'AI WhatsApp inbox agent',
    'Automated debt recovery',
    'Staff wellness check-ins',
    'Document intelligence',
    'Daily AI business brief',
    'Xero integration',
    'POPIA compliant',
    'Load-shedding resilient PWA',
  ],
  inLanguage: ['en-ZA', 'af-ZA', 'zu-ZA', 'xh-ZA'],
  audience: {
    '@type': 'Audience',
    audienceType: 'South African SMEs, NGOs, Schools, Clinics, Legal Firms',
  },
}

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="min-h-screen bg-gray-950 text-white">
        {/* ─── Navigation ─────────────────────────────────────────────── */}
        <header className="sticky top-0 z-50 border-b border-white/5 bg-gray-950/80 backdrop-blur-md">
          <nav
            className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4"
            role="navigation"
            aria-label="Main navigation"
          >
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center font-bold text-sm"
                aria-hidden="true"
              >
                A
              </div>
              <span className="font-bold text-lg tracking-tight">AdminOS</span>
            </div>

            <div className="hidden md:flex items-center gap-8 text-sm text-gray-400">
              <a href="#agents" className="hover:text-white transition-colors">Agents</a>
              <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
              <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
              <Link href="/contact" className="hover:text-white transition-colors">Contact</Link>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="text-sm text-gray-400 hover:text-white transition-colors hidden sm:block"
              >
                Sign in
              </Link>
              <Link
                href="https://cal.com/nanda/adminos-demo"
                className="text-sm bg-white text-gray-950 px-4 py-2 rounded-lg font-semibold hover:bg-gray-100 transition-colors hidden sm:block"
                target="_blank"
                rel="noopener noreferrer"
              >
                Book a demo
              </Link>
              <Link
                href="/signup"
                className="text-sm bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
              >
                Free trial
              </Link>
            </div>
          </nav>
        </header>

        <main>
          {/* ─── Hero ─────────────────────────────────────────────────── */}
          <section
            className="relative max-w-6xl mx-auto px-6 pt-24 pb-20 text-center overflow-hidden"
            aria-labelledby="hero-heading"
          >
            {/* Subtle radial glow */}
            <div
              className="absolute inset-0 -z-10 pointer-events-none"
              style={{
                background: 'radial-gradient(ellipse 80% 40% at 50% 0%, rgba(5,150,105,0.12) 0%, transparent 70%)',
              }}
              aria-hidden="true"
            />

            <div className="inline-flex items-center gap-2 bg-emerald-900/40 border border-emerald-700/40 rounded-full px-4 py-1.5 text-sm text-emerald-400 mb-8">
              🇿🇦 Built for South African Business · POPIA Compliant
            </div>

            <h1
              id="hero-heading"
              className="text-5xl md:text-7xl font-extrabold leading-[1.05] tracking-tight mb-6"
            >
              One AI system that
              <br />
              <span className="text-emerald-400">runs your business.</span>
            </h1>

            <p className="text-xl md:text-2xl text-gray-400 mb-4 max-w-3xl mx-auto leading-relaxed">
              AdminOS replaces your WhatsApp group chaos, invoice chasing, staff check-in meetings,
              and expensive toolstack — with 5 AI agents running automatically, 24/7.
            </p>

            <p className="text-base text-amber-400/80 font-medium mb-10">
              Average client saves{' '}
              <strong className="text-amber-400">R8,400/month</strong> in replaced software subscriptions.
            </p>

            <div className="flex items-center justify-center gap-4 flex-wrap mb-6">
              <Link
                href="/signup"
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-4 rounded-xl font-bold text-lg transition-all hover:scale-105 shadow-lg shadow-emerald-900/40"
              >
                Start 14-day free trial →
              </Link>
              <Link
                href="https://cal.com/nanda/adminos-demo"
                className="border border-white/20 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:bg-white/5 transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                Book a 30-min demo
              </Link>
            </div>

            <p className="text-sm text-gray-600">
              No credit card · Live in 15 minutes · Cancel anytime
            </p>
          </section>

          {/* ─── Stats ────────────────────────────────────────────────── */}
          <section className="border-y border-white/5 bg-white/[0.02]" aria-label="Key statistics">
            <div className="max-w-4xl mx-auto px-6 py-12">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
                {stats.map((stat) => (
                  <div key={stat.label}>
                    <p className="text-4xl font-extrabold text-emerald-400 tracking-tight">
                      {stat.value}
                    </p>
                    <p className="text-sm text-gray-500 mt-2 leading-snug">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ─── ROI Comparison ───────────────────────────────────────── */}
          <section className="max-w-5xl mx-auto px-6 py-24" aria-labelledby="roi-heading">
            <div className="text-center mb-12">
              <p className="text-emerald-400 text-sm font-semibold uppercase tracking-widest mb-3">
                Return on investment
              </p>
              <h2 id="roi-heading" className="text-4xl font-bold mb-4">
                What AdminOS replaces
              </h2>
              <p className="text-gray-400 max-w-2xl mx-auto">
                AdminOS at <strong className="text-white">R4,500/month</strong> replaces over{' '}
                <strong className="text-amber-400">R11,200/month</strong> in tools, services, and admin time.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 overflow-hidden">
              <div className="grid grid-cols-3 bg-white/5 px-6 py-3 text-xs text-gray-500 uppercase tracking-wider font-semibold">
                <span>What you pay for now</span>
                <span className="text-center">Monthly cost</span>
                <span className="text-right">Replaced by</span>
              </div>
              {replacements.map((row, i) => (
                <div
                  key={row.tool}
                  className={`grid grid-cols-3 px-6 py-4 items-center ${
                    i < replacements.length - 1 ? 'border-b border-white/5' : ''
                  } hover:bg-white/[0.02] transition-colors`}
                >
                  <span className="text-sm text-gray-300">{row.tool}</span>
                  <span className="text-center text-sm font-semibold text-red-400 line-through">
                    {row.cost}
                  </span>
                  <span className="text-right text-sm text-emerald-400">{row.agent}</span>
                </div>
              ))}
              <div className="grid grid-cols-3 px-6 py-4 bg-emerald-900/20 border-t border-emerald-700/30">
                <span className="font-bold text-white">Total replaced</span>
                <span className="text-center font-bold text-red-400">R11,200/mo</span>
                <span className="text-right font-bold text-emerald-400">AdminOS Growth: R4,500/mo</span>
              </div>
            </div>

            <p className="text-center text-sm text-gray-600 mt-4">
              ROI from month one. No setup cost on Growth and Enterprise tiers.
            </p>
          </section>

          {/* ─── 5 AI Agents ──────────────────────────────────────────── */}
          <section
            id="agents"
            className="bg-white/[0.02] border-y border-white/5 py-24"
            aria-labelledby="agents-heading"
          >
            <div className="max-w-7xl mx-auto px-6">
              <div className="text-center mb-14">
                <p className="text-emerald-400 text-sm font-semibold uppercase tracking-widest mb-3">
                  The 5 AI agents
                </p>
                <h2 id="agents-heading" className="text-4xl font-bold mb-4">
                  Your AI team, always on
                </h2>
                <p className="text-gray-400 max-w-xl mx-auto">
                  Five specialised agents, each with a name and a job. Together they run
                  your business operations without you having to ask.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {agents.map((agent) => (
                  <article
                    key={agent.name}
                    className="bg-gray-900 border border-white/8 rounded-2xl p-6 hover:border-emerald-700/40 transition-all hover:-translate-y-0.5 group"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <span className="text-3xl" aria-hidden="true">{agent.icon}</span>
                        <h3 className="font-bold text-lg mt-2">
                          {agent.name}{' '}
                          <span className="text-gray-500 font-normal text-sm">— {agent.role}</span>
                        </h3>
                      </div>
                    </div>
                    <p className="text-sm text-gray-400 leading-relaxed mb-4">{agent.description}</p>
                    <div className="bg-emerald-900/30 border border-emerald-800/40 rounded-lg px-3 py-2">
                      <p className="text-xs text-emerald-400 font-medium">📈 {agent.metric}</p>
                    </div>
                  </article>
                ))}

                {/* Sixth card — architecture callout */}
                <article className="bg-gradient-to-br from-emerald-900/30 to-gray-900 border border-emerald-700/30 rounded-2xl p-6 flex flex-col justify-between">
                  <div>
                    <span className="text-3xl" aria-hidden="true">⚡</span>
                    <h3 className="font-bold text-lg mt-2">Built for Africa</h3>
                    <p className="text-sm text-gray-400 leading-relaxed mt-2">
                      Load-shedding resilient PWA. 11 South African languages. POPIA compliant.
                      All agents use Claude AI with prompt caching for sub-second responses.
                    </p>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {['PWA Offline', '11 Languages', 'POPIA', 'Claude AI'].map((tag) => (
                      <span
                        key={tag}
                        className="text-xs bg-white/5 border border-white/10 rounded-full px-3 py-1 text-gray-400"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </article>
              </div>
            </div>
          </section>

          {/* ─── How it works ─────────────────────────────────────────── */}
          <section className="max-w-4xl mx-auto px-6 py-24 text-center" aria-labelledby="how-heading">
            <p className="text-emerald-400 text-sm font-semibold uppercase tracking-widest mb-3">
              Getting started
            </p>
            <h2 id="how-heading" className="text-4xl font-bold mb-14">
              Live in 15 minutes
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                {
                  step: '01',
                  title: 'Connect your WhatsApp',
                  desc: 'Link your business number via 360dialog. Takes 3 minutes. No new number needed.',
                },
                {
                  step: '02',
                  title: 'Configure your agents',
                  desc: 'Tell AdminOS about your business, products, pricing, and tone. The AI handles the rest.',
                },
                {
                  step: '03',
                  title: 'Watch it work',
                  desc: "Your AI agents respond to clients, chase invoices, and check in on staff — while you focus on growth.",
                },
              ].map((item) => (
                <div key={item.step} className="relative">
                  <div className="text-6xl font-black text-white/5 mb-3 leading-none">{item.step}</div>
                  <h3 className="font-bold text-white mb-2">{item.title}</h3>
                  <p className="text-sm text-gray-400">{item.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ─── Africa-First ──────────────────────────────────────────── */}
          <section
            className="bg-emerald-950/40 border-y border-emerald-900/30 py-20"
            aria-labelledby="africa-heading"
          >
            <div className="max-w-5xl mx-auto px-6">
              <div className="text-center mb-12">
                <h2 id="africa-heading" className="text-3xl font-bold">
                  Designed for African realities
                </h2>
                <p className="text-gray-400 mt-3">
                  International SaaS tools are built for Silicon Valley problems. AdminOS is built for yours.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  {
                    icon: '🔋',
                    title: 'Load-shedding resilient',
                    desc: "PWA with offline capability. Queue retries automatically when power returns. Your WhatsApp bot stays live on 360dialog's infrastructure during outages. Your business never stops.",
                  },
                  {
                    icon: '🗣️',
                    title: '11 SA languages',
                    desc: "English, Zulu, Xhosa, Afrikaans, Setswana, Sesotho, and more. AI detects your customer's language and responds in kind — automatically, every time.",
                  },
                  {
                    icon: '🔒',
                    title: 'POPIA compliant',
                    desc: "Built with South Africa's Protection of Personal Information Act. Right-to-erasure API, immutable audit trail, data stored with RLS enforcement, and a full compliance centre.",
                  },
                ].map((item) => (
                  <div
                    key={item.title}
                    className="bg-gray-900/60 border border-white/8 rounded-2xl p-6"
                  >
                    <div className="text-3xl mb-3" aria-hidden="true">{item.icon}</div>
                    <h3 className="font-bold text-emerald-400 mb-2">{item.title}</h3>
                    <p className="text-sm text-gray-400 leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ─── Case Study ───────────────────────────────────────────── */}
          <section className="max-w-4xl mx-auto px-6 py-24" aria-labelledby="case-study-heading">
            <div className="text-center mb-10">
              <p className="text-emerald-400 text-sm font-semibold uppercase tracking-widest mb-3">
                Client story
              </p>
              <h2 id="case-study-heading" className="text-4xl font-bold">
                Real results, real business
              </h2>
            </div>

            <div className="bg-gray-900 border border-white/8 rounded-2xl p-8 md:p-10">
              <div className="flex flex-col md:flex-row gap-8 items-start">
                <div className="flex-1">
                  <div className="inline-flex items-center gap-2 bg-amber-900/30 border border-amber-700/30 rounded-full px-3 py-1 text-xs text-amber-400 mb-4">
                    🏗️ Carpentry & Manufacturing · Johannesburg
                  </div>
                  <h3 className="text-2xl font-bold mb-3">Kustom Krafts</h3>
                  <p className="text-gray-400 mb-6 leading-relaxed">
                    A 12-person Johannesburg carpentry business was drowning in WhatsApp quotes,
                    chasing 18 overdue invoices, and had no visibility into which jobs were profitable.
                    The owner was spending 4 hours a day on admin.
                  </p>
                  <p className="text-gray-300 leading-relaxed">
                    After deploying AdminOS on the Growth tier: Alex handles all WhatsApp quote requests
                    and booking confirmations. Chase automatically follows up on overdue invoices —
                    14 of the 18 were settled within 30 days. Insight delivers a daily brief showing
                    job profitability and cash flow outlook.
                  </p>
                </div>
                <div className="md:w-64 w-full grid grid-cols-2 md:grid-cols-1 gap-4">
                  {[
                    { value: '40%', label: 'reduction in admin time' },
                    { value: '14/18', label: 'overdue invoices settled in 30 days' },
                    { value: 'R34k', label: 'monthly contract value' },
                    { value: '1 day', label: 'to go live' },
                  ].map((m) => (
                    <div
                      key={m.label}
                      className="bg-white/5 border border-white/8 rounded-xl p-4 text-center"
                    >
                      <p className="text-2xl font-extrabold text-emerald-400">{m.value}</p>
                      <p className="text-xs text-gray-500 mt-1">{m.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* ─── Industries ───────────────────────────────────────────── */}
          <section
            className="border-y border-white/5 bg-white/[0.02] py-16"
            aria-labelledby="industries-heading"
          >
            <div className="max-w-5xl mx-auto px-6 text-center">
              <h2 id="industries-heading" className="text-2xl font-bold mb-8 text-gray-300">
                Trusted across South African industries
              </h2>
              <div className="flex flex-wrap justify-center gap-3">
                {industries.map((ind) => (
                  <div
                    key={ind.label}
                    className="flex items-center gap-2 bg-gray-900 border border-white/8 rounded-full px-5 py-2.5 text-sm text-gray-300 hover:border-emerald-700/40 transition-colors"
                  >
                    <span aria-hidden="true">{ind.icon}</span>
                    {ind.label}
                  </div>
                ))}
              </div>
              <p className="text-sm text-gray-600 mt-6">
                Also used by government departments, property companies, franchises, and accounting practices.
              </p>
            </div>
          </section>

          {/* ─── Pricing ──────────────────────────────────────────────── */}
          <section
            id="pricing"
            className="max-w-7xl mx-auto px-6 py-24"
            aria-labelledby="pricing-heading"
          >
            <div className="text-center mb-14">
              <p className="text-emerald-400 text-sm font-semibold uppercase tracking-widest mb-3">
                Pricing
              </p>
              <h2 id="pricing-heading" className="text-4xl font-bold mb-4">
                Simple, transparent pricing
              </h2>
              <p className="text-gray-400">
                All prices in South African Rand. No hidden fees. Cancel anytime.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {pricingPlans.map((plan) => (
                <div
                  key={plan.name}
                  className={`relative rounded-2xl p-6 border flex flex-col ${
                    plan.highlight
                      ? 'bg-emerald-600 border-emerald-500 shadow-xl shadow-emerald-900/30'
                      : 'bg-gray-900 border-white/8'
                  }`}
                >
                  {plan.highlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-amber-400 text-gray-950 text-xs font-bold px-3 py-1 rounded-full">
                        MOST POPULAR
                      </span>
                    </div>
                  )}
                  <div className="mb-5">
                    <h3 className="font-bold text-lg">{plan.name}</h3>
                    <p className={`text-xs mt-0.5 ${plan.highlight ? 'text-emerald-200' : 'text-gray-500'}`}>
                      {plan.subtitle}
                    </p>
                    <p className="text-4xl font-extrabold mt-4 tracking-tight">
                      {plan.price}
                      <span className={`text-base font-normal ${plan.highlight ? 'text-emerald-200' : 'text-gray-500'}`}>
                        /mo
                      </span>
                    </p>
                  </div>

                  <ul className="space-y-2.5 mb-6 flex-1">
                    {plan.features.map((f) => (
                      <li
                        key={f}
                        className={`text-sm flex items-start gap-2 ${
                          plan.highlight ? 'text-emerald-100' : 'text-gray-400'
                        }`}
                      >
                        <span
                          className={`mt-0.5 flex-shrink-0 ${plan.highlight ? 'text-emerald-200' : 'text-emerald-500'}`}
                          aria-hidden="true"
                        >
                          ✓
                        </span>
                        {f}
                      </li>
                    ))}
                  </ul>

                  <Link
                    href={plan.name === 'Enterprise' || plan.name === 'White Label' ? '/contact' : '/signup'}
                    className={`block text-center text-sm font-bold py-3 px-4 rounded-xl transition-colors ${
                      plan.highlight
                        ? 'bg-white text-emerald-700 hover:bg-emerald-50'
                        : 'border border-white/15 text-white hover:bg-white/5'
                    }`}
                  >
                    {plan.cta}
                  </Link>
                </div>
              ))}
            </div>

            <p className="text-center text-sm text-gray-600 mt-8">
              Annual billing available at 15% discount. Onboarding support: R5,000–R15,000 (optional).
            </p>
          </section>

          {/* ─── FAQ ──────────────────────────────────────────────────── */}
          <section
            id="faq"
            className="bg-white/[0.02] border-y border-white/5 py-24"
            aria-labelledby="faq-heading"
          >
            <div className="max-w-3xl mx-auto px-6">
              <div className="text-center mb-12">
                <p className="text-emerald-400 text-sm font-semibold uppercase tracking-widest mb-3">
                  FAQ
                </p>
                <h2 id="faq-heading" className="text-4xl font-bold">
                  Common questions
                </h2>
              </div>

              <div className="space-y-3">
                {faqs.map((faq) => (
                  <details
                    key={faq.q}
                    className="group bg-gray-900 border border-white/8 rounded-xl overflow-hidden"
                  >
                    <summary className="flex items-center justify-between p-5 cursor-pointer list-none select-none hover:bg-white/[0.02] transition-colors">
                      <span className="font-medium text-white pr-4">{faq.q}</span>
                      <span
                        className="text-gray-500 flex-shrink-0 group-open:rotate-45 transition-transform"
                        aria-hidden="true"
                      >
                        +
                      </span>
                    </summary>
                    <div className="px-5 pb-5">
                      <p className="text-gray-400 text-sm leading-relaxed">{faq.a}</p>
                    </div>
                  </details>
                ))}
              </div>
            </div>
          </section>

          {/* ─── Final CTA ────────────────────────────────────────────── */}
          <section
            className="max-w-3xl mx-auto px-6 py-24 text-center"
            aria-labelledby="cta-heading"
          >
            <div
              className="rounded-3xl border border-emerald-700/30 p-12"
              style={{
                background: 'linear-gradient(135deg, rgba(5,150,105,0.1) 0%, rgba(5,150,105,0.03) 100%)',
              }}
            >
              <h2 id="cta-heading" className="text-4xl font-extrabold mb-4">
                Ready to run your business on AI?
              </h2>
              <p className="text-gray-400 mb-8 text-lg">
                Join South African businesses already saving time and money with AdminOS.
                Start free — no credit card, no commitment.
              </p>
              <div className="flex items-center justify-center gap-4 flex-wrap">
                <Link
                  href="/signup"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-4 rounded-xl font-bold text-lg transition-all hover:scale-105 shadow-lg shadow-emerald-900/40"
                >
                  Start free trial →
                </Link>
                <Link
                  href="https://cal.com/nanda/adminos-demo"
                  className="border border-white/20 text-white px-8 py-4 rounded-xl font-semibold hover:bg-white/5 transition-colors"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Book a demo
                </Link>
              </div>
              <p className="text-sm text-gray-600 mt-5">
                14-day free trial · Live in 15 minutes · POPIA compliant
              </p>
            </div>
          </section>
        </main>

        {/* ─── Footer ───────────────────────────────────────────────── */}
        <footer
          className="border-t border-white/5 py-12"
          role="contentinfo"
        >
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-7 h-7 bg-emerald-500 rounded-lg flex items-center justify-center font-bold text-xs" aria-hidden="true">
                    A
                  </div>
                  <span className="font-bold">AdminOS</span>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">
                  AI-powered business OS for South African SMEs. Built by Mirembe Muse (Pty) Ltd.
                </p>
              </div>

              <nav aria-label="Product links">
                <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-3">Product</p>
                <ul className="space-y-2 text-sm text-gray-500">
                  <li><a href="#agents" className="hover:text-white transition-colors">AI Agents</a></li>
                  <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
                  <li><a href="#faq" className="hover:text-white transition-colors">FAQ</a></li>
                  <li>
                    <Link
                      href="https://cal.com/nanda/adminos-demo"
                      className="hover:text-white transition-colors"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Book a demo
                    </Link>
                  </li>
                </ul>
              </nav>

              <nav aria-label="Account links">
                <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-3">Account</p>
                <ul className="space-y-2 text-sm text-gray-500">
                  <li><Link href="/signup" className="hover:text-white transition-colors">Start free trial</Link></li>
                  <li><Link href="/login" className="hover:text-white transition-colors">Sign in</Link></li>
                  <li><Link href="/contact" className="hover:text-white transition-colors">Contact</Link></li>
                </ul>
              </nav>

              <nav aria-label="Legal links">
                <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-3">Legal</p>
                <ul className="space-y-2 text-sm text-gray-500">
                  <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
                  <li><Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
                  <li><Link href="/privacy#popia" className="hover:text-white transition-colors">POPIA Compliance</Link></li>
                </ul>
              </nav>
            </div>

            <div className="border-t border-white/5 pt-6 flex flex-col md:flex-row justify-between items-center gap-4">
              <p className="text-xs text-gray-600">
                © {new Date().getFullYear()} Mirembe Muse (Pty) Ltd · All rights reserved
              </p>
              <div className="flex items-center gap-4 text-xs text-gray-600">
                <span>POPIA Compliant</span>
                <span>·</span>
                <span>Powered by Claude AI</span>
                <span>·</span>
                <span>Built for Africa</span>
                <span>·</span>
                <a
                  href="https://twitter.com/CreativelyNanda"
                  className="hover:text-gray-400 transition-colors"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Twitter / X"
                >
                  𝕏
                </a>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}
