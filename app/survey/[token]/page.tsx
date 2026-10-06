export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { SurveyForm } from './SurveyForm'

// Public NPS survey: the link a business's customer gets on WhatsApp
// (/api/nps → adminos/nps.survey.created). It 404'd until Session 20.
export const metadata: Metadata = { title: 'Quick question', robots: { index: false, follow: false } }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

export default async function SurveyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const survey = UUID.test(token)
    ? (await supabaseAdmin.from('nps_surveys').select('tenant_id, responded_at').eq('survey_token', token).maybeSingle()).data
    : null
  const { data: tenant } = survey
    ? await supabaseAdmin.from('tenants').select('name').eq('id', survey.tenant_id).maybeSingle()
    : { data: null }
  const business = tenant?.name ?? 'us'

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-center px-4 py-10">
      <main className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 space-y-5">
        {!survey ? (
          <p className="text-sm text-white/70">This survey link isn&apos;t valid. If you followed a link from a message, it may have been mistyped.</p>
        ) : survey.responded_at ? (
          <p className="text-sm text-white/70">You&apos;ve already answered. Thank you for your feedback!</p>
        ) : (
          <>
            <h1 className="text-lg font-semibold leading-snug">
              How likely are you to recommend {business} to a friend or colleague?
            </h1>
            <SurveyForm token={token} business={business} />
          </>
        )}
        <p className="text-[11px] text-white/30">Your answer goes only to {business}.</p>
      </main>
    </div>
  )
}
