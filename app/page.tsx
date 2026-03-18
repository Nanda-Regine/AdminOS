import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'AdminOS — The AI Business OS Built for Africa',
  description:
    'AdminOS automates your WhatsApp, chases overdue invoices, tracks staff wellness, and sends daily AI business briefs. Built for South African SMEs, NGOs, schools, and clinics. 14-day free trial.',
  alternates: {
    canonical: 'https://adminos.co.za',
  },
}

const features = [
  {
    icon: '💬',
    title: 'WhatsApp AI Assistant',
    desc: 'Answers every customer query instantly, 24/7 in English, Zulu, Xhosa, or Afrikaans. Escalates to you when needed.',
  },
  {
    icon: '💰',
    title: 'Automated Debt Recovery',
    desc: 'Automatically chases overdue invoices with escalating messages — from friendly reminder to letter of demand.',
  },
  {
    icon: '👥',
    title: 'Staff Wellness & Leave',
    desc: 'Daily mood check-ins, leave management, burnout alerts — all via WhatsApp. Spot problems before they become crises.',
  },
  {
    icon: '🎯',
    title: 'Goal & Strategy Tracker',
    desc: 'Upload your strategy doc — AI extracts your goals, KPIs, and milestones and tracks progress automatically.',
  },
  {
    icon: '📊',
    title: 'Daily AI Business Brief',
    desc: 'Every morning, a personalised business intelligence summary lands in your dashboard. Data-driven, actionable, Africa-aware.',
  },
  {
    icon: '📁',
    title: 'Document Intelligence',
    desc: 'Upload any PDF, Word, or Excel file — AI classifies, summarises, and extracts action items instantly.',
  },
]

const industries = [
  { icon: '🏫', label: 'Schools' },
  { icon: '🏥', label: 'Clinics' },
  { icon: '🏢', label: 'NGOs' },
  { icon: '🛍️', label: 'Retail' },
  { icon: '🏗️', label: 'Property' },
  { icon: '⚖️', label: 'Legal' },
]

const pricingPlans = [
  {
    name: 'Starter',
    price: 'R799',
    features: ['1 WhatsApp number', '500 AI conversations/mo', '5 automated workflows', 'Basic dashboard'],
    highlight: false,
  },
  {
    name: 'Business',
    price: 'R2,499',
    features: ['3 numbers', '5,000 conversations/mo', 'Unlimited workflows', 'All integrations + analytics'],
    highlight: true,
  },
  {
    name: 'Enterprise',
    price: 'R7,999',
    features: ['Unlimited everything', 'SLA guarantee', 'Dedicated onboarding', 'Custom integrations'],
    highlight: false,
  },
  {
    name: 'White Label',
    price: 'R14,999',
    features: ['Rebrand & resell', 'Revenue share model', 'Your own clients', 'Full whitelabel'],
    highlight: false,
  },
]

const stats = [
  { value: '< 3s', label: 'WhatsApp response time' },
  { value: '85%', label: 'AI cost reduction via caching' },
  { value: '15 min', label: 'Setup time to go live' },
  { value: '11', label: 'South African languages supported' },
]

// Schema.org structured data for rich search results
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'AdminOS',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web, Android, iOS',
  url: 'https://adminos.co.za',
  description:
    'AI-powered business operating system for South African SMEs, NGOs, schools and clinics. WhatsApp automation, debt recovery, staff wellness tracking, and daily AI business briefs.',
  author: {
    '@type': 'Organization',
    name: 'Mirembe Muse (Pty) Ltd',
    url: 'https://adminos.co.za',
  },
  offers: {
    '@type': 'AggregateOffer',
    priceCurrency: 'ZAR',
    lowPrice: '799',
    highPrice: '14999',
    offerCount: '4',
  },
  featureList: [
    'WhatsApp AI automation',
    'Automated debt recovery',
    'Staff wellness tracking',
    'Goal and strategy tracking',
    'Daily AI business briefs',
    'Document intelligence',
    'Multi-language support',
    'POPI Act compliant',
  ],
  inLanguage: ['en-ZA', 'af-ZA', 'zu-ZA', 'xh-ZA'],
  audience: {
    '@type': 'Audience',
    audienceType: 'South African SMEs, NGOs, Schools, Clinics',
  },
}

export default function HomePage() {
  return (
    <>
      {/* Schema.org JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main className="min-h-screen bg-gray-900 text-white">
        {/* Nav */}
        <nav
          className="flex items-center justify-between px-6 py-4 border-b border-gray-800 max-w-7xl mx-auto"
          role="navigation"
          aria-label="Main navigation"
        >
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center font-bold text-sm"
              aria-hidden="true"
            >
              A
            </div>
            <span className="font-bold text-lg">AdminOS</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm px-4 py-2 rounded-lg transition-colors"
            >
              Start free trial
            </Link>
          </div>
        </nav>

        {/* Hero */}
        <section
          className="max-w-5xl mx-auto px-6 py-24 text-center"
          aria-labelledby="hero-heading"
        >
          <div className="inline-flex items-center gap-2 bg-emerald-900/50 border border-emerald-700/50 rounded-full px-4 py-1.5 text-sm text-emerald-400 mb-6">
            Built for African businesses · POPI compliant
          </div>
          <h1
            id="hero-heading"
            className="text-5xl md:text-6xl font-bold leading-tight mb-6"
          >
            The OS that runs your
            <br />
            <span className="text-emerald-400">business while you sleep</span>
          </h1>
          <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
            AdminOS handles every WhatsApp query, chases overdue invoices, tracks
            staff wellness, and gives you a daily AI brief — all automatically.
            Works during load shedding. Responds in 11 languages.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link
              href="/signup"
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-colors"
            >
              Start free trial →
            </Link>
            <Link
              href="/login"
              className="text-gray-400 hover:text-white px-8 py-4 rounded-xl border border-gray-700 transition-colors"
            >
              Sign in
            </Link>
          </div>
          <p className="text-sm text-gray-500 mt-4">
            14-day free trial · No credit card · Live in 15 minutes
          </p>
        </section>

        {/* Stats */}
        <section
          className="max-w-4xl mx-auto px-6 pb-16"
          aria-label="Key statistics"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {stats.map((stat) => (
              <div key={stat.label}>
                <p className="text-3xl font-bold text-emerald-400">
                  {stat.value}
                </p>
                <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section
          className="max-w-7xl mx-auto px-6 pb-24"
          aria-labelledby="features-heading"
        >
          <h2
            id="features-heading"
            className="text-3xl font-bold text-center mb-12"
          >
            Everything your business needs, automated
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <article
                key={feature.title}
                className="bg-gray-800 border border-gray-700 rounded-xl p-6 hover:border-emerald-700/50 transition-colors"
              >
                <div className="text-3xl mb-3" aria-hidden="true">
                  {feature.icon}
                </div>
                <h3 className="font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-sm text-gray-400">{feature.desc}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Industries */}
        <section
          className="max-w-5xl mx-auto px-6 pb-24"
          aria-labelledby="industries-heading"
        >
          <h2
            id="industries-heading"
            className="text-2xl font-bold text-center mb-8 text-gray-300"
          >
            Built for every South African business
          </h2>
          <div className="flex flex-wrap justify-center gap-4">
            {industries.map((ind) => (
              <div
                key={ind.label}
                className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-full px-5 py-2.5 text-sm text-gray-300"
              >
                <span aria-hidden="true">{ind.icon}</span>
                {ind.label}
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-gray-500 mt-6">
            Also used by government departments, property companies, legal firms, and
            franchises across South Africa
          </p>
        </section>

        {/* Africa-first callout */}
        <section className="bg-emerald-900/20 border-y border-emerald-800/30 py-16">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <h2 className="text-2xl font-bold mb-4">
              Designed around African realities
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8 text-left">
              {[
                {
                  title: 'Load shedding resilient',
                  desc: 'PWA with offline capability. Queue retries automatically when power returns. Your business never stops.',
                },
                {
                  title: '11 languages',
                  desc: 'English, Zulu, Xhosa, Afrikaans, Setswana, Sesotho, and more. AI responds in your customer\'s language automatically.',
                },
                {
                  title: 'POPI Act compliant',
                  desc: 'Built with South Africa\'s Protection of Personal Information Act in mind. Data stored locally, RLS enforced, audit trail immutable.',
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="bg-gray-800/50 rounded-xl p-5 border border-gray-700"
                >
                  <h3 className="font-semibold text-emerald-400 mb-2">
                    {item.title}
                  </h3>
                  <p className="text-sm text-gray-400">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section
          className="bg-gray-800/50 border-t border-gray-800 py-24"
          aria-labelledby="pricing-heading"
        >
          <div className="max-w-5xl mx-auto px-6">
            <h2
              id="pricing-heading"
              className="text-3xl font-bold text-center mb-4"
            >
              Simple, transparent pricing
            </h2>
            <p className="text-center text-gray-400 mb-12">
              All prices in South African Rand. No hidden fees. Cancel anytime.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {pricingPlans.map((plan) => (
                <div
                  key={plan.name}
                  className={`rounded-xl p-6 border ${
                    plan.highlight
                      ? 'bg-emerald-600 border-emerald-500'
                      : 'bg-gray-800 border-gray-700'
                  }`}
                >
                  <h3 className="font-semibold mb-1">{plan.name}</h3>
                  <p className="text-3xl font-bold mb-4">
                    {plan.price}
                    <span className="text-sm font-normal opacity-70">/mo</span>
                  </p>
                  <ul className="space-y-1.5 mb-6">
                    {plan.features.map((f) => (
                      <li
                        key={f}
                        className={`text-sm flex items-center gap-2 ${
                          plan.highlight ? 'text-emerald-100' : 'text-gray-400'
                        }`}
                      >
                        <span aria-hidden="true">✓</span> {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/signup"
                    className={`block text-center text-sm font-medium py-2 px-4 rounded-lg transition-colors ${
                      plan.highlight
                        ? 'bg-white text-emerald-700 hover:bg-emerald-50'
                        : 'border border-gray-600 text-white hover:bg-gray-700'
                    }`}
                  >
                    Get started
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer
          className="border-t border-gray-800 py-8 text-center text-sm text-gray-500"
          role="contentinfo"
        >
          <p>© {new Date().getFullYear()} Mirembe Muse (Pty) Ltd · AdminOS · adminos.co.za</p>
          <p className="mt-1">Built with love for Africa by Nandawula Regine</p>
          <p className="mt-2 text-xs text-gray-600">
            POPI compliant · Hosted in South Africa · Powered by Claude AI
          </p>
          <nav
            className="flex items-center justify-center gap-4 mt-3 text-xs text-gray-600"
            aria-label="Footer navigation"
          >
            <Link href="/login" className="hover:text-gray-400 transition-colors">
              Sign in
            </Link>
            <Link href="/signup" className="hover:text-gray-400 transition-colors">
              Free trial
            </Link>
          </nav>
        </footer>
      </main>
    </>
  )
}
