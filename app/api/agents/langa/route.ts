import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
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
