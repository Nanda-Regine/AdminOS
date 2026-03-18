import { supabaseAdmin } from '@/lib/supabase/admin'

interface AuditEntry {
  tenantId?: string
  actor: string
  action: string
  resourceType?: string
  resourceId?: string
  metadata?: Record<string, unknown>
  ipAddress?: string
}

export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  try {
    await supabaseAdmin.from('audit_log').insert({
      tenant_id: entry.tenantId || null,
      actor: entry.actor,
      action: entry.action,
      resource_type: entry.resourceType || null,
      resource_id: entry.resourceId || null,
      metadata: entry.metadata || null,
      ip_address: entry.ipAddress || null,
    })
  } catch (err) {
    // Audit log failures are critical — log to stderr but don't throw
    console.error('[Audit] Failed to write audit log:', err)
  }
}

export function getClientIp(request: Request): string {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  )
}
