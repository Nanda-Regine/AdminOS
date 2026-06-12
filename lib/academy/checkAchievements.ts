import { supabaseAdmin } from '@/lib/supabase/admin'

export interface AchievementContext {
  tenantId: string
  userId: string
  // Metrics — only populate what you've already fetched
  contactCount?: number
  staffCount?: number
  activeStaff?: number
  totalRevenueZar?: number
  businessAgeMonths?: number
  currentStreak?: number
  sopCount?: number
  completedPopiaSetup?: boolean
  taxDeadlinesMet?: boolean
  daysNoOverdue?: number
  bbbbeeImproved?: boolean
  womenOwnedVerified?: boolean
  formalizationComplete?: boolean
  profitFirstSetup?: boolean
  cashPositiveMonths?: number
  mentorshipConnection?: boolean
  stokvelGroup?: boolean
  // Academy level completion — e.g. { level: 'foundation', pct: 100 }
  academyLevelCompletion?: { level: string; pct: number }
}

export interface AchievementEarned {
  slug: string
  name: string
  icon: string
  category: string
}

function evaluateCriteria(criteria: Record<string, unknown>, ctx: AchievementContext): boolean {
  // Each criteria key maps to a context field; all keys must pass
  for (const [key, required] of Object.entries(criteria)) {
    switch (key) {
      case 'event':
        // Event-based achievements (first_breath etc.) are awarded via direct call,
        // not via context evaluation — skip here
        return false

      case 'contact_count':
        if ((ctx.contactCount ?? 0) < (required as number)) return false
        break

      case 'active_staff':
        if ((ctx.activeStaff ?? 0) < (required as number)) return false
        break

      case 'staff_count':
        if ((ctx.staffCount ?? 0) < (required as number)) return false
        break

      case 'total_revenue_zar':
        if ((ctx.totalRevenueZar ?? 0) < (required as number)) return false
        break

      case 'business_age_months':
        if ((ctx.businessAgeMonths ?? 0) < (required as number)) return false
        break

      case 'learning_streak':
        if ((ctx.currentStreak ?? 0) < (required as number)) return false
        break

      case 'sop_count':
        if ((ctx.sopCount ?? 0) < (required as number)) return false
        break

      case 'completed_popia_setup':
        if (!ctx.completedPopiaSetup) return false
        break

      case 'tax_deadlines_met':
        if (!ctx.taxDeadlinesMet) return false
        break

      case 'days_no_overdue':
        if ((ctx.daysNoOverdue ?? 0) < (required as number)) return false
        break

      case 'bbbbee_level_improved':
        if (!ctx.bbbbeeImproved) return false
        break

      case 'women_owned_verified':
        if (!ctx.womenOwnedVerified) return false
        break

      case 'formalization_complete':
        if (!ctx.formalizationComplete) return false
        break

      case 'profit_first_setup':
        if (!ctx.profitFirstSetup) return false
        break

      case 'cash_positive_months':
        if ((ctx.cashPositiveMonths ?? 0) < (required as number)) return false
        break

      case 'mentorship_connection':
        if (!ctx.mentorshipConnection) return false
        break

      case 'stokvel_group':
        if (!ctx.stokvelGroup) return false
        break

      case 'academy_level': {
        const lvl = ctx.academyLevelCompletion
        if (!lvl || lvl.level !== required) return false
        break
      }

      case 'completion': {
        const lvl = ctx.academyLevelCompletion
        if (!lvl || lvl.pct < (required as number)) return false
        break
      }

      default:
        // Unknown criterion — conservative: don't award
        return false
    }
  }
  return true
}

export async function checkAchievements(ctx: AchievementContext): Promise<AchievementEarned[]> {
  const { tenantId, userId } = ctx

  // Load all achievements this user hasn't earned yet
  const { data: earned } = await supabaseAdmin
    .from('user_achievements')
    .select('achievement_id')
    .eq('user_id', userId)

  const earnedIds = new Set((earned ?? []).map((r) => r.achievement_id))

  const { data: all } = await supabaseAdmin
    .from('achievements')
    .select('id, slug, name, icon, category, criteria')

  if (!all) return []

  const unearnedAchievements = all.filter((a) => !earnedIds.has(a.id))
  const newlyEarned: AchievementEarned[] = []

  for (const achievement of unearnedAchievements) {
    const criteria = achievement.criteria as Record<string, unknown>
    if (evaluateCriteria(criteria, ctx)) {
      const { error } = await supabaseAdmin.from('user_achievements').insert({
        tenant_id:      tenantId,
        user_id:        userId,
        achievement_id: achievement.id,
        earned_at:      new Date().toISOString(),
      })
      if (!error) {
        newlyEarned.push({
          slug:     achievement.slug,
          name:     achievement.name,
          icon:     achievement.icon,
          category: achievement.category,
        })
      }
    }
  }

  return newlyEarned
}

// Award a single event-based achievement by slug (e.g. 'first_breath', 'employer')
export async function awardAchievement(
  slug: string,
  tenantId: string,
  userId: string
): Promise<AchievementEarned | null> {
  const { data: achievement } = await supabaseAdmin
    .from('achievements')
    .select('id, slug, name, icon, category')
    .eq('slug', slug)
    .maybeSingle()

  if (!achievement) return null

  const { error } = await supabaseAdmin.from('user_achievements').insert({
    tenant_id:      tenantId,
    user_id:        userId,
    achievement_id: achievement.id,
    earned_at:      new Date().toISOString(),
  })

  // Ignore unique constraint violations (already earned)
  if (error && !error.code?.includes('23505')) return null

  return {
    slug:     achievement.slug,
    name:     achievement.name,
    icon:     achievement.icon,
    category: achievement.category,
  }
}

// Update learning streak and check streak achievements
export async function updateLearningStreak(
  tenantId: string,
  userId: string
): Promise<number> {
  const today = new Date().toISOString().split('T')[0]

  const { data: existing } = await supabaseAdmin
    .from('learning_streaks')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  let newStreak = 1

  if (existing) {
    const lastDate = existing.last_activity_date
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

    if (lastDate === today) {
      return existing.current_streak // already counted today
    } else if (lastDate === yesterday) {
      newStreak = existing.current_streak + 1
    }
    // else streak broken — reset to 1
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
  if (newStreak >= 7) await awardAchievement('seven_day_streak', tenantId, userId)
  if (newStreak >= 30) await awardAchievement('thirty_day_streak', tenantId, userId)
  if (newStreak >= 90) await awardAchievement('ninety_day_streak', tenantId, userId)

  return newStreak
}
