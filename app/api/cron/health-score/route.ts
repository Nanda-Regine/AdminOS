import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { inngest } from '@/inngest/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Runs weekly — fans out one health score calculation per active tenant
export async function GET(request: Request) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: tenants } = await supabaseAdmin
    .from('tenants')
    .select('id')
    .not('plan', 'eq', 'cancelled')

  if (!tenants || tenants.length === 0) {
    return NextResponse.json({ triggered: 0 })
  }

  // Fan out — one Inngest event per tenant (Inngest handles concurrency)
  await inngest.send(
    tenants.map((t) => ({
      name: 'adminos/health.score.calculate' as const,
      data: { tenant_id: t.id },
    }))
  )

  return NextResponse.json({ triggered: tenants.length })
}
