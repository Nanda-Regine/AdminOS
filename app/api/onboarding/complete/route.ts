import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.user_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('Tenant not found', { status: 403 })

  await supabaseAdmin.auth.admin.updateUserById(user.id, {
    user_metadata: {
      ...user.user_metadata,
      onboarding_completed: true,
    },
  })

  await supabaseAdmin.from('audit_logs').insert({
    tenant_id: tenantId,
    actor: user.id,
    action: 'onboarding.completed',
    metadata: {
      language: user.user_metadata?.onboarding_language ?? 'en',
      completed_at: new Date().toISOString(),
    },
  })

  return NextResponse.json({ ok: true })
}
