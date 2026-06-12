import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getRelevantFrameworks } from '@/lib/academy/knowledgeGraph'

// GET /api/academy/frameworks — get frameworks relevant to current business context
// ?event=first_invoice.sent — get frameworks triggered by a business event
// ?slug=profit-first — get a single framework by slug
// ?urgency=crisis — filter by urgency tier
// ?tag=cashflow — filter by situation tag

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.user_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  const url     = new URL(request.url)
  const event   = url.searchParams.get('event')
  const slug    = url.searchParams.get('slug')
  const urgency = url.searchParams.get('urgency')
  const tag     = url.searchParams.get('tag')
  const limit   = Math.min(parseInt(url.searchParams.get('limit') ?? '10'), 20)

  // Single framework lookup
  if (slug) {
    const { data, error } = await supabaseAdmin
      .from('framework_library')
      .select('*')
      .eq('slug', slug)
      .single()

    if (error) return NextResponse.json({ error: 'Framework not found' }, { status: 404 })
    return NextResponse.json(data)
  }

  // Event-based relevance lookup
  if (event) {
    const frameworks = await getRelevantFrameworks(event)
    return NextResponse.json(frameworks.slice(0, limit))
  }

  // General browsing with optional filters
  let query = supabaseAdmin
    .from('framework_library')
    .select('id, slug, book_title, author, framework_name, core_insight, situation_tags, urgency, action_label, action_route')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (urgency) query = query.eq('urgency', urgency)
  if (tag)     query = query.contains('situation_tags', [tag])

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
