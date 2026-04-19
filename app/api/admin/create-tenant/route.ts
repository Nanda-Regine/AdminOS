import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { writeAuditLog, getClientIp } from '@/lib/security/audit'
import { z } from 'zod'

const schema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(60).regex(/^[a-z0-9-]+$/),
  ownerEmail: z.string().email(),
  ownerName: z.string().min(1).max(100),
  plan: z.enum(['starter', 'growth', 'enterprise', 'white_label', 'trial']).default('trial'),
  phone360dialog: z.string().optional(),
  whatsappNumber: z.string().optional(),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.user_metadata?.role !== 'super_admin') {
    return new NextResponse('Forbidden', { status: 403 })
  }

  let body: z.infer<typeof schema>
  try {
    body = schema.parse(await request.json())
  } catch (e) {
    return NextResponse.json({ error: 'Invalid request body', detail: e }, { status: 400 })
  }

  // 1. Check slug uniqueness
  const { data: existing } = await supabaseAdmin
    .from('tenants')
    .select('id')
    .eq('slug', body.slug)
    .single()

  if (existing) {
    return NextResponse.json({ error: `Slug "${body.slug}" is already taken` }, { status: 409 })
  }

  // 2. Create tenant record
  const { data: tenant, error: tenantErr } = await supabaseAdmin
    .from('tenants')
    .insert({
      name:             body.name,
      slug:             body.slug,
      plan:             body.plan,
      active:           body.plan !== 'trial',
      phone_360dialog:  body.phone360dialog ?? null,
      whatsapp_number:  body.whatsappNumber ?? null,
    })
    .select('id')
    .single()

  if (tenantErr || !tenant) {
    return NextResponse.json({ error: 'Failed to create tenant', detail: tenantErr?.message }, { status: 500 })
  }

  // 3. Invite owner via Supabase Auth (sends magic link email)
  const { data: inviteData, error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(
    body.ownerEmail,
    {
      data: {
        tenant_id: tenant.id,
        full_name: body.ownerName,
        role:      'owner',
      },
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
    }
  )

  if (inviteErr) {
    // Tenant created but invite failed — still return success with warning
    return NextResponse.json({
      tenant,
      warning: `Tenant created but invite failed: ${inviteErr.message}. Send invite manually.`,
    }, { status: 201 })
  }

  await writeAuditLog({
    actor:        user.id,
    action:       'admin.tenant.created',
    resourceType: 'tenant',
    resourceId:   tenant.id,
    ipAddress:    getClientIp(request),
    metadata:     { name: body.name, slug: body.slug, plan: body.plan, ownerEmail: body.ownerEmail },
  })

  return NextResponse.json({
    tenant,
    owner: { email: body.ownerEmail, userId: inviteData.user?.id },
    message: `Tenant created and invite sent to ${body.ownerEmail}`,
  }, { status: 201 })
}
