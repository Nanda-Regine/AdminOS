import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'

const schema = z.object({
  token:    z.string().min(10),
  platform: z.enum(['ios', 'android', 'web']),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.user_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  let body: z.infer<typeof schema>
  try {
    body = schema.parse(await request.json())
  } catch (e) {
    return NextResponse.json({ error: 'Invalid request', detail: e }, { status: 400 })
  }

  // Upsert by (user_id, token) — safe to re-register on app relaunch
  const { error } = await supabaseAdmin
    .from('push_tokens')
    .upsert({
      user_id:   user.id,
      tenant_id: tenantId,
      token:     body.token,
      platform:  body.platform,
    }, { onConflict: 'user_id, token' })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}
