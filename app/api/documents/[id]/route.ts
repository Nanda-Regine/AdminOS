import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { writeAuditLog } from '@/lib/security/audit'

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.user_metadata?.tenant_id as string

  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (error) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.user_metadata?.tenant_id as string

  const { data: doc } = await supabase
    .from('documents')
    .select('storage_url, storage_path')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const storagePath = doc.storage_path ?? doc.storage_url
  if (storagePath) {
    await supabaseAdmin.storage.from('documents').remove([storagePath]).catch(() => {})
    await supabaseAdmin.storage.from('tenant-documents').remove([storagePath]).catch(() => {})
  }

  await supabaseAdmin.from('documents').delete().eq('id', id).eq('tenant_id', tenantId)

  await writeAuditLog({
    tenantId,
    actor: user.id,
    action: 'document.deleted',
    resourceType: 'document',
    resourceId: id,
    metadata: {},
  })

  return new NextResponse(null, { status: 204 })
}
