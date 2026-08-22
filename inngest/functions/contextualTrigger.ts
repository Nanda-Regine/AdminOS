import { inngest } from '@/inngest/client'
import { supabaseAdmin } from '@/lib/supabase/admin'

// Routes business events to relevant academy lessons
// Fired whenever a significant business event occurs (invoice sent, staff added, etc.)
export const contextualTriggerFunction = inngest.createFunction(
  { id: 'contextual-trigger-academy', retries: 2, triggers: [{ event: 'adminos/business.event.fired' }] },
  async ({ event, step }: any) => {
    const { tenant_id, user_id, event_type } = event.data as {
      tenant_id: string
      user_id: string
      event_type: string
      metadata?: Record<string, unknown>
    }

    // Step 1: Look up matching academy lessons for this event type.
    // Table is `contextual_triggers`, not `context_triggers`, and it has no
    // module_id/priority columns — those don't exist under any name. Real
    // columns are lesson_id/condition/cooldown_hours/message_template. This
    // fix matches on event_type only (same as before) and drops the
    // priority ordering it can't do; `condition` (presumably a JSONB
    // match expression for finer targeting) and `cooldown_hours`
    // (presumably meant to replace the flat daily-count limit below) are
    // real, un-implemented product features, not renames — flagged, not
    // guessed at.
    const triggers = await step.run('lookup-triggers', async () => {
      const { data } = await supabaseAdmin
        .from('contextual_triggers')
        .select('id, lesson_id')
        .eq('event_type', event_type)

      return data ?? []
    })

    if (triggers.length === 0) {
      return { event_type, matched: 0, created: 0 }
    }

    // Step 2: Check how many notifications the user already has today.
    // Table is `triggered_lessons`, not `academy_notifications` — real
    // columns are tenant_id/user_id/trigger_id/triggered_at/dismissed_at/
    // completed_at (no created_at).
    const todayCount = await step.run('check-daily-count', async () => {
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)

      const { count } = await supabaseAdmin
        .from('triggered_lessons')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenant_id)
        .eq('user_id', user_id)
        .gte('triggered_at', todayStart.toISOString())

      return count ?? 0
    })

    const remaining = 3 - todayCount
    if (remaining <= 0) {
      return { event_type, matched: triggers.length, created: 0, reason: 'daily_limit_reached' }
    }

    // Step 3: Create notifications for matched triggers (up to daily limit)
    const toCreate = triggers.slice(0, remaining)
    const created = await step.run('create-notifications', async () => {
      const now = new Date().toISOString()
      const rows = toCreate.map((trigger: { id: string; lesson_id: string }) => ({
        tenant_id,
        user_id,
        trigger_id: trigger.id,
        triggered_at: now,
      }))

      const { error } = await supabaseAdmin
        .from('triggered_lessons')
        .insert(rows)

      if (error) throw new Error(`Failed to insert notifications: ${error.message}`)
      return rows.length
    })

    return { event_type, matched: triggers.length, created, daily_limit_remaining: remaining - created }
  }
)
