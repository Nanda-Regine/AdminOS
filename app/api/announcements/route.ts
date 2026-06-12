import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/permissions'

const createSchema = z.object({
  title:       z.string().min(1).max(200),
  body:        z.string().min(1).max(5000),
  audience:    z.enum(['all', 'managers', 'specific']).default('all'),
  audienceIds: z.array(z.string().uuid()).optional(),
  pinned:      z.boolean().default(false),
  expiresAt:   z.string().datetime().optional(),
})

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.user_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  const now = new Date().toISOString()

  const { data, error } = await supabaseAdmin
    .from('announcements')
    .select('*, announcement_reads(user_id)')
    .eq('tenant_id', tenantId)
    .or(`expires_at.is.null,expires_at.gte.${now}`)
    .order('pinned', { ascending: false })
    .order('published_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Tag each announcement with whether the current user has read it
  const enriched = (data ?? []).map((a) => ({
    ...a,
    is_read: (a.announcement_reads as { user_id: string }[]).some((r) => r.user_id === user.id),
    announcement_reads: undefined,
  }))

  return NextResponse.json(enriched)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.user_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  try {
    await requirePermission('send_broadcasts')
  } catch {
    return new NextResponse('Forbidden', { status: 403 })
  }

  let body: z.infer<typeof createSchema>
  try {
    body = createSchema.parse(await request.json())
  } catch (e) {
    return NextResponse.json({ error: 'Invalid request', detail: e }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('announcements')
    .insert({
      tenant_id:    tenantId,
      title:        body.title,
      body:         body.body,
      audience:     body.audience,
      audience_ids: body.audienceIds ?? null,
      pinned:       body.pinned,
      expires_at:   body.expiresAt ?? null,
      created_by:   user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json(data, { status: 201 })
}
