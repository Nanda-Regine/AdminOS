import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { calculateHealthScore, saveHealthSnapshot } from '@/lib/intelligence/healthScore'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.app_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  const url     = new URL(request.url)
  const refresh = url.searchParams.get('refresh') === 'true'
  const today   = new Date().toISOString().split('T')[0]

  // Return cached snapshot unless refresh=true
  if (!refresh) {
    const { data: cached } = await supabaseAdmin
      .from('business_health_snapshots')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('snapshot_date', today)
      .single()

    if (cached) return NextResponse.json(cached)
  }

  // Calculate fresh and cache it
  const result = await calculateHealthScore(tenantId)
  await saveHealthSnapshot(tenantId, result)

  return NextResponse.json({
    overall_score:        result.overall,
    financial_health:     result.financial.score,
    legal_compliance:     result.legal.score,
    people_management:    result.people.score,
    customer_relations:   result.customer.score,
    operational_maturity: result.operational.score,
    strategic_readiness:  result.strategic.score,
    dimension_details: {
      financial:   { ...result.financial.details,   signals: result.financial.signals   },
      legal:       { ...result.legal.details,       signals: result.legal.signals       },
      people:      { ...result.people.details,      signals: result.people.signals      },
      customer:    { ...result.customer.details,    signals: result.customer.signals    },
      operational: { ...result.operational.details, signals: result.operational.signals },
      strategic:   { ...result.strategic.details,   signals: result.strategic.signals   },
    },
    snapshot_date: today,
  })
}
