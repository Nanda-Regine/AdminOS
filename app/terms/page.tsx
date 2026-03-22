import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Terms of Service — AdminOS',
  description:
    'AdminOS Terms of Service. Understand your rights and responsibilities when using the AdminOS platform by Mirembe Muse (Pty) Ltd.',
  alternates: { canonical: 'https://adminos.co.za/terms' },
}

const LAST_UPDATED = '22 March 2026'
const COMPANY = 'Mirembe Muse (Pty) Ltd'
const EMAIL = 'legal@mirembemuse.co.za'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
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
          <h1 className="text-4xl font-extrabold mb-4">Terms of Service</h1>
          <p className="text-gray-400">Last updated: {LAST_UPDATED}</p>
          <p className="text-sm text-gray-500 mt-3">
            These terms constitute a legally binding agreement between you (&quot;Customer&quot;) and{' '}
            <strong className="text-white">{COMPANY}</strong> (&quot;AdminOS&quot;, &quot;we&quot;, &quot;us&quot;) governing use of the AdminOS platform.
            By creating an account, you accept these terms in full.
          </p>
        </div>

        <div className="space-y-10 text-gray-300">

          <section aria-labelledby="services">
            <h2 id="services" className="text-2xl font-bold text-white mb-4">1. The Service</h2>
            <p className="text-sm leading-relaxed">
              AdminOS provides a cloud-based business operating system comprising AI-powered agents for WhatsApp
              inbox management, debt recovery automation, staff wellness check-ins, document intelligence, and
              daily business analytics. The platform is available as a monthly subscription via adminos.co.za.
            </p>
          </section>

          <section aria-labelledby="accounts">
            <h2 id="accounts" className="text-2xl font-bold text-white mb-4">2. Accounts and Registration</h2>
            <ul className="text-sm list-disc pl-5 space-y-2">
              <li>You must be 18 years or older and legally authorised to enter into this agreement on behalf of your business.</li>
              <li>You are responsible for maintaining the confidentiality of your account credentials.</li>
              <li>You may not share your account with multiple businesses or use one account to serve multiple organisations (except on White Label tier).</li>
              <li>You must provide accurate registration information and keep it updated.</li>
              <li>Each tenant account is isolated. You may not attempt to access another tenant&apos;s data.</li>
            </ul>
          </section>

          <section aria-labelledby="subscriptions">
            <h2 id="subscriptions" className="text-2xl font-bold text-white mb-4">3. Subscriptions and Billing</h2>

            <h3 className="text-lg font-semibold text-white mb-2">3.1 Free Trial</h3>
            <p className="text-sm">
              New accounts receive a 14-day free trial with full access to selected tier features.
              No credit card is required to start the trial. At the end of the trial, your account
              is downgraded unless you subscribe.
            </p>

            <h3 className="text-lg font-semibold text-white mb-2 mt-5">3.2 Subscription Fees</h3>
            <p className="text-sm">
              Subscriptions are billed monthly in South African Rand (ZAR) via PayFast. Prices are
              as displayed on adminos.co.za at the time of subscription. We reserve the right to
              change pricing with 30 days&apos; written notice.
            </p>

            <h3 className="text-lg font-semibold text-white mb-2 mt-5">3.3 Cancellation</h3>
            <p className="text-sm">
              You may cancel your subscription at any time from your billing settings. Cancellation
              takes effect at the end of your current billing period. We do not offer prorated refunds
              for partial months, except where required by South African consumer law.
            </p>

            <h3 className="text-lg font-semibold text-white mb-2 mt-5">3.4 Failed Payments</h3>
            <p className="text-sm">
              If payment fails, we will retry over 7 days and notify you by email. Access may be
              suspended after 7 days of failed payment. Data is retained for 30 days post-suspension
              before deletion.
            </p>
          </section>

          <section aria-labelledby="acceptable-use">
            <h2 id="acceptable-use" className="text-2xl font-bold text-white mb-4">4. Acceptable Use</h2>
            <p className="text-sm mb-3">You agree not to use AdminOS to:</p>
            <ul className="text-sm list-disc pl-5 space-y-2">
              <li>Send unsolicited commercial communications (spam) via WhatsApp</li>
              <li>Transmit unlawful, harassing, defamatory, or fraudulent content</li>
              <li>Attempt to reverse-engineer, decompile, or circumvent any security measures</li>
              <li>Use the platform in a way that exceeds your subscription tier&apos;s limits</li>
              <li>Process personal information in violation of POPIA or other applicable law</li>
              <li>Impersonate another person or business</li>
              <li>Engage in activities that could damage, disable, or impair the platform</li>
            </ul>
            <p className="text-sm mt-4 text-amber-400/80">
              Violation of acceptable use may result in immediate account suspension without refund.
            </p>
          </section>

          <section aria-labelledby="intellectual-property">
            <h2 id="intellectual-property" className="text-2xl font-bold text-white mb-4">5. Intellectual Property</h2>
            <p className="text-sm leading-relaxed">
              AdminOS and all its components (software, AI models, interfaces, trademarks, and content)
              are owned by {COMPANY} and protected by South African intellectual property law.
              Your subscription grants you a limited, non-exclusive, non-transferable licence to use
              the platform for your business operations.
            </p>
            <p className="text-sm leading-relaxed mt-3">
              <strong className="text-white">Your data remains yours.</strong> You retain full ownership
              of all business data, contacts, conversations, and documents you upload to AdminOS. We
              claim no rights over your business data. You may export your data at any time.
            </p>
          </section>

          <section aria-labelledby="ai-use">
            <h2 id="ai-use" className="text-2xl font-bold text-white mb-4">6. AI and Automated Features</h2>
            <p className="text-sm leading-relaxed">
              AdminOS uses AI (Claude by Anthropic) to power its agents. While we take significant steps
              to ensure accuracy and reliability:
            </p>
            <ul className="text-sm list-disc pl-5 space-y-2 mt-3">
              <li>AI responses may occasionally be inaccurate. Always verify critical business communications.</li>
              <li>You are responsible for reviewing and approving AI-generated communications before they take legal effect.</li>
              <li>AdminOS debt recovery messages are designed to comply with the National Credit Act, but you remain responsible for ensuring compliance in your specific context.</li>
              <li>We are not liable for financial decisions made based on AI analytics outputs without independent verification.</li>
            </ul>
          </section>

          <section aria-labelledby="data">
            <h2 id="data" className="text-2xl font-bold text-white mb-4">7. Data and Privacy</h2>
            <p className="text-sm">
              Our collection and use of personal information is governed by our{' '}
              <Link href="/privacy" className="text-emerald-400 hover:underline">Privacy Policy</Link>,
              which forms part of these Terms. As a Customer, you are an &quot;operator&quot; under POPIA
              processing the personal information of your clients and staff through our platform.
              You are responsible for having a lawful basis for processing that personal information.
            </p>
          </section>

          <section aria-labelledby="sla">
            <h2 id="sla" className="text-2xl font-bold text-white mb-4">8. Service Availability</h2>
            <div className="space-y-3 text-sm">
              {[
                { tier: 'Starter & Growth', uptime: '99.5% monthly uptime target', support: 'Email support, 48-hour response' },
                { tier: 'Enterprise', uptime: '99.9% monthly uptime SLA (contractual)', support: 'Priority support, 4-hour response' },
              ].map((row) => (
                <div key={row.tier} className="bg-gray-900 border border-white/8 rounded-xl p-4">
                  <p className="font-semibold text-white">{row.tier}</p>
                  <p className="text-gray-400 text-xs mt-1">{row.uptime} · {row.support}</p>
                </div>
              ))}
            </div>
            <p className="text-sm text-gray-500 mt-4">
              Downtime due to scheduled maintenance, load shedding beyond our control, or third-party
              service failures (WhatsApp/360dialog, Supabase, Anthropic) does not count against uptime targets.
            </p>
          </section>

          <section aria-labelledby="limitation">
            <h2 id="limitation" className="text-2xl font-bold text-white mb-4">9. Limitation of Liability</h2>
            <p className="text-sm leading-relaxed">
              To the maximum extent permitted by South African law, {COMPANY}&apos;s total liability to you
              for any claim arising from these Terms or your use of AdminOS shall not exceed the total
              subscription fees paid by you in the 3 months preceding the claim.
            </p>
            <p className="text-sm leading-relaxed mt-3">
              We are not liable for indirect, incidental, or consequential damages including lost profits,
              lost data, or business interruption, even if advised of the possibility of such damages.
            </p>
          </section>

          <section aria-labelledby="termination">
            <h2 id="termination" className="text-2xl font-bold text-white mb-4">10. Termination</h2>
            <p className="text-sm">
              Either party may terminate the subscription at any time. We may terminate your account
              immediately for material breach of these Terms (including violations of the acceptable use
              policy) after providing written notice where practicable.
            </p>
            <p className="text-sm mt-3">
              Upon termination, you may export your data within 30 days. After 30 days, all data
              is permanently deleted except where retention is required by law.
            </p>
          </section>

          <section aria-labelledby="governing-law">
            <h2 id="governing-law" className="text-2xl font-bold text-white mb-4">11. Governing Law</h2>
            <p className="text-sm">
              These Terms are governed by the laws of the Republic of South Africa. Any disputes shall
              be resolved in the courts of South Africa. Both parties consent to the jurisdiction of
              South African courts.
            </p>
          </section>

          <section aria-labelledby="contact-legal">
            <h2 id="contact-legal" className="text-2xl font-bold text-white mb-4">12. Contact</h2>
            <div className="bg-gray-900 border border-white/8 rounded-xl p-6 text-sm space-y-2">
              <p><strong className="text-white">Legal enquiries:</strong>{' '}
                <a href={`mailto:${EMAIL}`} className="text-emerald-400 hover:underline">{EMAIL}</a>
              </p>
              <p><strong className="text-white">General:</strong>{' '}
                <a href="mailto:hello@mirembemuse.co.za" className="text-emerald-400 hover:underline">
                  hello@mirembemuse.co.za
                </a>
              </p>
              <p><strong className="text-white">Company:</strong> {COMPANY} · Registered in South Africa</p>
            </div>
          </section>
        </div>
      </main>

      <footer className="border-t border-white/5 py-8 text-center text-sm text-gray-600">
        <p>© {new Date().getFullYear()} {COMPANY} · <Link href="/privacy" className="hover:text-gray-400">Privacy</Link> · <Link href="/contact" className="hover:text-gray-400">Contact</Link></p>
      </footer>
    </div>
  )
}
