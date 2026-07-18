import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'
import { fireBusinessEvent } from '@/lib/academy/knowledgeGraph'
import { inngest } from '@/inngest/client'

const sendSchema = z.object({
  contactIds:  z.array(z.string().uuid()).min(1).max(100),
  triggerType: z.string().max(50).optional(),
  channel:     z.enum(['whatsapp', 'email', 'sms', 'in_app']).default('whatsapp'),
})

const respondSchema = z.object({
  token:   z.string().min(1),
  score:   z.number().int().min(0).max(10),
  comment: z.string().max(2000).optional(),
})

// POST /api/nps — send NPS surveys
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.app_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  let body: z.infer<typeof sendSchema>
  try { body = sendSchema.parse(await request.json()) } catch (e) {
    return NextResponse.json({ error: 'Invalid request', detail: e }, { status: 400 })
  }

  const rows = body.contactIds.map((contactId) => ({
    tenant_id:    tenantId,
    contact_id:   contactId,
    trigger_type: body.triggerType ?? 'manual',
    channel:      body.channel,
    sent_at:      new Date().toISOString(),
  }))

  const { data, error } = await supabaseAdmin
    .from('nps_surveys')
    .insert(rows)
    .select('id, contact_id, survey_token, channel')

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Queue WhatsApp delivery for each survey
  if (body.channel === 'whatsapp' && data?.length) {
    const contactIds = data.map(s => s.contact_id)
    const { data: contacts } = await supabaseAdmin
      .from('contacts')
      .select('id, name:full_name, phone')
      .in('id', contactIds)
      .eq('tenant_id', tenantId)

    for (const survey of data) {
      const contact = contacts?.find(c => c.id === survey.contact_id)
      if (!contact?.phone) continue

      const surveyUrl = `${process.env.NEXT_PUBLIC_APP_URL}/survey/${survey.survey_token}`
      await inngest.send({
        name: 'adminos/nps.survey.created',
        data: {
          tenant_id:     tenantId,
          survey_token:  survey.survey_token,
          contact_phone: contact.phone,
          contact_name:  contact.name ?? '',
          survey_url:    surveyUrl,
        },
      })
    }
  }

  return NextResponse.json({ sent: data?.length ?? 0, surveys: data }, { status: 201 })
}

// GET /api/nps — list surveys + aggregate score
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.app_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  const url  = new URL(request.url)
  const days = Math.min(parseInt(url.searchParams.get('days') ?? '90'), 365)
  const from = new Date(Date.now() - days * 86400000).toISOString()

  const { data, error } = await supabaseAdmin
    .from('nps_surveys')
    .select('id, contact_id, trigger_type, sent_at, responded_at, score, comment, channel, contacts(name)')
    .eq('tenant_id', tenantId)
    .gte('sent_at', from)
    .order('sent_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Aggregate NPS score
  const responded = (data ?? []).filter(s => s.score !== null)
  const promoters  = responded.filter(s => s.score! >= 9).length
  const detractors = responded.filter(s => s.score! <= 6).length
  const total      = responded.length
  const npsScore   = total > 0 ? Math.round(((promoters - detractors) / total) * 100) : null

  return NextResponse.json({
    surveys:      data ?? [],
    aggregate: {
      nps_score:      npsScore,
      response_count: total,
      sent_count:     (data ?? []).length,
      promoters,
      passives:       responded.filter(s => s.score! >= 7 && s.score! <= 8).length,
      detractors,
      response_rate:  (data ?? []).length > 0
        ? Math.round((total / (data ?? []).length) * 100)
        : 0,
    },
  })
}

// PATCH /api/nps — record survey response (public endpoint — validated by token only)
export async function PATCH(request: Request) {
  let body: z.infer<typeof respondSchema>
  try { body = respondSchema.parse(await request.json()) } catch (e) {
    return NextResponse.json({ error: 'Invalid request', detail: e }, { status: 400 })
  }

  const { data: survey, error } = await supabaseAdmin
    .from('nps_surveys')
    .select('id, tenant_id, contact_id, score')
    .eq('survey_token', body.token)
    .is('responded_at', null)
    .maybeSingle()

  if (error || !survey) {
    return NextResponse.json({ error: 'Survey not found or already completed' }, { status: 404 })
  }

  await supabaseAdmin
    .from('nps_surveys')
    .update({
      score:        body.score,
      comment:      body.comment ?? null,
      responded_at: new Date().toISOString(),
    })
    .eq('id', survey.id)

  // Fire contextual trigger for detractors
  if (body.score <= 6 && survey.contact_id) {
    fireBusinessEvent('customer.nps_below_6', survey.tenant_id, survey.contact_id)
  }

  return NextResponse.json({ ok: true })
}
