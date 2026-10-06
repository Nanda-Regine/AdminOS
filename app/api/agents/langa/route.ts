import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { streamLanga, LangaMessage } from '@/lib/ai/agents/langa'
import { checkRateLimit } from '@/lib/security/rateLimit'
import { z } from 'zod'
import { getContext } from '@/lib/auth/context'
import { can } from '@/lib/auth/roleMatrix'
import { tenantAI } from '@/lib/ai/callClaude'

const schema = z.object({
  message: z.string().min(1).max(2000),
  // Bounded: history is re-sent to the model, so unbounded turns were an
  // unmetered way to inflate input tokens. The web page sends the whole chat,
  // so trim to the 20 turns streamLanga uses rather than reject a long one.
  history: z.array(z.object({
    role:    z.enum(['user', 'assistant']),
    content: z.string().max(20000),
  })).max(1000).default([]).transform(h => h.slice(-20)),
})

export async function POST(request: Request) {
  // Support both cookie auth (web) and Bearer token auth (mobile)
  let user: { id: string; app_metadata: Record<string, unknown> } | null = null
  const authHeader = request.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { data } = await admin.auth.getUser(token)
    user = data.user
  } else {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    user = data.user
  }
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.app_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  // Langa reads the business's financials, debtors and payroll to answer —
  // management only (analytics.read). It had no role check, so any staff
  // login could ask it for the revenue figures and spend the AI budget.
  // getContext() (not a bare role lookup) so super-admins pass, a tenant_id
  // the caller was never granted fails closed, and bearer tokens work.
  const ctx = await getContext()
  if (!ctx || ctx.tenantId !== tenantId || !can(ctx, 'analytics.read')) {
    return NextResponse.json({ error: 'Langa is available to owners and managers.' }, { status: 403 })
  }

  // Same 'agents' limiter as /api/agents/[agentType] — Langa is bounded
  // by a daily token budget (checkBudget, inside streamLanga) but that's
  // not a per-request rate limiter, so a tight burst loop can still run
  // up real Claude API cost before the daily meter trips.
  const { success } = await checkRateLimit('agents', tenantId)
  if (!success) return new NextResponse('Too Many Requests', { status: 429 })

  // The plan lives on tenants.plan. app_metadata.plan is usually unset, so
  // every tenant was metered as 'trial' (the smallest daily budget).
  const { plan } = await tenantAI(tenantId)

  let body: z.infer<typeof schema>
  try {
    body = schema.parse(await request.json())
  } catch (e) {
    const fields = e instanceof z.ZodError ? e.issues.map(i => i.path.join('.')) : undefined
    return NextResponse.json({ error: 'Invalid request', code: 'invalid_body', fields }, { status: 400 })
  }

  const result = await streamLanga(
    tenantId,
    user.id,
    plan,
    body.message,
    body.history as LangaMessage[]
  )

  // Budget check happens before the stream opens — return a plain 429 so the
  // client can show the limit message without opening an SSE reader.
  if (result.budgetExceeded || !result.stream) {
    return NextResponse.json({
      text:           result.text ?? 'Langa is unavailable right now. Please try again.',
      budgetExceeded: true,
    }, { status: 429 })
  }

  // Stream tokens as Server-Sent Events: `data: {"text": "..."}` … `data: [DONE]`.
  return new Response(result.stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
      'X-Langa-Model': result.model,
    },
  })
}
