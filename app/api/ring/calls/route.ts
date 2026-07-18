import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAddon } from '@/lib/billing/gates'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  try {
    await requireAddon('ring')
  } catch {
    return NextResponse.json({ error: 'Ring add-on required' }, { status: 402 })
  }

  const tenantId = user.app_metadata?.tenant_id as string
  const url      = new URL(request.url)
  const limit    = Math.min(Number(url.searchParams.get('limit') || '50'), 200)
  const page     = Number(url.searchParams.get('page') || '1')
  const offset   = (page - 1) * limit

  const { data: calls, error, count } = await supabaseAdmin
    .from('call_logs')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('started_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Summary stats
  const { data: stats } = await supabaseAdmin
    .from('call_logs')
    .select('status, duration_sec')
    .eq('tenant_id', tenantId)
    .gte('started_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())

  const totalCalls   = stats?.length ?? 0
  const missedCalls  = stats?.filter(c => c.status === 'no-answer').length ?? 0
  const answered     = stats?.filter(c => c.status === 'completed').length ?? 0
  const avgDuration  = answered > 0
    ? Math.round((stats ?? []).filter(c => c.duration_sec).reduce((s, c) => s + (c.duration_sec ?? 0), 0) / answered)
    : 0

  return NextResponse.json({
    calls: calls ?? [],
    total: count ?? 0,
    page,
    stats: { totalCalls, missedCalls, answered, avgDurationSec: avgDuration },
  })
}
