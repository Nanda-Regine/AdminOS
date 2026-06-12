import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { calculateValuation, saveValuationSnapshot } from '@/lib/intelligence/valuation'
import { fireBusinessEvent } from '@/lib/academy/knowledgeGraph'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.user_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  const url     = new URL(request.url)
  const refresh = url.searchParams.get('refresh') === 'true'
  const today   = new Date().toISOString().split('T')[0]

  if (!refresh) {
    const { data: cached } = await supabaseAdmin
      .from('valuation_snapshots')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('snapshot_date', today)
      .maybeSingle()

    if (cached) return NextResponse.json(cached)
  }

  const result = await calculateValuation(tenantId)
  await saveValuationSnapshot(result)

  // First valuation — trigger the Built to Sell framework
  const { count } = await supabaseAdmin
    .from('valuation_snapshots')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)

  if ((count ?? 0) === 1) {
    fireBusinessEvent('exit.score_calculated', tenantId, user.id)
  }

  return NextResponse.json(result)
}
