import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { writeAuditLog, getClientIp } from '@/lib/security/audit'

// Super admin only — verified against DB admins table, NOT JWT metadata.
// Users can write to user_metadata via supabase.auth.updateUser() (client SDK),
// so JWT metadata alone is a privilege-escalation vector. The admins table is
// only writable via the service role (supabaseAdmin), making it tamper-proof.
async function requireSuperAdmin(_request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data: adminRecord } = await supabaseAdmin
    .from('admins')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!adminRecord) return null
  return user
}

export async function GET(request: Request) {
  const admin = await requireSuperAdmin(request)
  if (!admin) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const url = new URL(request.url)
  const page = parseInt(url.searchParams.get('page') || '1')
  const limit = parseInt(url.searchParams.get('limit') || '50')
  const offset = (page - 1) * limit

  const { data, count } = await supabaseAdmin
    .from('tenants')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  return NextResponse.json({ tenants: data, total: count, page, limit })
}

export async function PATCH(request: Request) {
  const admin = await requireSuperAdmin(request)
  if (!admin) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const body = await request.json()
  const { id, ...updates } = body

  // Only allow specific fields to be updated by super admin
  const allowed = ['plan', 'active', 'name', 'slug']
  const filtered = Object.fromEntries(
    Object.entries(updates).filter(([k]) => allowed.includes(k))
  )

  const { data, error } = await supabaseAdmin
    .from('tenants')
    .update(filtered)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  await writeAuditLog({
    actor: admin.id,
    action: 'admin.tenant.updated',
    resourceType: 'tenant',
    resourceId: id,
    ipAddress: getClientIp(request),
    metadata: filtered,
  })

  return NextResponse.json(data)
}
