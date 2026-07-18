import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { writeAuditLog, getClientIp } from '@/lib/security/audit'
import { requireSuperAdmin } from '@/lib/auth/context'

export async function GET(request: Request) {
  const admin = await requireSuperAdmin()
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
  const admin = await requireSuperAdmin()
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
    critical: true,   // operator mutation — an unlogged tenant change is not acceptable
  })

  return NextResponse.json(data)
}
