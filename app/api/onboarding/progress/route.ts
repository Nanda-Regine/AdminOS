import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'

const patchSchema = z.object({
  step: z.number().int().min(0).max(7),
  data: z.record(z.string(), z.unknown()).optional(),
  language: z.enum(['en', 'zu', 'xh', 'af', 'st']).optional(),
})

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.user_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('Tenant not found', { status: 403 })

  let body: z.infer<typeof patchSchema>
  try {
    body = patchSchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const existing = user.user_metadata?.onboarding_data as Record<string, unknown> ?? {}

  await supabaseAdmin.auth.admin.updateUserById(user.id, {
    user_metadata: {
      ...user.user_metadata,
      onboarding_step: body.step,
      onboarding_language: body.language ?? user.user_metadata?.onboarding_language ?? 'en',
      onboarding_data: { ...existing, ...(body.data ?? {}) },
    },
  })

  return NextResponse.json({ ok: true })
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  return NextResponse.json({
    step: user.user_metadata?.onboarding_step ?? 0,
    language: user.user_metadata?.onboarding_language ?? 'en',
    data: user.user_metadata?.onboarding_data ?? {},
    completed: user.user_metadata?.onboarding_completed === true,
  })
}
