import { NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { checkRateLimit } from '@/lib/security/rateLimit'
import { getClientIp } from '@/lib/security/audit'
import { notifyTenant } from '@/lib/notifications/notify'

// POST /api/survey/[token] { score, comment? } — @public: a customer answers
// the NPS survey a business sent them. The token is the only credential, so it
// answers exactly one survey, once. Replaces PATCH /api/nps, which sat behind
// the login wall — customers have no login, so no survey could ever be answered.

const schema = z.object({
  score:   z.number().int().min(0).max(10),
  comment: z.string().trim().max(2000).optional(),
})

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!UUID.test(token)) return NextResponse.json({ error: 'Survey not found' }, { status: 404 })

  const { success } = await checkRateLimit('api', `survey:${getClientIp(request)}`)
  if (!success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Please choose a score from 0 to 10.' }, { status: 400 })

  // Conditional on still being unanswered, so a double-submit records once.
  const { data: survey } = await supabaseAdmin
    .from('nps_surveys')
    .update({ score: parsed.data.score, comment: parsed.data.comment || null, responded_at: new Date().toISOString() })
    .eq('survey_token', token)
    .is('responded_at', null)
    .select('tenant_id, contact_id')
    .maybeSingle()
  if (!survey) return NextResponse.json({ error: 'This survey has already been answered or no longer exists.' }, { status: 404 })

  // A detractor (0–6) is something the owner should hear about today. (This
  // used to fire an Academy-lesson event with the contact's id as a user id.)
  if (parsed.data.score <= 6) {
    const { data: contact } = survey.contact_id
      ? await supabaseAdmin.from('contacts').select('full_name').eq('id', survey.contact_id).eq('tenant_id', survey.tenant_id).maybeSingle()
      : { data: null }
    const who = contact?.full_name ?? 'A customer'
    await notifyTenant(survey.tenant_id, {
      type: 'nps.detractor',
      title: `${who} scored you ${parsed.data.score}/10`,
      body: parsed.data.comment ? `"${parsed.data.comment.slice(0, 280)}"` : 'No comment left. A quick call may turn this around.',
      actionUrl: survey.contact_id ? `/dashboard/contacts/${survey.contact_id}` : '/dashboard/contacts',
      whatsapp: true,
    }).catch(() => undefined)
  }
  return NextResponse.json({ ok: true })
}
