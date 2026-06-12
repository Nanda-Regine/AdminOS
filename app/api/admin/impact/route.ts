import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

async function requireSuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabaseAdmin.from('admins').select('id').eq('user_id', user.id).single()
  return data ? user : null
}

// GET /api/admin/impact — impact dashboard for admins + public metrics
// Super-admin gets full data; public caller gets only aggregated totals
export async function GET(request: Request) {
  const url    = new URL(request.url)
  const isPublic = url.searchParams.get('public') === 'true'

  if (!isPublic) {
    const admin = await requireSuperAdmin()
    if (!admin) return new NextResponse('Forbidden', { status: 403 })
  }

  // Latest snapshot
  const { data: latest } = await supabaseAdmin
    .from('impact_snapshots')
    .select('*')
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  // 12-week trend
  const { data: trend } = await supabaseAdmin
    .from('impact_snapshots')
    .select('snapshot_date, active_businesses, total_staff_on_platform, academy_certificates_issued')
    .order('snapshot_date', { ascending: false })
    .limit(12)

  if (!latest) return NextResponse.json({ message: 'No snapshot yet' })

  if (isPublic) {
    // Public view — no sensitive data
    return NextResponse.json({
      businesses_empowered:        latest.active_businesses,
      jobs_protected:              latest.jobs_protected_estimate,
      businesses_formalised:       latest.businesses_formalised,
      women_owned:                 latest.women_owned_businesses,
      academy_graduates:           latest.academy_certificates_issued,
      stokvel_groups:              latest.stokvel_groups_count,
      mentorship_connections:      latest.mentorship_connections,
      snapshot_date:               latest.snapshot_date,
    })
  }

  return NextResponse.json({ latest, trend: (trend ?? []).reverse() })
}
