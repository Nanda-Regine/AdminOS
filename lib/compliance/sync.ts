/**
 * Write a tenant's statutory compliance calendar (lib/compliance/calendar.ts)
 * to compliance_items: insert what's missing, refresh/revive what's right,
 * soft-delete open rows on dates the rules never produce. Idempotent — run at
 * signup, when the financial year end changes, and monthly to roll the
 * 12-month window forward.
 */
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sastDate } from '@/lib/time/sast'
import { planCalendarSync, STATUTORY_TYPES, type ExistingRow } from '@/lib/compliance/calendar'

export async function syncStatutoryCalendar(tenantId: string): Promise<{ inserted: number; updated: number; removed: number }> {
  const { data: tenant, error: tErr } = await supabaseAdmin
    .from('tenants')
    .select('business_type, settings')
    .eq('id', tenantId)
    .maybeSingle()
  if (tErr || !tenant) throw new Error(`calendar sync: tenant ${tenantId} not found`)
  const settings = (tenant.settings ?? {}) as Record<string, unknown>

  const { data: rows, error: rErr } = await supabaseAdmin
    .from('compliance_items')
    .select('id, item_type, due_date, status, completed_at, deleted_at')
    .eq('tenant_id', tenantId)
    .in('item_type', [...STATUTORY_TYPES, 'emp501_may', 'emp501_oct'])
  if (rErr) throw rErr

  const plan = planCalendarSync((rows ?? []) as ExistingRow[], {
    today: sastDate(),
    fyEndMonth: Number(settings.financial_year_end_month) || 2,
    businessType: tenant.business_type as string | null,
    incorporationDate: (settings.incorporation_date as string | undefined) ?? null,
  })

  const now = new Date().toISOString()
  if (plan.softDelete.length) {
    const { error } = await supabaseAdmin.from('compliance_items').update({ deleted_at: now })
      .in('id', plan.softDelete).eq('tenant_id', tenantId)
    if (error) throw error
  }
  for (const { id, item, revive } of plan.update) {
    const { error } = await supabaseAdmin.from('compliance_items').update({
      title: item.title, description: item.description, recurrence: item.recurrence,
      penalty_description: item.penalty_description, ...(revive ? { deleted_at: null, status: 'upcoming' } : {}),
    }).eq('id', id).eq('tenant_id', tenantId)
    if (error) throw error
  }
  if (plan.insert.length) {
    const { error } = await supabaseAdmin.from('compliance_items')
      .insert(plan.insert.map(i => ({ tenant_id: tenantId, ...i })))
    if (error) throw error
  }
  return { inserted: plan.insert.length, updated: plan.update.length, removed: plan.softDelete.length }
}
