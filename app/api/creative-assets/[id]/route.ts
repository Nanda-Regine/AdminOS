import { NextResponse } from 'next/server'
import { requireContext, AuthError } from '@/lib/auth/context'
import { PermissionError } from '@/lib/auth/permissions'
import { z } from 'zod'
import { dbError } from '@/lib/api/guard'

const patchSchema = z.object({
  status: z.enum(['draft', 'in_review', 'approved', 'delivered']).optional(),
  title: z.string().min(1).max(200).optional(),
  notes: z.string().max(2000).nullable().optional(),
  contact_id: z.string().uuid().nullable().optional(),
})

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireContext()
    ctx.require('manage_documents')
    const { id } = await params

    let body: z.infer<typeof patchSchema>
    try {
      body = patchSchema.parse(await request.json())
    } catch (e) {
      return NextResponse.json({ error: 'Invalid request body', detail: e }, { status: 400 })
    }

    if (Object.keys(body).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    // RLS (tenant_id = current_tenant_id()) scopes this to the caller's tenant
    // — no need to hand-filter tenant_id here, but .eq('id', id) still applies
    // the row-specific update correctly within that scope.
    const { data, error } = await ctx.db
      .from('creative_assets')
      .update(body)
      .eq('id', id)
      .select()
      .single()

    if (error) return dbError(error)
    if (!data) return new NextResponse('Not found', { status: 404 })

    return NextResponse.json({ asset: data })
  } catch (e) {
    if (e instanceof AuthError) return new NextResponse('Unauthorized', { status: 401 })
    if (e instanceof PermissionError) return new NextResponse('Forbidden', { status: 403 })
    throw e
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireContext()
    ctx.require('manage_documents')
    const { id } = await params

    const { error } = await ctx.db.from('creative_assets').update({ deleted_at: new Date().toISOString() }).eq('id', id) // soft delete (Rule #3)
    if (error) return dbError(error)

    return new NextResponse(null, { status: 204 })
  } catch (e) {
    if (e instanceof AuthError) return new NextResponse('Unauthorized', { status: 401 })
    if (e instanceof PermissionError) return new NextResponse('Forbidden', { status: 403 })
    throw e
  }
}
