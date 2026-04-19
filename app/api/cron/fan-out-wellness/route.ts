import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { inngest } from '@/inngest/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: tenants } = await supabaseAdmin
    .from('tenants')
    .select('id')
    .eq('status', 'active')

  if (!tenants?.length) return NextResponse.json({ fanned: 0 })

  await Promise.all(
    tenants.map((t) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      inngest.send({ name: 'adminos/wellness.checkin.due' as any, data: { tenant_id: t.id } })
    )
  )

  return NextResponse.json({ fanned: tenants.length })
}
