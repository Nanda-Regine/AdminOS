import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'
import { sanitizeForAI } from '@/lib/security/sanitize'

const createSchema = z.object({
  category:  z.enum(['need_help','can_help','experience','supplier_review','celebration']),
  title:     z.string().min(1).max(300),
  body:      z.string().min(1).max(5000),
  anonymous: z.boolean().default(false),
  sector:    z.string().max(100).optional(),
  province:  z.string().max(100).optional(),
})

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  // Community posts are readable by all authenticated users
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const url      = new URL(request.url)
  const category = url.searchParams.get('category')
  const sector   = url.searchParams.get('sector')
  const province = url.searchParams.get('province')
  const limit    = Math.min(parseInt(url.searchParams.get('limit') ?? '50'), 100)
  const offset   = parseInt(url.searchParams.get('offset') ?? '0')

  let query = supabaseAdmin
    .from('community_posts')
    .select('id, category, title, body, anonymous, sector, province, replies_count, helpful_count, created_at, tenant_id')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (category) query = query.eq('category', category)
  if (sector)   query = query.eq('sector', sector)
  if (province) query = query.eq('province', province)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Strip tenant_id from anonymous posts
  const sanitized = (data ?? []).map(p => ({
    ...p,
    tenant_id: p.anonymous ? null : p.tenant_id,
  }))

  return NextResponse.json(sanitized)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.user_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  let body: z.infer<typeof createSchema>
  try { body = createSchema.parse(await request.json()) } catch (e) {
    return NextResponse.json({ error: 'Invalid request', detail: e }, { status: 400 })
  }

  // Sanitize user content before storage
  const safeTitle = sanitizeForAI(body.title)
  const safeBody  = sanitizeForAI(body.body)

  const { data, error } = await supabaseAdmin
    .from('community_posts')
    .insert({
      tenant_id:  tenantId,
      category:   body.category,
      title:      safeTitle,
      body:       safeBody,
      anonymous:  body.anonymous,
      sector:     body.sector   ?? null,
      province:   body.province ?? null,
      status:     'active',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
