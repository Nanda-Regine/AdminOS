import { NextResponse } from 'next/server'
import { requireContext, AuthError } from '@/lib/auth/context'
import { PermissionError } from '@/lib/auth/permissions'
import { checkRateLimit } from '@/lib/security/rateLimit'
import { z } from 'zod'

const createSchema = z.discriminatedUnion('storage_mode', [
  z.object({
    storage_mode: z.literal('hosted'),
    title: z.string().min(1).max(200),
    category: z.enum(['audio', 'voice_over', 'soundtrack', 'video_long', 'video_short', 'finished_work']),
    contact_id: z.string().uuid().optional().nullable(),
    notes: z.string().max(2000).optional().nullable(),
    cloudinary_public_id: z.string().min(1),
    cloudinary_url: z.string().url(),
    cloudinary_resource_type: z.string().min(1),
    file_size_bytes: z.number().int().positive().optional(),
  }),
  z.object({
    storage_mode: z.literal('external'),
    title: z.string().min(1).max(200),
    category: z.enum(['audio', 'voice_over', 'soundtrack', 'video_long', 'video_short', 'finished_work']),
    contact_id: z.string().uuid().optional().nullable(),
    notes: z.string().max(2000).optional().nullable(),
    external_url: z.string().url(),
    external_provider: z.enum(['drive', 'dropbox', 'frameio', 'vimeo', 'other']).optional(),
  }),
])

export async function GET(request: Request) {
  try {
    const ctx = await requireContext()
    ctx.require('manage_documents')

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const status = searchParams.get('status')

    let query = ctx.db
      .from('creative_assets')
      .select('*')
      .eq('tenant_id', ctx.tenantId)
      .order('created_at', { ascending: false })

    if (category) query = query.eq('category', category)
    if (status) query = query.eq('status', status)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ assets: data ?? [] })
  } catch (e) {
    if (e instanceof AuthError) return new NextResponse('Unauthorized', { status: 401 })
    if (e instanceof PermissionError) return new NextResponse('Forbidden', { status: 403 })
    throw e
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireContext()
    ctx.require('manage_documents')

    const { success } = await checkRateLimit('api', ctx.tenantId)
    if (!success) return new NextResponse('Too Many Requests', { status: 429 })

    let body: z.infer<typeof createSchema>
    try {
      body = createSchema.parse(await request.json())
    } catch (e) {
      return NextResponse.json({ error: 'Invalid request body', detail: e }, { status: 400 })
    }

    const { data, error } = await ctx.db
      .from('creative_assets')
      .insert({
        tenant_id: ctx.tenantId,
        contact_id: body.contact_id ?? null,
        title: body.title,
        category: body.category,
        notes: body.notes ?? null,
        storage_mode: body.storage_mode,
        created_by: ctx.userId,
        ...(body.storage_mode === 'hosted'
          ? {
              cloudinary_public_id: body.cloudinary_public_id,
              cloudinary_url: body.cloudinary_url,
              cloudinary_resource_type: body.cloudinary_resource_type,
              file_size_bytes: body.file_size_bytes ?? null,
            }
          : {
              external_url: body.external_url,
              external_provider: body.external_provider ?? 'other',
            }),
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ asset: data }, { status: 201 })
  } catch (e) {
    if (e instanceof AuthError) return new NextResponse('Unauthorized', { status: 401 })
    if (e instanceof PermissionError) return new NextResponse('Forbidden', { status: 403 })
    throw e
  }
}
