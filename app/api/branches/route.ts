import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'
import { checkPermission } from '@/lib/auth/permissions'

const createSchema = z.object({
  name:           z.string().min(1).max(300),
  address:        z.string().max(500).optional(),
  whatsappNumber: z.string().max(20).optional(),
  managerUserId:  z.string().uuid().optional(),
  timezone:       z.string().default('Africa/Johannesburg'),
})

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.app_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  const url    = new URL(request.url)
  const active = url.searchParams.get('active')

  let query = supabaseAdmin
    .from('branches')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('name')

  if (active !== null) query = query.eq('active', active === 'true')

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.app_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  // Branch management requires admin-level permission
  if (!(await checkPermission('manage_settings'))) return new NextResponse('Forbidden', { status: 403 })

  let body: z.infer<typeof createSchema>
  try { body = createSchema.parse(await request.json()) } catch (e) {
    return NextResponse.json({ error: 'Invalid request', detail: e }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('branches')
    .insert({
      tenant_id:       tenantId,
      name:            body.name,
      address:         body.address        ?? null,
      whatsapp_number: body.whatsappNumber ?? null,
      manager_user_id: body.managerUserId  ?? null,
      timezone:        body.timezone,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
