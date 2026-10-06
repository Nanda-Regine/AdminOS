// Run the statutory-calendar sync (lib/compliance/calendar.ts planCalendarSync)
// against the QA persona tenants ONLY — same plan the server's
// syncStatutoryCalendar executes, through PostgREST. Refuses any other tenant.
//
//   node scripts/qa-calendar-sync.mjs            apply to qa-persona-*
//   node scripts/qa-calendar-sync.mjs --dry-run  print the plan only
import { planCalendarSync, STATUTORY_TYPES } from '../lib/compliance/calendar.ts'
import { select, insert, update } from './lib/qa.mjs'

const DRY = process.argv.includes('--dry-run')
const today = new Date(Date.now() + 2 * 3_600_000).toISOString().slice(0, 10) // SAST
const tenants = await select('tenants', 'select=id,slug,business_type,settings&slug=like.qa-persona-*')

for (const t of tenants) {
  if (!t.slug.startsWith('qa-persona-')) throw new Error(`refusing non-QA tenant ${t.slug}`)
  const types = [...STATUTORY_TYPES, 'emp501_may', 'emp501_oct'].join(',')
  const rows = await select('compliance_items', `select=id,item_type,due_date,status,completed_at,deleted_at&tenant_id=eq.${t.id}&item_type=in.(${types})`)
  const plan = planCalendarSync(rows, {
    today, fyEndMonth: Number(t.settings?.financial_year_end_month) || 2,
    businessType: t.business_type, incorporationDate: t.settings?.incorporation_date ?? null,
  })
  console.log(`${t.slug.padEnd(22)} insert ${plan.insert.length}  update ${plan.update.length}  soft-delete ${plan.softDelete.length}`)
  if (DRY) continue
  const now = new Date().toISOString()
  if (plan.softDelete.length) await update('compliance_items', `tenant_id=eq.${t.id}&id=in.(${plan.softDelete.join(',')})`, { deleted_at: now })
  for (const { id, item, revive } of plan.update) {
    await update('compliance_items', `tenant_id=eq.${t.id}&id=eq.${id}`, {
      title: item.title, description: item.description, recurrence: item.recurrence, penalty_description: item.penalty_description,
      ...(revive ? { deleted_at: null, status: 'upcoming' } : {}),
    })
  }
  if (plan.insert.length) await insert('compliance_items', plan.insert.map(i => ({ tenant_id: t.id, ...i })))
}
