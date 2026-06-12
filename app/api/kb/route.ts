import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'
import { sanitizeForAI } from '@/lib/security/sanitize'

const createSchema = z.object({
  title:      z.string().min(1).max(500),
  content:    z.string().min(1).max(50000),
  categoryId: z.string().uuid().optional(),
  tags:       z.array(z.string()).default([]),
  published:  z.boolean().default(true),
})

// GET /api/kb — search/list knowledge base articles
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.user_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  const url      = new URL(request.url)
  const q        = url.searchParams.get('q')      // full-text search
  const category = url.searchParams.get('category')
  const limit    = Math.min(parseInt(url.searchParams.get('limit') ?? '20'), 50)

  if (q) {
    // Full-text search using Postgres GIN index
    const { data, error } = await supabaseAdmin.rpc('search_kb_articles', {
      p_tenant_id: tenantId,
      p_query:     q.trim().slice(0, 200),
      p_limit:     limit,
    })

    if (error) {
      // Fallback to ilike if RPC not available
      const { data: fallback, error: e2 } = await supabaseAdmin
        .from('kb_articles')
        .select('id, title, category_id, tags, created_at, published')
        .eq('tenant_id', tenantId)
        .ilike('title', `%${q}%`)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (e2) return NextResponse.json({ error: e2.message }, { status: 400 })
      return NextResponse.json(fallback)
    }

    return NextResponse.json(data)
  }

  let query = supabaseAdmin
    .from('kb_articles')
    .select('id, title, category_id, tags, created_at, published, kb_categories(name)')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (category) query = query.eq('category_id', category)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

// POST /api/kb — create article
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

  const { data, error } = await supabaseAdmin
    .from('kb_articles')
    .insert({
      tenant_id:   tenantId,
      title:       sanitizeForAI(body.title),
      content:     sanitizeForAI(body.content),
      category_id: body.categoryId ?? null,
      tags:        body.tags,
      published:   body.published,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
