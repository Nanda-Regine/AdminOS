import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sendWellnessCheckIn } from '@/lib/workflows/wellness'

// Vercel Cron: runs weekdays at 8:00 AM SAST (6:00 AM UTC)
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const { data: tenants } = await supabaseAdmin
    .from('tenants')
    .select('id')
    .eq('active', true)

  if (!tenants) return NextResponse.json({ processed: 0 })

  let processed = 0
  for (const tenant of tenants) {
    try {
      await sendWellnessCheckIn(tenant.id)
      processed++
    } catch (err) {
      console.error(`[Cron:Wellness] Failed for tenant ${tenant.id}:`, err)
    }
  }

  return NextResponse.json({ processed })
}
