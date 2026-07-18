import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sendWhatsApp } from '@/lib/whatsapp/send'
import { verifyTwilioSignature, twilioWebhookUrl } from '@/lib/security/twilio'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const body   = await request.text()
  const fields = Object.fromEntries(new URLSearchParams(body))

  // This webhook mutates call logs and sends WhatsApp on the tenant's behalf.
  // Reject anything not signed by Twilio (fails closed if TWILIO_AUTH_TOKEN unset).
  if (!verifyTwilioSignature(twilioWebhookUrl('/api/voice/status'), fields, request.headers.get('x-twilio-signature'))) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const callSid      = fields.CallSid      || ''
  const callStatus   = fields.CallStatus   || ''
  const duration     = fields.CallDuration ? parseInt(fields.CallDuration) : null
  const recordingUrl = fields.RecordingUrl || null

  const statusMap: Record<string, string> = {
    completed:   'completed',
    busy:        'no-answer',
    'no-answer': 'no-answer',
    failed:      'failed',
    canceled:    'failed',
  }
  const mappedStatus = statusMap[callStatus] ?? callStatus

  const { data: callLog } = await supabaseAdmin
    .from('call_logs')
    .update({
      status:        mappedStatus,
      duration_sec:  duration,
      recording_url: recordingUrl,
      ended_at:      new Date().toISOString(),
    })
    .eq('twilio_call_sid', callSid)
    .select('id, tenant_id, from_number, summary, transcript')
    .maybeSingle()

  // Auto WhatsApp follow-up on completed calls
  if (callLog && mappedStatus === 'completed') {
    const { tenant_id: tenantId, from_number: from, summary, transcript } = callLog

    const { data: tenant } = await supabaseAdmin
      .from('tenants')
      .select('name')
      .eq('id', tenantId)
      .single()

    const businessName = tenant?.name ?? 'our team'
    const callSummary  = summary
      ?? (transcript ? `We spoke about: ${(transcript as string).slice(0, 120)}…` : null)
      ?? 'a general enquiry'

    const message =
      `Hi! Thanks for calling ${businessName}.\n\n` +
      `Here's a summary of our call: ${callSummary}\n\n` +
      `We'll be in touch shortly. Reply here if you need anything.`

    await sendWhatsApp({ to: from, message }).catch(() => {})

    await supabaseAdmin
      .from('call_logs')
      .update({ whatsapp_sent: true })
      .eq('twilio_call_sid', callSid)
      .then(() => {}, () => {})
  }

  return new NextResponse('OK', { status: 200 })
}
