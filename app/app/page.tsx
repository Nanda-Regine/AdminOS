import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Get the AdminOS app',
  description: 'Payslips, leave, clock-in and your team — AdminOS on your phone. Android (Google Play) and Huawei AppGallery.',
  alternates: { canonical: 'https://adminos.co.za/app' },
}

// Linked from every staff invite WhatsApp. Store links come from env so they
// can be set the day each listing goes live, without a code change.
const PLAY = process.env.NEXT_PUBLIC_PLAY_STORE_URL
const APPGALLERY = process.env.NEXT_PUBLIC_APPGALLERY_URL

export default function GetTheAppPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <header className="border-b border-white/5">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <Link href="/" className="font-bold">AdminOS</Link>
        </div>
      </header>
      <main className="flex-1 max-w-3xl mx-auto px-6 py-12 space-y-8">
        <div>
          <h1 className="text-3xl font-extrabold mb-3">Get the AdminOS app</h1>
          <p className="text-gray-300">
            See your payslips, request leave, clock in and out, claim expenses and read company
            announcements — from your phone. Free for employees.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {PLAY ? (
            <a href={PLAY} className="rounded-2xl bg-white text-gray-900 px-5 py-4 font-semibold text-center">
              Get it on Google Play
            </a>
          ) : (
            <div className="rounded-2xl border border-white/10 px-5 py-4 text-center text-gray-400">Google Play — coming soon</div>
          )}
          {APPGALLERY ? (
            <a href={APPGALLERY} className="rounded-2xl bg-red-600 text-white px-5 py-4 font-semibold text-center">
              Explore it on AppGallery
            </a>
          ) : (
            <div className="rounded-2xl border border-white/10 px-5 py-4 text-center text-gray-400">Huawei AppGallery — coming soon</div>
          )}
        </div>

        <section className="space-y-2 text-gray-300">
          <h2 className="text-lg font-bold text-white">Got an invite code from your employer?</h2>
          <ol className="list-decimal pl-6 space-y-1">
            <li>Install the app and open it.</li>
            <li>Tap <strong className="text-white">I have an invite code</strong>.</li>
            <li>Enter the code, choose a password, and you&apos;re in.</li>
          </ol>
          <p className="text-sm text-gray-400">No email address? That&apos;s fine — the app gives you a staff login instead.</p>
        </section>

        <p className="text-sm text-gray-400">
          Business owner? <Link href="/signup" className="text-emerald-400 underline">Create your business account</Link> on the web first,
          then sign in to the app with the same details.
        </p>
      </main>
    </div>
  )
}
