import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'
import { chatWithLanga, LangaMessage } from '@/lib/ai/agents/langa'
import { sanitizeForAI } from '@/lib/security/sanitize'
import { fireBusinessEvent } from '@/lib/academy/knowledgeGraph'

const chatSchema = z.object({
  message: z.string().min(1).max(2000),
  history: z.array(z.object({
    role:    z.enum(['user', 'assistant']),
    content: z.string().max(4000),
  })).max(20).default([]),
  conversationId: z.string().uuid().optional(),
})

// POST /api/langa — send a message to Langa, get a response
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.app_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  let body: z.infer<typeof chatSchema>
  try { body = chatSchema.parse(await request.json()) } catch (e) {
    return NextResponse.json({ error: 'Invalid request', detail: e }, { status: 400 })
  }

  // Sanitize message before passing to AI
  const safeMessage = sanitizeForAI(body.message)

  // Get tenant plan (needed for model routing and budget)
  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('plan')
    .eq('id', tenantId)
    .single()

  const plan = tenant?.plan ?? 'solo'

  const history: LangaMessage[] = body.history.map(m => ({
    role:    m.role,
    content: sanitizeForAI(m.content),
  }))

  const response = await chatWithLanga(tenantId, user.id, plan, safeMessage, history)

  if (response.budgetExceeded) {
    return NextResponse.json({ error: response.text, code: 'budget_exceeded' }, { status: 429 })
  }

  // Store conversation in Supabase for history
  if (body.conversationId) {
    await supabaseAdmin.from('langa_conversations').upsert({
      id:           body.conversationId,
      tenant_id:    tenantId,
      user_id:      user.id,
      messages:     [
        ...body.history,
        { role: 'user', content: safeMessage },
        { role: 'assistant', content: response.text },
      ],
      updated_at:   new Date().toISOString(),
    }, { onConflict: 'id' }).select()
  }

  // Fire 'langa.first_chat' event on first-ever message
  if (body.history.length === 0) {
    fireBusinessEvent('langa.first_chat', tenantId, user.id)
  }

  return NextResponse.json({
    reply:     response.text,
    model:     response.model,
    timestamp: new Date().toISOString(),
  })
}

// GET /api/langa — list recent Langa conversations for this user
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.app_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('langa_conversations')
    .select('id, messages, created_at, updated_at')
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(10)

  if (error) {
    // Table may not exist yet — return empty gracefully
    return NextResponse.json([])
  }

  return NextResponse.json(data)
}
