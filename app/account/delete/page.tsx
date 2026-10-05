import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { DeleteAccountForm } from './DeleteAccountForm'

export const metadata: Metadata = {
  title: 'Delete your account — AdminOS',
  description: 'How to delete your AdminOS login, what is deleted, and what your employer must keep by law.',
  alternates: { canonical: 'https://adminos.co.za/account/delete' },
}

const PRIVACY_EMAIL = 'privacy@mirembemuse.co.za'

// Public by design (middleware PUBLIC_PATHS): Google Play and Huawei AppGallery
// require a web page where users can request account deletion without the app.
export default async function DeleteAccountPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-white/5">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="font-bold">AdminOS</Link>
          <Link href="/privacy" className="text-sm text-gray-400 hover:text-white">Privacy policy</Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12 space-y-10 text-gray-300">
        <div>
          <h1 className="text-3xl font-extrabold text-white mb-3">Delete your AdminOS account</h1>
          <p>
            AdminOS is operated by Mirembe Muse (Pty) Ltd. You can delete your login at any time —
            in the app under <strong className="text-white">More → Account → Delete my account</strong>,
            or on this page.
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white">What happens</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong className="text-white">Immediately:</strong> your login is disabled, you are signed out of the app, and your phone stops receiving AdminOS notifications.</li>
            <li><strong className="text-white">After 30 days:</strong> your email address, name and login details are permanently anonymised. Until then, a deletion made by mistake can be reversed by emailing <a className="text-emerald-400 underline" href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white">What is kept, and why</h2>
          <p>
            If you are an employee, your employer&apos;s records about your work — payslips, leave,
            attendance and tax certificates — belong to your employer, who must keep them by law
            (Basic Conditions of Employment Act s31: 3 years; Tax Administration Act s29: 5 years).
            Deleting your login does not delete those records; it removes your access to them.
            You can ask your employer for copies at any time.
          </p>
          <p>
            If you are a business owner, deleting your login does not close your business or delete its
            records. To close the business and export or erase its data, email{' '}
            <a className="text-emerald-400 underline" href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>.
          </p>
        </section>

        <section className="space-y-4 bg-white/5 border border-white/10 rounded-2xl p-6">
          <h2 className="text-xl font-bold text-white">Request deletion</h2>
          {user ? (
            <DeleteAccountForm email={user.email ?? ''} />
          ) : (
            <div className="space-y-3">
              <p>
                <Link href="/login?redirect=/account/delete" className="text-emerald-400 underline">Sign in</Link>{' '}
                and return to this page to delete your account straight away.
              </p>
              <p>
                Can&apos;t sign in? Email <a className="text-emerald-400 underline" href={`mailto:${PRIVACY_EMAIL}?subject=Delete%20my%20AdminOS%20account`}>{PRIVACY_EMAIL}</a>{' '}
                from the email address on your account (or include your employer&apos;s name and your phone number
                if you sign in with a staff login). We action requests within 30 days, as POPIA requires.
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
