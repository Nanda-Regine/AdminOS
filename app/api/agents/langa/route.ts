import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { chatWithLanga, LangaMessage } from '@/lib/ai/agents/langa'
import { z } from 'zod'

const schema = z.object({
  message: z.string().min(1).max(2000),
  history: z.array(z.object({
    role:    z.enum(['user', 'assistant']),
    content: z.string(),
  })).default([]),
})

export async function POST(request: Request) {
  // Support both cookie auth (web) and Bearer token auth (mobile)
  let user: { id: string; user_metadata: Record<string, unknown> } | null = null
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

  const tenantId = user.user_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  const plan = (user.user_metadata?.plan as string) ?? 'trial'

  let body: z.infer<typeof schema>
  try {
    body = schema.parse(await request.json())
  } catch (e) {
    return NextResponse.json({ error: 'Invalid request', detail: e }, { status: 400 })
  }

  const result = await chatWithLanga(
    tenantId,
    user.id,
    plan,
    body.message,
    body.history as LangaMessage[]
  )

  if (result.budgetExceeded) {
    return NextResponse.json({
      text:           result.text,
      budgetExceeded: true,
    }, { status: 429 })
  }

  return NextResponse.json({
    text:           result.text,
    model:          result.model,
    budgetExceeded: false,
  })
}
