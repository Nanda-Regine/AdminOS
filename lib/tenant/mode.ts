/**
 * Solo / Team Mode — Phase 0.7
 *
 * Solo mode = single operator. Hides staff, HR, and Employee OS sections.
 * Team mode = multiple employees. Full feature set unlocked.
 *
 * Auto-switches to team mode when the first staff member is added.
 * Owner can also toggle manually in Settings.
 */

import { supabaseAdmin } from '@/lib/supabase/admin'

export type TenantMode = 'solo' | 'team'

/** Get the mode for a tenant (cached via caller — not Redis, kept simple) */
export async function getTenantMode(tenantId: string): Promise<TenantMode> {
  const { data } = await supabaseAdmin
    .from('tenants')
    .select('mode')
    .eq('id', tenantId)
    .single()

  return (data?.mode as TenantMode) ?? 'solo'
}

export async function isTeamMode(tenantId: string): Promise<boolean> {
  return (await getTenantMode(tenantId)) === 'team'
}

export async function isSoloMode(tenantId: string): Promise<boolean> {
  return (await getTenantMode(tenantId)) === 'solo'
}

/** Set team mode. Called when first staff member is added. */
export async function setTeamMode(tenantId: string): Promise<void> {
  await supabaseAdmin
    .from('tenants')
    .update({ mode: 'team' })
    .eq('id', tenantId)
}

/** Set solo mode. Only callable by owner from settings. */
export async function setSoloMode(tenantId: string): Promise<void> {
  await supabaseAdmin
    .from('tenants')
    .update({ mode: 'solo' })
    .eq('id', tenantId)
}

/**
 * Automatically promote to team mode when a staff member is added.
 * Safe to call even if already in team mode.
 */
export async function autoPromoteToTeamMode(tenantId: string): Promise<void> {
  await supabaseAdmin
    .from('tenants')
    .update({ mode: 'team' })
    .eq('id', tenantId)
    .eq('mode', 'solo')  // no-op if already team
}

/**
 * Navigation visibility helper.
 * Returns which top-level nav sections are visible for the given mode.
 */
export function getVisibleNavSections(mode: TenantMode): {
  showStaff:        boolean
  showHR:           boolean
  showEmployeeOS:   boolean
  showPayroll:      boolean
  showShifts:       boolean
  showAnnouncements: boolean
} {
  const isTeam = mode === 'team'
  return {
    showStaff:         isTeam,
    showHR:            isTeam,
    showEmployeeOS:    isTeam,
    showPayroll:       isTeam,
    showShifts:        isTeam,
    showAnnouncements: isTeam,
  }
}
