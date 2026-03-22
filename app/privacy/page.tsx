import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy — AdminOS',
  description:
    'AdminOS Privacy Policy. Learn how Mirembe Muse (Pty) Ltd collects, uses, and protects your personal information in compliance with POPIA (Protection of Personal Information Act).',
  alternates: { canonical: 'https://adminos.co.za/privacy' },
}

const LAST_UPDATED = '22 March 2026'
const COMPANY = 'Mirembe Muse (Pty) Ltd'
const EMAIL = 'privacy@mirembemuse.co.za'
const ADDRESS = 'South Africa'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Nav */}
      <header className="border-b border-white/5">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2" aria-label="AdminOS home">
            <div className="w-7 h-7 bg-emerald-500 rounded-lg flex items-center justify-center font-bold text-xs" aria-hidden="true">
              A
            </div>
            <span className="font-bold">AdminOS</span>
          </Link>
          <Link href="/" className="text-sm text-gray-500 hover:text-white transition-colors">
            ← Back to home
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-16">
        <div className="mb-12">
          <h1 className="text-4xl font-extrabold mb-4">Privacy Policy</h1>
          <p className="text-gray-400">
            Last updated: {LAST_UPDATED} · Effective immediately
          </p>
          <div
            id="popia"
            className="mt-6 bg-emerald-900/30 border border-emerald-700/30 rounded-xl p-5"
          >
            <p className="text-sm text-emerald-300 font-semibold mb-1">
              🇿🇦 POPIA Compliant
            </p>
            <p className="text-sm text-gray-400">
              This policy is drafted in compliance with the{' '}
              <strong className="text-white">Protection of Personal Information Act (POPIA), No. 4 of 2013</strong>,
              South Africa&apos;s primary data protection legislation.
            </p>
          </div>
        </div>

        <div className="prose prose-invert max-w-none space-y-10 text-gray-300">

          <section aria-labelledby="who-we-are">
            <h2 id="who-we-are" className="text-2xl font-bold text-white mb-4">1. Who We Are</h2>
            <p>
              <strong className="text-white">{COMPANY}</strong> (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) operates AdminOS,
              an AI-powered business operating system available at adminos.co.za. We are the responsible
              party (operator) as defined under POPIA for personal information processed through our platform.
            </p>
            <p className="mt-3">
              <strong className="text-white">Contact our Information Officer:</strong>{' '}
              <a href={`mailto:${EMAIL}`} className="text-emerald-400 hover:underline">{EMAIL}</a>
            </p>
          </section>

          <section aria-labelledby="information-we-collect">
            <h2 id="information-we-collect" className="text-2xl font-bold text-white mb-4">2. Information We Collect</h2>

            <h3 className="text-lg font-semibold text-white mb-2">2.1 Account Information</h3>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li>Business name, contact name, email address, phone number</li>
              <li>Business registration details (for compliance and billing)</li>
              <li>Payment information (processed by PayFast — we do not store card details)</li>
            </ul>

            <h3 className="text-lg font-semibold text-white mb-2 mt-5">2.2 Business Operations Data</h3>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li>WhatsApp conversations between your business and your clients (processed by 360dialog)</li>
              <li>Invoice and financial data you upload or create within AdminOS</li>
              <li>Staff information you enter for wellness check-ins and leave management</li>
              <li>Documents uploaded for processing (contracts, quotes, compliance documents)</li>
              <li>Client contact details entered into the CRM</li>
            </ul>

            <h3 className="text-lg font-semibold text-white mb-2 mt-5">2.3 Usage Data</h3>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li>Feature usage metrics and session data (via Vercel Analytics)</li>
              <li>Error logs (anonymised, no PII)</li>
              <li>API call volumes per tenant (for billing and rate limiting)</li>
            </ul>
          </section>

          <section aria-labelledby="how-we-use">
            <h2 id="how-we-use" className="text-2xl font-bold text-white mb-4">3. How We Use Your Information</h2>
            <p>We process personal information only for the following purposes:</p>
            <ul className="list-disc pl-5 space-y-2 text-sm mt-3">
              <li><strong className="text-white">Service delivery:</strong> Providing AI agents, WhatsApp automation, document processing, and analytics features</li>
              <li><strong className="text-white">Billing:</strong> Processing subscription payments via PayFast</li>
              <li><strong className="text-white">Support:</strong> Responding to support requests and onboarding assistance</li>
              <li><strong className="text-white">Security:</strong> Fraud prevention, rate limiting, audit logging</li>
              <li><strong className="text-white">Legal compliance:</strong> Meeting our obligations under POPIA and other applicable South African law</li>
              <li><strong className="text-white">Product improvement:</strong> Aggregated, anonymised analytics to improve features (no individual profiling)</li>
            </ul>
            <p className="mt-4 text-sm bg-amber-900/20 border border-amber-700/20 rounded-lg p-4">
              <strong className="text-amber-400">We do not sell your data.</strong> We do not use your data for
              advertising purposes or share it with third parties for their own marketing.
            </p>
          </section>

          <section aria-labelledby="ai-processing">
            <h2 id="ai-processing" className="text-2xl font-bold text-white mb-4">4. AI Processing and Third Parties</h2>
            <p>AdminOS uses the following third-party services to operate:</p>
            <div className="mt-4 space-y-3">
              {[
                {
                  name: 'Anthropic (Claude AI)',
                  purpose: 'Natural language processing for AI agents',
                  note: 'Conversation data is sent to Anthropic API. Anthropic does not train on API data. See anthropic.com/privacy.',
                },
                {
                  name: 'Supabase',
                  purpose: 'Database storage and authentication',
                  note: 'Data stored in Supabase-hosted PostgreSQL with row-level security enforcement.',
                },
                {
                  name: '360dialog',
                  purpose: 'WhatsApp Business API integration',
                  note: 'WhatsApp messages are routed through 360dialog infrastructure.',
                },
                {
                  name: 'PayFast',
                  purpose: 'Payment processing',
                  note: 'Card details are processed by PayFast and are never stored by AdminOS.',
                },
                {
                  name: 'Upstash Redis',
                  purpose: 'Rate limiting and caching',
                  note: 'Anonymised rate limit identifiers stored temporarily.',
                },
                {
                  name: 'Vercel',
                  purpose: 'Hosting and analytics',
                  note: 'Application hosted on Vercel Edge infrastructure. Vercel Analytics captures page-level usage data.',
                },
              ].map((service) => (
                <div key={service.name} className="bg-gray-900 border border-white/8 rounded-xl p-4">
                  <p className="font-semibold text-white text-sm">{service.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{service.purpose}</p>
                  <p className="text-xs text-gray-400 mt-1">{service.note}</p>
                </div>
              ))}
            </div>
          </section>

          <section aria-labelledby="data-security">
            <h2 id="data-security" className="text-2xl font-bold text-white mb-4">5. How We Protect Your Data</h2>
            <ul className="list-disc pl-5 space-y-2 text-sm">
              <li>Multi-tenant isolation: every client&apos;s data is strictly partitioned using Row-Level Security (RLS)</li>
              <li>Encryption in transit (TLS 1.3) and at rest</li>
              <li>Immutable audit logs for all data access and modifications</li>
              <li>Rate limiting on all API endpoints to prevent abuse</li>
              <li>No sensitive business data (invoice amounts, PII) in application logs</li>
              <li>Webhook signature verification (PayFast, 360dialog)</li>
              <li>Content Security Policy and HSTS headers enforced on all responses</li>
            </ul>
          </section>

          <section aria-labelledby="retention">
            <h2 id="retention" className="text-2xl font-bold text-white mb-4">6. Data Retention</h2>
            <div className="space-y-3 text-sm">
              {[
                { type: 'Active account data', period: 'Retained while your subscription is active' },
                { type: 'WhatsApp conversation history', period: '90 days by default (configurable per tenant)' },
                { type: 'Invoice and financial records', period: '5 years (as required by South African tax law)' },
                { type: 'Audit logs', period: '2 years minimum' },
                { type: 'Deleted account data', period: 'Purged within 30 days of cancellation request' },
              ].map((item) => (
                <div key={item.type} className="flex justify-between bg-gray-900 border border-white/5 rounded-lg p-3">
                  <span className="text-gray-300 font-medium">{item.type}</span>
                  <span className="text-gray-500 text-right ml-4">{item.period}</span>
                </div>
              ))}
            </div>
          </section>

          <section aria-labelledby="your-rights">
            <h2 id="your-rights" className="text-2xl font-bold text-white mb-4">
              7. Your Rights Under POPIA
            </h2>
            <p className="mb-4">You have the following rights regarding your personal information:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              {[
                { right: 'Right of access', desc: 'Request a copy of all personal information we hold about you' },
                { right: 'Right to correction', desc: 'Request correction of inaccurate personal information' },
                { right: 'Right to erasure', desc: 'Request deletion of your personal information (subject to legal retention requirements)' },
                { right: 'Right to object', desc: 'Object to processing of your personal information in certain circumstances' },
                { right: 'Right to data portability', desc: 'Export your business data in machine-readable format at any time' },
                { right: 'Right to complain', desc: 'Lodge a complaint with the Information Regulator of South Africa' },
              ].map((item) => (
                <div key={item.right} className="bg-gray-900 border border-white/8 rounded-xl p-4">
                  <p className="font-semibold text-white">{item.right}</p>
                  <p className="text-gray-400 mt-1">{item.desc}</p>
                </div>
              ))}
            </div>
            <p className="mt-6 text-sm">
              To exercise any of these rights, email{' '}
              <a href={`mailto:${EMAIL}`} className="text-emerald-400 hover:underline">{EMAIL}</a>.
              We respond within 30 days in accordance with POPIA requirements.
            </p>
          </section>

          <section aria-labelledby="cookies">
            <h2 id="cookies" className="text-2xl font-bold text-white mb-4">8. Cookies</h2>
            <p className="text-sm">
              AdminOS uses the following cookies:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-sm mt-3">
              <li><strong className="text-white">Authentication cookies:</strong> Supabase session tokens for keeping you logged in. Strictly necessary.</li>
              <li><strong className="text-white">Analytics cookies:</strong> Vercel Analytics for page-level usage statistics. No personal profiling.</li>
              <li><strong className="text-white">Preference cookies:</strong> Storing your UI preferences (language, dashboard layout).</li>
            </ul>
            <p className="text-sm mt-3">You can manage cookies through your browser settings.</p>
          </section>

          <section aria-labelledby="changes">
            <h2 id="changes" className="text-2xl font-bold text-white mb-4">9. Changes to This Policy</h2>
            <p className="text-sm">
              We may update this Privacy Policy from time to time. We will notify you of material changes
              by email to your registered address and by displaying a notice in your AdminOS dashboard
              at least 14 days before the change takes effect.
            </p>
          </section>

          <section aria-labelledby="contact-privacy">
            <h2 id="contact-privacy" className="text-2xl font-bold text-white mb-4">10. Contact Us</h2>
            <div className="bg-gray-900 border border-white/8 rounded-xl p-6 text-sm space-y-2">
              <p><strong className="text-white">Information Officer:</strong> {COMPANY}</p>
              <p><strong className="text-white">Email:</strong>{' '}
                <a href={`mailto:${EMAIL}`} className="text-emerald-400 hover:underline">{EMAIL}</a>
              </p>
              <p><strong className="text-white">Address:</strong> {ADDRESS}</p>
              <p className="text-gray-500 mt-4">
                You may also lodge a complaint with the{' '}
                <strong className="text-white">Information Regulator of South Africa</strong>:{' '}
                <a
                  href="https://www.justice.gov.za/inforeg/"
                  className="text-emerald-400 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  www.justice.gov.za/inforeg
                </a>
              </p>
            </div>
          </section>
        </div>
      </main>

      <footer className="border-t border-white/5 py-8 text-center text-sm text-gray-600">
        <p>© {new Date().getFullYear()} {COMPANY} · <Link href="/terms" className="hover:text-gray-400">Terms</Link> · <Link href="/contact" className="hover:text-gray-400">Contact</Link></p>
      </footer>
    </div>
  )
}
