import { supabaseAdmin } from '@/lib/supabase/admin'

/**
 * The caller's own staff row in this tenant, via staff.user_id — never via
 * user-editable metadata. Null when the login isn't linked to a staff record
 * (owners often aren't), so "own data" routes return nothing rather than
 * everything.
 */
export async function ownStaffId(tenantId: string, userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('staff')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .maybeSingle()
  return data?.id ?? null
}

/** Confirm a caller-supplied staff id is a live staff row in this tenant. */
export async function isTenantStaff(tenantId: string, staffId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('staff')
    .select('id')
    .eq('id', staffId)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .maybeSingle()
  return data != null
}
