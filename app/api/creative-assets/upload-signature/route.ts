import { NextResponse } from 'next/server'
import { requireContext, AuthError } from '@/lib/auth/context'
import { PermissionError } from '@/lib/auth/permissions'
import { checkRateLimit } from '@/lib/security/rateLimit'
import { cloudinaryConfigured, signCreativeAssetUpload } from '@/lib/cloudinary/signature'
import { z } from 'zod'

const schema = z.object({
  resourceType: z.enum(['video', 'image']),
})

// Hard ceiling for direct-hosted uploads. Anything bigger should use the
// 'external' storage mode (link out) instead of paying our Cloudinary bill
// for it — see the migration comment in 20260814_creative_assets.sql.
export const MAX_HOSTED_UPLOAD_BYTES = 100 * 1024 * 1024 // 100MB

export async function POST(request: Request) {
  try {
    const ctx = await requireContext()
    ctx.require('manage_documents')

    if (!cloudinaryConfigured()) {
      return NextResponse.json({ error: 'Media hosting is not configured for this environment' }, { status: 503 })
    }

    const { success } = await checkRateLimit('api', ctx.tenantId)
    if (!success) return new NextResponse('Too Many Requests', { status: 429 })

    let body: z.infer<typeof schema>
    try {
      body = schema.parse(await request.json())
    } catch (e) {
      return NextResponse.json({ error: 'Invalid request body', detail: e }, { status: 400 })
    }

    const signature = signCreativeAssetUpload(ctx.tenantId, body.resourceType)

    return NextResponse.json({ ...signature, maxBytes: MAX_HOSTED_UPLOAD_BYTES })
  } catch (e) {
    if (e instanceof AuthError) return new NextResponse('Unauthorized', { status: 401 })
    if (e instanceof PermissionError) return new NextResponse('Forbidden', { status: 403 })
    throw e
  }
}
