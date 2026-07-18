import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'

const uploadSchema = z.object({
  title:      z.string().min(1).max(300),
  file_url:   z.string().url(),
  file_type:  z.string().max(50).optional(),
  expires_at: z.string().datetime().optional(),
})

// GET /api/staff/[id]/documents
// Returns all documents linked to a specific staff member. Tenant-scoped.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.app_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  const { id: staffId } = await params

  // Verify the staff member belongs to this tenant
  const { data: staff } = await supabaseAdmin
    .from('staff')
    .select('id')
    .eq('id', staffId)
    .eq('tenant_id', tenantId)
    .single()

  if (!staff) return new NextResponse('Staff not found', { status: 404 })

  const { data, error } = await supabaseAdmin
    .from('documents')
    .select('id, tenant_id, staff_id, title, file_url, file_type, expires_at, created_at')
    .eq('tenant_id', tenantId)
    .eq('staff_id', staffId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json(data)
}

// POST /api/staff/[id]/documents
// Upload / register a document for a specific staff member.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.app_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  const { id: staffId } = await params

  // Verify the staff member belongs to this tenant
  const { data: staff } = await supabaseAdmin
    .from('staff')
    .select('id')
    .eq('id', staffId)
    .eq('tenant_id', tenantId)
    .single()

  if (!staff) return new NextResponse('Staff not found', { status: 404 })

  let body: z.infer<typeof uploadSchema>
  try {
    body = uploadSchema.parse(await request.json())
  } catch (e) {
    return NextResponse.json({ error: 'Invalid request', detail: e }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('documents')
    .insert({
      tenant_id:  tenantId,
      staff_id:   staffId,
      title:      body.title,
      file_url:   body.file_url,
      file_type:  body.file_type  ?? null,
      expires_at: body.expires_at ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json(data, { status: 201 })
}
