import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { orchestrator } from '@/lib/ai/orchestrator'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { checkRateLimit } from '@/lib/security/rateLimit'
import { z } from 'zod'

const bodySchema = z.object({
  tone: z.enum(['formal', 'friendly', 'firm', 'urgent']),
  emailType: z.enum(['invoice', 'follow_up', 'proposal', 'welcome', 'notice', 'custom']),
  recipientName: z.string().min(1).max(200),
  recipientEmail: z.string().email(),
  context: z.string().min(1).max(5000),
  language: z.enum(['en', 'af', 'zu', 'xh', 'st']).default('en'),
  saveDraft: z.boolean().default(true),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.user_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('Tenant not found', { status: 403 })

  const { success } = await checkRateLimit('agents', tenantId)
  if (!success) return new NextResponse('Too Many Requests', { status: 429 })

  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const langLabel: Record<string, string> = { en: 'English', af: 'Afrikaans', zu: 'Zulu', xh: 'Xhosa', st: 'Sotho' }

  const userMessage = `Write a ${body.tone} ${body.emailType} email in ${langLabel[body.language]}.
Recipient: ${body.recipientName} (${body.recipientEmail})
Context: ${body.context}

Include:
1. A clear subject line (prefix with "Subject: ")
2. Professional greeting
3. Body paragraphs
4. Clear call to action
5. Professional sign-off`

  const stream = await orchestrator.stream({
    agentName: 'pen',
    userMessage,
    tenantId,
    metadata: { tone: body.tone, emailType: body.emailType, language: body.language },
  })

  if (body.saveDraft) {
    orchestrator.run({
      agentName: 'pen',
      userMessage,
      tenantId,
      metadata: { tone: body.tone, emailType: body.emailType },
    }).then(async (result) => {
      const lines = result.response.split('\n')
      const subjectLine = lines.find((l) => l.startsWith('Subject:'))
      const subject = subjectLine ? subjectLine.replace('Subject:', '').trim() : `${body.emailType} — ${body.recipientName}`

      await supabaseAdmin.from('email_drafts').insert({
        tenant_id: tenantId,
        subject,
        body: result.response,
        recipient_email: body.recipientEmail,
        recipient_name: body.recipientName,
        category: body.emailType,
        tone_used: body.tone,
        status: 'draft',
      })
    }).catch(() => {})
  }

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
