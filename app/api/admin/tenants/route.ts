import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { writeAuditLog, getClientIp } from '@/lib/security/audit'
import { requireSuperAdmin } from '@/lib/auth/context'
import { dbError } from '@/lib/api/guard'
import { z } from 'zod'

// Only these fields, with valid values; at least one.
const patchSchema = z.object({
  id:     z.string().uuid(),
  plan:   z.enum(['trial', 'solo', 'grow', 'operate', 'scale', 'partner']).optional(),
  active: z.boolean().optional(),
  name:   z.string().trim().min(1).max(200).optional(),
  slug:   z.string().trim().regex(/^[a-z0-9-]{2,60}$/).optional(),
  // Meta WhatsApp Cloud API phone-number ID, after the business's number is
  // onboarded in Meta Business Manager. Routes inbound + sends as the business.
  meta_phone_number_id: z.string().regex(/^\d{8,20}$/).nullable().optional(),
}).strict().refine((b) => Object.keys(b).length > 1, { message: 'Nothing to change' })

export async function GET(request: Request) {
  const admin = await requireSuperAdmin()
  if (!admin) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const url = new URL(request.url)
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1') || 1)
  const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get('limit') || '50') || 50))
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

  const parsed = patchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request', fields: parsed.error.flatten().fieldErrors }, { status: 400 })
  const { id, ...filtered } = parsed.data

  const { data, error } = await supabaseAdmin
    .from('tenants')
    .update(filtered)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return dbError(error)
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
