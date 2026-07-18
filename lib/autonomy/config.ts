import { supabaseAdmin } from '@/lib/supabase/admin'
import type { AutonomyRow } from './tiers'

/** Fetch a tenant's autonomy overrides (empty → all defaults apply). */
export async function getTenantAutonomy(tenantId: string): Promise<AutonomyRow[]> {
  try {
    const { data } = await supabaseAdmin
      .from('tenant_autonomy_config')
      .select('domain, decision_type, tier')
      .eq('tenant_id', tenantId)
    return (data ?? []) as AutonomyRow[]
  } catch {
    return []
  }
}
