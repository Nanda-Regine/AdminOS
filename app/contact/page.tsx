import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Contact — AdminOS',
  description:
    'Get in touch with the AdminOS team. Book a demo, ask about Enterprise pricing, or reach our support team.',
  alternates: { canonical: 'https://adminos.co.za/contact' },
}

export default function ContactPage() {
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
        <div className="text-center mb-14">
          <h1 className="text-4xl font-extrabold mb-4">Get in touch</h1>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">
            Whether you want to book a demo, ask about Enterprise pricing, or need support —
            we&apos;re here.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-14">
          {[
            {
              icon: '📅',
              title: 'Book a Demo',
              desc: "See AdminOS in action. We'll walk you through the 5 AI agents and answer any questions. 30 minutes.",
              cta: 'Schedule on Cal.com',
              href: 'https://cal.com/nanda/adminos-demo',
              external: true,
              primary: true,
            },
            {
              icon: '💬',
              title: 'Sales & Enterprise',
              desc: 'Interested in the Enterprise or White Label tier? Want a custom quote? Email our sales team.',
              cta: 'Email sales',
              href: 'mailto:hello@mirembemuse.co.za',
              external: false,
              primary: false,
            },
            {
              icon: '🛠️',
              title: 'Support',
              desc: 'Already a customer and need help? Reach our support team directly for fastest resolution.',
              cta: 'Email support',
              href: 'mailto:support@mirembemuse.co.za',
              external: false,
              primary: false,
            },
            {
              icon: '🔒',
              title: 'Privacy & Legal',
              desc: 'POPIA data requests, right-to-erasure, legal enquiries, or compliance questions.',
              cta: 'Email legal',
              href: 'mailto:legal@mirembemuse.co.za',
              external: false,
              primary: false,
            },
          ].map((card) => (
            <div
              key={card.title}
              className={`rounded-2xl border p-6 flex flex-col gap-4 ${
                card.primary
                  ? 'bg-emerald-900/30 border-emerald-700/40'
                  : 'bg-gray-900 border-white/8'
              }`}
            >
              <div className="text-3xl" aria-hidden="true">{card.icon}</div>
              <div>
                <h2 className="font-bold text-white text-lg">{card.title}</h2>
                <p className="text-sm text-gray-400 mt-1 leading-relaxed">{card.desc}</p>
              </div>
              <a
                href={card.href}
                target={card.external ? '_blank' : undefined}
                rel={card.external ? 'noopener noreferrer' : undefined}
                className={`inline-block text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors text-center ${
                  card.primary
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    : 'border border-white/15 text-white hover:bg-white/5'
                }`}
              >
                {card.cta} {card.external ? '→' : ''}
              </a>
            </div>
          ))}
        </div>

        <div className="bg-gray-900 border border-white/8 rounded-2xl p-8 text-center">
          <h2 className="text-2xl font-bold mb-3">Frequently answered before contacting us</h2>
          <p className="text-gray-400 text-sm mb-6">
            Most questions are answered in our FAQ. Check there first for the fastest answer.
          </p>
          <Link
            href="/#faq"
            className="inline-block bg-white/5 border border-white/10 text-white px-6 py-3 rounded-xl text-sm font-semibold hover:bg-white/10 transition-colors"
          >
            View FAQ →
          </Link>
        </div>

        <div className="mt-12 text-center text-sm text-gray-600 space-y-1">
          <p>Mirembe Muse (Pty) Ltd · adminos.co.za</p>
          <p>
            <a href="https://twitter.com/CreativelyNanda" className="hover:text-gray-400 transition-colors" target="_blank" rel="noopener noreferrer">
              @CreativelyNanda
            </a>
            {' '}·{' '}
            <a href="https://creativelynanda.co.za" className="hover:text-gray-400 transition-colors" target="_blank" rel="noopener noreferrer">
              creativelynanda.co.za
            </a>
          </p>
        </div>
      </main>

      <footer className="border-t border-white/5 py-8 text-center text-sm text-gray-600">
        <p>© {new Date().getFullYear()} Mirembe Muse (Pty) Ltd · <Link href="/privacy" className="hover:text-gray-400">Privacy</Link> · <Link href="/terms" className="hover:text-gray-400">Terms</Link></p>
      </footer>
    </div>
  )
}
