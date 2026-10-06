import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { inngest } from '@/inngest/client'
import { withRoute, unwrap, badRequest } from '@/lib/api/withRoute'

// Session 20 (sixth sitting):
// - contactIds weren't checked against this business: a survey row could
//   point at another tenant's contact (and GET then showed their name).
// - Customer answers moved to the public POST /api/survey/[token] (the old
//   PATCH here sat behind the login wall; customers can't log in), and the
//   link they get now opens a real page (/survey/[token]).

const sendSchema = z.object({
  contactIds:  z.array(z.string().uuid()).min(1).max(100),
  triggerType: z.string().regex(/^[a-z_]{1,50}$/).optional(),
  channel:     z.enum(['whatsapp', 'email', 'sms', 'in_app']).default('whatsapp'),
})

// POST /api/nps — send NPS surveys to some of this business's contacts.
export const POST = withRoute({
  action: 'broadcasts.send',
  body: sendSchema,
  audit: 'nps.surveys_sent',
  resourceType: 'nps_survey',
  rateLimit: 'agents',
  status: 201,
}, async ({ ctx, body }) => {
  const contacts = unwrap(await supabaseAdmin
    .from('contacts')
    .select('id, name:full_name, phone')
    .eq('tenant_id', ctx.tenantId)
    .is('deleted_at', null)
    .in('id', body.contactIds)) ?? []
  if (!contacts.length) throw badRequest('None of those contacts belong to this business.')

  const sentAt = new Date().toISOString()
  const surveys = unwrap(await supabaseAdmin
    .from('nps_surveys')
    .insert(contacts.map((c) => ({
      tenant_id:    ctx.tenantId,
      contact_id:   c.id,
      trigger_type: body.triggerType ?? 'manual',
      channel:      body.channel,
      sent_at:      sentAt,
    })))
    .select('id, contact_id, survey_token, channel')) ?? []

  if (body.channel === 'whatsapp' && surveys.length) {
    const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://adminos.co.za'
    const byId = new Map(contacts.map((c) => [c.id, c]))
    const events = surveys.flatMap((s) => {
      const c = byId.get(s.contact_id)
      return c?.phone ? [{
        name: 'adminos/nps.survey.created' as const,
        data: { tenant_id: ctx.tenantId, survey_token: s.survey_token, contact_phone: c.phone, contact_name: c.name ?? '', survey_url: `${base}/survey/${s.survey_token}` },
      }] : []
    })
    if (events.length) await inngest.send(events)
  }

  return { sent: surveys.length, skipped: body.contactIds.length - surveys.length, surveys }
})

// GET /api/nps?days=90 — surveys + the NPS score.
export const GET = withRoute({
  action: 'analytics.read',
  query: z.object({ days: z.coerce.number().int().min(1).max(365).default(90) }),
}, async ({ ctx, query }) => {
  const from = new Date(Date.now() - query.days * 86_400_000).toISOString()
  const data = unwrap(await supabaseAdmin
    .from('nps_surveys')
    .select('id, contact_id, trigger_type, sent_at, responded_at, score, comment, channel, contacts(name:full_name)')
    .eq('tenant_id', ctx.tenantId)
    .gte('sent_at', from)
    .order('sent_at', { ascending: false })
    .limit(1000)) ?? []

  const responded  = data.filter((s) => s.score !== null)
  const promoters  = responded.filter((s) => s.score! >= 9).length
  const detractors = responded.filter((s) => s.score! <= 6).length
  const total      = responded.length
  return {
    surveys: data,
    aggregate: {
      nps_score:      total > 0 ? Math.round(((promoters - detractors) / total) * 100) : null,
      response_count: total,
      sent_count:     data.length,
      promoters,
      passives:       total - promoters - detractors,
      detractors,
      response_rate:  data.length > 0 ? Math.round((total / data.length) * 100) : 0,
    },
  }
})
