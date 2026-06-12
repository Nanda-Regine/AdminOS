import { inngest } from '@/inngest/client'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { awardAchievement } from '@/lib/academy/checkAchievements'

// Runs daily at midnight — breaks streaks for users who missed a day
export const streakCheckerFunction = inngest.createFunction(
  { id: 'streak-checker-daily' },
  { cron: '0 0 * * *' },
  async () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

    // Find streaks where last_activity_date is before yesterday (i.e. broken)
    const { data: brokenStreaks } = await supabaseAdmin
      .from('learning_streaks')
      .select('user_id, tenant_id, current_streak, longest_streak')
      .lt('last_activity_date', yesterday)
      .gt('current_streak', 0)

    let broken = 0
    for (const streak of brokenStreaks ?? []) {
      await supabaseAdmin
        .from('learning_streaks')
        .update({
          current_streak:   0,
          streak_broken_at: new Date().toISOString(),
          updated_at:       new Date().toISOString(),
        })
        .eq('user_id', streak.user_id)

      broken++
    }

    return { streaks_broken: broken }
  }
)

// Listen for academy lesson completions and update streaks
export const onLessonCompleted = inngest.createFunction(
  { id: 'on-lesson-completed' },
  { event: 'adminos/academy.lesson.completed' },
  async ({ event }) => {
    const { tenantId, userId, lessonId } = event.data as {
      tenantId: string
      userId:   string
      lessonId: string
    }

    const today = new Date().toISOString().split('T')[0]

    // Get or create streak record
    const { data: existing } = await supabaseAdmin
      .from('learning_streaks')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    let newStreak = 1

    if (existing) {
      const lastDate  = existing.last_activity_date
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

      if (lastDate === today) {
        return { streak: existing.current_streak }  // already counted today
      } else if (lastDate === yesterday) {
        newStreak = existing.current_streak + 1
      }
    }

    await supabaseAdmin.from('learning_streaks').upsert({
      user_id:            userId,
      tenant_id:          tenantId,
      current_streak:     newStreak,
      longest_streak:     Math.max(newStreak, existing?.longest_streak ?? 0),
      last_activity_date: today,
      updated_at:         new Date().toISOString(),
    })

    // Check streak achievements
    if (newStreak >= 7)  await awardAchievement('seven_day_streak',  tenantId, userId)
    if (newStreak >= 30) await awardAchievement('thirty_day_streak', tenantId, userId)
    if (newStreak >= 90) await awardAchievement('ninety_day_streak', tenantId, userId)

    return { streak: newStreak, lessonId }
  }
)
