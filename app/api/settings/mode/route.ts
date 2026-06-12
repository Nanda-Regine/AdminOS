import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/permissions'
import { TenantMode } from '@/lib/tenant/mode'

const schema = z.object({
  mode: z.enum(['solo', 'team']),
})

export async function GET(_request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.user_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  const { data } = await supabaseAdmin
    .from('tenants')
    .select('mode')
    .eq('id', tenantId)
    .single()

  return NextResponse.json({ mode: (data?.mode as TenantMode) ?? 'solo' })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.user_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  try { await requirePermission('manage_settings') } catch {
    return new NextResponse('Forbidden', { status: 403 })
  }

  let body: z.infer<typeof schema>
  try {
    body = schema.parse(await request.json())
  } catch (e) {
    return NextResponse.json({ error: 'Invalid request', detail: e }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('tenants')
    .update({ mode: body.mode })
    .eq('id', tenantId)
    .select('id, mode')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json(data)
}
