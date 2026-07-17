import { supabaseAdmin } from '@/lib/supabase/admin'

interface AuditEntry {
  tenantId?: string
  actor: string
  action: string
  resourceType?: string
  resourceId?: string
  metadata?: Record<string, unknown>
  ipAddress?: string
  /**
   * When true, a failed write throws instead of being swallowed. Use for any
   * action where the absence of a record is itself a problem — super-admin and
   * operator mutations especially: for a POPIA-facing tool, "we changed a
   * tenant's data but can't prove who or when" is worse than failing the action.
   * Defaults to false for high-volume, non-privileged events.
   */
  critical?: boolean
}

// The canonical audit table is `audit_log` (singular) — immutable, append-only,
// POPIA. There is no `audit_logs` (plural) table; writes that targeted it were
// silently dropped. Always route audit writes through here.
export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  const { error } = await supabaseAdmin.from('audit_log').insert({
    tenant_id: entry.tenantId || null,
    actor: entry.actor,
    action: entry.action,
    resource_type: entry.resourceType || null,
    resource_id: entry.resourceId || null,
    metadata: entry.metadata || null,
    ip_address: entry.ipAddress || null,
  })

  if (error) {
    console.error('[Audit] Failed to write audit log:', error)
    if (entry.critical) {
      throw new Error(`[Audit] critical audit write failed for action "${entry.action}": ${error.message}`)
    }
  }
}

export function getClientIp(request: Request): string {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  )
}
