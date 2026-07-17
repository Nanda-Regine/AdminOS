import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireSuperAdmin } from '@/lib/auth/context'
import { z } from 'zod'

// Super-admin route for reviewing special pricing applications
// Auth: verifies against `admins` DB table via requireSuperAdmin — NOT JWT metadata

const reviewSchema = z.object({
  applicationId:   z.string().uuid(),
  decision:        z.enum(['approved','rejected']),
  rejectionReason: z.string().max(500).optional(),
  expiresAt:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

const PROGRAMME_DISCOUNTS: Record<string, number> = {
  npo_nonprofit:        50,
  youth_owned:          30,
  township_rural:       30,
  women_owned:          30,
  refugee_entrepreneur: 60,
}

// GET /api/admin/special-pricing — list all pending applications
export async function GET(request: Request) {
  const admin = await requireSuperAdmin()
  if (!admin) return new NextResponse('Forbidden', { status: 403 })

  const url    = new URL(request.url)
  const status = url.searchParams.get('status') ?? 'pending'

  const { data, error } = await supabaseAdmin
    .from('special_pricing_applications')
    .select('*, tenant:tenants(name, plan, business_type)')
    .eq('status', status)
    .order('applied_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

// PATCH /api/admin/special-pricing — approve or reject an application
export async function PATCH(request: Request) {
  const admin = await requireSuperAdmin()
  if (!admin) return new NextResponse('Forbidden', { status: 403 })

  let body: z.infer<typeof reviewSchema>
  try { body = reviewSchema.parse(await request.json()) } catch (e) {
    return NextResponse.json({ error: 'Invalid request', detail: e }, { status: 400 })
  }

  // Fetch application to get programme slug
  const { data: application } = await supabaseAdmin
    .from('special_pricing_applications')
    .select('*')
    .eq('id', body.applicationId)
    .single()

  if (!application) return new NextResponse('Application not found', { status: 404 })

  const updates: Record<string, unknown> = {
    status:          body.decision,
    reviewed_at:     new Date().toISOString(),
    reviewed_by:     admin.id,
    rejection_reason: body.rejectionReason ?? null,
  }

  if (body.decision === 'approved') {
    updates.discount_pct = PROGRAMME_DISCOUNTS[application.programme] ?? 30
    updates.expires_at   = body.expiresAt ?? new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0]
  }

  const { data, error } = await supabaseAdmin
    .from('special_pricing_applications')
    .update(updates)
    .eq('id', body.applicationId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // If approved: record plan change with discount flag (tenant will see on next invoice)
  if (body.decision === 'approved') {
    const { data: tenant } = await supabaseAdmin
      .from('tenants')
      .select('plan')
      .eq('id', application.tenant_id)
      .single()

    await supabaseAdmin.from('plan_changes').insert({
      tenant_id:     application.tenant_id,
      previous_plan: tenant?.plan ?? null,
      new_plan:      tenant?.plan ?? 'solo',
      reason:        `Special pricing approved: ${application.programme} (${updates.discount_pct}% discount)`,
      changed_by:    admin.id,
    })
  }

  return NextResponse.json(data)
}
