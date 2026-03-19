import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { runDebtRecoverySequence } from '@/lib/workflows/debtRecovery'

// Vercel Cron: runs daily at 9:00 AM SAST (7:00 AM UTC)
export async function GET(request: Request) {
  // Verify Vercel cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  // Get all active tenants
  const { data: tenants } = await supabaseAdmin
    .from('tenants')
    .select('id')
    .eq('active', true)

  if (!tenants) return NextResponse.json({ processed: 0 })

  let processed = 0
  for (const tenant of tenants) {
    try {
      await runDebtRecoverySequence(tenant.id)
      processed++
    } catch (err) {
      console.error(`[Cron:DebtRecovery] Failed for tenant ${tenant.id}:`, err)
    }
  }

  return NextResponse.json({ processed, total: tenants.length })
}
