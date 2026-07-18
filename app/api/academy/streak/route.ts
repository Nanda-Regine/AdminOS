import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

// GET /api/academy/streak — get current learning streak data
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.app_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  const [streakRes, achievementsRes] = await Promise.all([
    supabaseAdmin
      .from('learning_streaks')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabaseAdmin
      .from('user_achievements')
      .select('*, achievement:achievements(name, icon, description, category)')
      .eq('user_id', user.id)
      .order('earned_at', { ascending: false }),
  ])

  const streak = streakRes.data ?? {
    current_streak:    0,
    longest_streak:    0,
    last_activity_date: null,
  }

  // Milestones that reward streak length
  const milestones = [
    { days: 7,  label: '7-day streak',  achieved: streak.longest_streak >= 7  },
    { days: 30, label: '30-day streak', achieved: streak.longest_streak >= 30 },
    { days: 90, label: '90-day streak', achieved: streak.longest_streak >= 90 },
  ]

  return NextResponse.json({
    streak,
    milestones,
    achievements: achievementsRes.data ?? [],
  })
}
