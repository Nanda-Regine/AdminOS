import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

// GET /api/academy — list all academy modules with user progress
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.app_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  const url   = new URL(request.url)
  const level = url.searchParams.get('level')

  // Fetch modules
  let moduleQuery = supabaseAdmin
    .from('academy_modules')
    .select('*, lessons:academy_lessons(id, lesson_number, title, content_type, estimated_minutes)')
    .order('module_number')

  if (level) moduleQuery = moduleQuery.eq('level', level)

  const [modulesRes, progressRes, streakRes] = await Promise.all([
    moduleQuery,
    supabaseAdmin
      .from('academy_progress')
      .select('lesson_id, completed_at, score')
      .eq('user_id', user.id),
    supabaseAdmin
      .from('learning_streaks')
      .select('current_streak, longest_streak, last_activity_date')
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  const completedLessonIds = new Set(
    (progressRes.data ?? []).filter(p => p.completed_at).map(p => p.lesson_id)
  )

  // Enrich modules with completion status
  const modules = (modulesRes.data ?? []).map(mod => {
    const lessons = mod.lessons ?? []
    const completedCount = lessons.filter((l: { id: string }) => completedLessonIds.has(l.id)).length
    return {
      ...mod,
      lessons_count:    lessons.length,
      completed_count:  completedCount,
      progress_pct:     lessons.length > 0 ? Math.round(completedCount / lessons.length * 100) : 0,
      is_completed:     completedCount === lessons.length && lessons.length > 0,
    }
  })

  return NextResponse.json({
    modules,
    streak:           streakRes.data ?? { current_streak: 0, longest_streak: 0, last_activity_date: null },
    total_completed:  completedLessonIds.size,
  })
}
