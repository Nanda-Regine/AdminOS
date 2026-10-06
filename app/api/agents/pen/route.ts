import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { orchestrator } from '@/lib/ai/orchestrator'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { checkRateLimit } from '@/lib/security/rateLimit'
import { checkBudget } from '@/lib/ai/costControls'
import { z } from 'zod'
import { getContext } from '@/lib/auth/context'
import { can } from '@/lib/auth/roleMatrix'

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

  const tenantId = user.app_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('Tenant not found', { status: 403 })

  // Same gate as the Email Studio page and /api/email-drafts. It had none.
  const ctx = await getContext()
  if (!ctx || ctx.tenantId !== tenantId || !can(ctx, 'email.drafts')) {
    return NextResponse.json({ error: 'You do not have permission to use Email Studio.' }, { status: 403 })
  }

  const { success } = await checkRateLimit('agents', tenantId)
  if (!success) return NextResponse.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 })

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

  // Budget check
  const { data: tenant } = await supabaseAdmin
    .from('tenants').select('plan').eq('id', tenantId).single()
  const plan = tenant?.plan ?? 'solo'
  const budget = await checkBudget(tenantId, plan, 1500)
  if (!budget.allowed) {
    return NextResponse.json({ error: 'Daily AI budget exceeded. Try again tomorrow or upgrade your plan.' }, { status: 429 })
  }

  let stream: ReadableStream<Uint8Array>
  try {
    stream = await orchestrator.stream({
      agentName: 'pen',
      userMessage,
      tenantId,
      plan,
      metadata: { tone: body.tone, emailType: body.emailType, language: body.language },
    })
  } catch {
    return NextResponse.json({ error: 'Stream failed. Please try again.' }, { status: 500 })
  }

  // The draft is saved from the very text the user watched stream in. It used
  // to call the model a second time (double the AI cost, and a different email
  // from the one on screen) in a promise left running after the response —
  // which serverless kills, so drafts went missing at random. flush() runs
  // while the response is still open.
  if (body.saveDraft) {
    let text = ''
    let pending = ''
    const decoder = new TextDecoder()
    stream = stream.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        controller.enqueue(chunk)
        pending += decoder.decode(chunk, { stream: true })
        const lines = pending.split('\n')
        pending = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ') || line === 'data: [DONE]') continue
          try { text += (JSON.parse(line.slice(6)) as { text?: string }).text ?? '' } catch { /* not a text delta */ }
        }
      },
      async flush() {
        if (!text.trim()) return
        const subjectLine = text.split('\n').find((l) => l.trim().startsWith('Subject:'))
        const subject = subjectLine ? subjectLine.replace('Subject:', '').trim() : `${body.emailType} — ${body.recipientName}`
        const { error } = await supabaseAdmin.from('email_drafts').insert({
          tenant_id: tenantId,
          subject,
          body: text,
          recipient_email: body.recipientEmail,
          recipient_name: body.recipientName,
          email_type: body.emailType,   // NOT NULL
          category: body.emailType,
          tone_used: body.tone,
          language_used: body.language,
          status: 'draft',
        })
        if (error) console.error('[Pen] draft save failed:', error.message)
      },
    }))
  }

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
