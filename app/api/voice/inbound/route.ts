import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { callClaudeAgent } from '@/lib/ai/callClaude'
import { sanitizeForAI } from '@/lib/security/sanitize'

export const runtime = 'nodejs'

function twiml(xml: string): NextResponse {
  return new NextResponse(xml, {
    headers: { 'Content-Type': 'text/xml' },
  })
}

function buildGreetTwiML(greeting: string, gatherUrl: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" action="${gatherUrl}" method="POST" speechTimeout="3" language="en-ZA">
    <Say voice="Polly.Ayanda-Neural">${greeting}</Say>
  </Gather>
  <Say voice="Polly.Ayanda-Neural">Sorry, I didn't catch that. Please call back and try again.</Say>
  <Hangup/>
</Response>`
}

function buildResponseTwiML(response: string, continueUrl: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" action="${continueUrl}" method="POST" speechTimeout="3" language="en-ZA">
    <Say voice="Polly.Ayanda-Neural">${response}</Say>
  </Gather>
  <Say voice="Polly.Ayanda-Neural">Thank you for calling. Goodbye.</Say>
  <Hangup/>
</Response>`
}

function buildTransferTwiML(transferTo: string, message: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Ayanda-Neural">${message}</Say>
  <Dial>${transferTo}</Dial>
</Response>`
}

export async function POST(request: NextRequest) {
  const body   = await request.text()
  const params = Object.fromEntries(new URLSearchParams(body))

  const callSid   = params.CallSid   || ''
  const from      = params.From      || ''
  const to        = params.To        || ''
  const speechResult = params.SpeechResult || ''

  // Look up tenant by Twilio number
  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('id, name, twilio_phone_number')
    .eq('twilio_phone_number', to)
    .single()

  if (!tenant) {
    return twiml(`<?xml version="1.0" encoding="UTF-8"?>
<Response><Say>Thank you for calling. Goodbye.</Say><Hangup/></Response>`)
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://adminos.co.za'
  const continueUrl = `${appUrl}/api/voice/inbound`

  // New call — no speech yet, play greeting
  if (!speechResult) {
    // Upsert a call log record
    await supabaseAdmin.from('call_logs').insert({
      tenant_id:      tenant.id,
      twilio_call_sid: callSid,
      direction:      'inbound',
      from_number:    from,
      to_number:      to,
      status:         'in-progress',
      ai_handled:     true,
    }).then(() => {}, () => {})

    const greeting = `Thank you for calling ${tenant.name}. I'm your AI assistant. How can I help you today?`
    return twiml(buildGreetTwiML(greeting, continueUrl))
  }

  // Existing call — process speech
  const safeText = sanitizeForAI(speechResult)

  // Get call log + conversation history
  const { data: callLog } = await supabaseAdmin
    .from('call_logs')
    .select('id, transcript')
    .eq('twilio_call_sid', callSid)
    .single()

  const prevTranscript = callLog?.transcript || ''
  const updatedTranscript = prevTranscript
    ? `${prevTranscript}\nCaller: ${safeText}`
    : `Caller: ${safeText}`

  // Build AI prompt
  const systemPrompt = `You are a professional AI voice assistant for ${tenant.name}.
Keep responses SHORT (under 30 words) — this is a phone call.
Be warm, professional, and helpful. Speak naturally.
If the caller needs to speak to a human, say TRANSFER_TO_STAFF at the start of your response.
Current conversation:
${updatedTranscript}`

  let aiResponse = ''
  let shouldTransfer = false

  try {
    const result = await callClaudeAgent(systemPrompt, safeText, 100)
    aiResponse = result || 'I apologise, I had trouble understanding. Could you repeat that?'
    shouldTransfer = aiResponse.startsWith('TRANSFER_TO_STAFF')
    if (shouldTransfer) {
      aiResponse = aiResponse.replace('TRANSFER_TO_STAFF', '').trim()
    }
  } catch {
    aiResponse = 'I apologise, I am having technical difficulties. Please hold while I transfer you.'
    shouldTransfer = true
  }

  // Update call log
  const fullTranscript = `${updatedTranscript}\nAssistant: ${aiResponse}`
  await supabaseAdmin
    .from('call_logs')
    .update({
      transcript: fullTranscript,
      status:     shouldTransfer ? 'transferred' : 'in-progress',
    })
    .eq('twilio_call_sid', callSid)
    .then(() => {}, () => {})

  if (shouldTransfer) {
    // Get staff transfer number from tenant
    const { data: staffMember } = await supabaseAdmin
      .from('staff')
      .select('phone')
      .eq('tenant_id', tenant.id)
      .eq('department', 'management')
      .limit(1)
      .single()

    const transferTo = staffMember?.phone || to
    const transferMsg = aiResponse || 'Let me transfer you to a team member who can help.'
    return twiml(buildTransferTwiML(transferTo, transferMsg))
  }

  return twiml(buildResponseTwiML(aiResponse, continueUrl))
}
