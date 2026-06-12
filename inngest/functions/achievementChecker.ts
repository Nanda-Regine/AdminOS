import { inngest } from '@/inngest/client'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { awardAchievement } from '@/lib/academy/checkAchievements'

// Maps trigger_type values to the achievement codes they should attempt to award
const TRIGGER_ACHIEVEMENT_MAP: Record<string, string[]> = {
  invoice_sent: ['first_invoice'],
  staff_added: ['first_hire', 'team_of_five'],
  payroll_run: ['first_payroll'],
  // lesson_completed → handled by streakChecker
  // login → handled by onboarding sequence
}

// Event-driven achievement checker — fired whenever a business action occurs
export const achievementCheckerFunction = inngest.createFunction(
  { id: 'achievement-checker', retries: 2 },
  { event: 'adminos/achievement.check' },
  async ({ event, step }) => {
    const { tenant_id, user_id, trigger_type } = event.data as {
      tenant_id: string
      user_id: string
      trigger_type: string
    }

    const achievementCodes = TRIGGER_ACHIEVEMENT_MAP[trigger_type] ?? []

    if (achievementCodes.length === 0) {
      return { trigger_type, awarded: [], skipped_reason: 'no_mapped_achievements' }
    }

    const awarded: string[] = []

    for (const code of achievementCodes) {
      // eslint-disable-next-line no-await-in-loop
      const result = await step.run(`award-${code}`, async () => {
        // For 'team_of_five' — check actual staff count before attempting
        if (code === 'team_of_five') {
          const { count } = await supabaseAdmin
            .from('staff')
            .select('id', { count: 'exact', head: true })
            .eq('tenant_id', tenant_id)

          if ((count ?? 0) < 5) return { status: 'skipped', reason: 'not_enough_staff' }
        }

        try {
          await awardAchievement(code, tenant_id, user_id)
          return { status: 'awarded' }
        } catch (err) {
          // awardAchievement throws if already awarded or not eligible — that's ok
          return { status: 'skipped', reason: String(err) }
        }
      })

      if (result.status === 'awarded') awarded.push(code)
    }

    return { trigger_type, attempted: achievementCodes, awarded }
  }
)
