import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'
import { checkPermission } from '@/lib/auth/permissions'

const connectSchema = z.object({
  platform:    z.enum(['facebook','instagram','google_reviews','twitter','linkedin']),
  accountId:   z.string().min(1).max(200),
  accountName: z.string().min(1).max(200),
  accessToken: z.string().min(1),
})

// GET /api/social/accounts — list connected social accounts
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.user_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('social_accounts')
    .select('id, platform, account_name, connected_at')  // exclude access_token
    .eq('tenant_id', tenantId)
    .order('platform')

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

// POST /api/social/accounts — connect a social account
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.user_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  if (!(await checkPermission('manage_settings'))) return new NextResponse('Forbidden', { status: 403 })

  let body: z.infer<typeof connectSchema>
  try { body = connectSchema.parse(await request.json()) } catch (e) {
    return NextResponse.json({ error: 'Invalid request', detail: e }, { status: 400 })
  }

  // Note: access_token is stored encrypted in production via Supabase Vault
  // For MVP it's stored as-is; add vault encryption before launch
  const { data, error } = await supabaseAdmin
    .from('social_accounts')
    .upsert({
      tenant_id:    tenantId,
      platform:     body.platform,
      account_id:   body.accountId,
      account_name: body.accountName,
      access_token: body.accessToken,
      connected_at: new Date().toISOString(),
    }, { onConflict: 'tenant_id,platform,account_id' })
    .select('id, platform, account_name, connected_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}

// DELETE /api/social/accounts?platform=facebook — disconnect
export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.user_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  if (!(await checkPermission('manage_settings'))) return new NextResponse('Forbidden', { status: 403 })

  const url      = new URL(request.url)
  const platform = url.searchParams.get('platform')
  if (!platform) return NextResponse.json({ error: 'platform param required' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('social_accounts')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('platform', platform)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return new NextResponse(null, { status: 204 })
}
