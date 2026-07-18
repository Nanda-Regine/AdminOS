import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'

const patchSchema = z.object({
  phone:                z.string().max(30).optional(),
  emergency_contact:    z.string().max(500).optional(),
  bank_account_number:  z.string().max(50).optional(),
  bank_name:            z.string().max(100).optional(),
  bank_branch_code:     z.string().max(20).optional(),
  address:              z.string().max(500).optional(),
})

// GET /api/staff/my-profile
// Returns the authenticated user's own staff record for their tenant.
export async function GET(_request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.app_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('staff')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id)
    .single()

  if (error || !data) return new NextResponse('Staff record not found', { status: 404 })

  return NextResponse.json(data)
}

// PATCH /api/staff/my-profile
// Allows the authenticated user to update their own contact and banking details.
export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.app_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  // Confirm user has a staff record in this tenant
  const { data: existing } = await supabaseAdmin
    .from('staff')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id)
    .single()

  if (!existing) return new NextResponse('Staff record not found', { status: 404 })

  let body: z.infer<typeof patchSchema>
  try {
    body = patchSchema.parse(await request.json())
  } catch (e) {
    return NextResponse.json({ error: 'Invalid request', detail: e }, { status: 400 })
  }

  // Only include fields the user actually provided
  const updates: Record<string, unknown> = {}
  if (body.phone               !== undefined) updates.phone                = body.phone
  if (body.emergency_contact   !== undefined) updates.emergency_contact    = body.emergency_contact
  if (body.bank_account_number !== undefined) updates.bank_account_number  = body.bank_account_number
  if (body.bank_name           !== undefined) updates.bank_name            = body.bank_name
  if (body.bank_branch_code    !== undefined) updates.bank_branch_code     = body.bank_branch_code
  if (body.address             !== undefined) updates.address              = body.address

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('staff')
    .update(updates)
    .eq('id', existing.id)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json(data)
}
