import { supabaseAdmin } from '@/lib/supabase/admin'
import { failClosedRows, type AutonomyRow } from './tiers'

/**
 * Fetch a tenant's autonomy overrides (empty → all defaults apply).
 * A failed read fails CLOSED (every decision surface-only), never to the
 * defaults, which auto-send to customers.
 */
export async function getTenantAutonomy(tenantId: string): Promise<AutonomyRow[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('tenant_autonomy_config')
      .select('domain, decision_type, tier')
      .eq('tenant_id', tenantId)
    if (error) throw error
    return (data ?? []) as AutonomyRow[]
  } catch (e) {
    console.error('[autonomy] config read failed, failing closed', e)
    return failClosedRows()
  }
}
