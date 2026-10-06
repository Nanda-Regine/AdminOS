import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { withRoute, unwrap } from '@/lib/api/withRoute'
import type { TenantMode } from '@/lib/tenant/mode'

// Solo vs team mode. Reading it shapes everyone's nav; changing it is a setting.
export const GET = withRoute({ action: 'profile.own' }, async ({ ctx }) => {
  const data = unwrap(await supabaseAdmin.from('tenants').select('mode').eq('id', ctx.tenantId).maybeSingle())
  return { mode: (data?.mode as TenantMode) ?? 'solo' }
})

export const PATCH = withRoute({
  action: 'settings.write',
  body: z.object({ mode: z.enum(['solo', 'team']) }),
  audit: 'settings.mode_changed',
  resourceType: 'tenant',
}, async ({ ctx, body }) => {
  return unwrap(await supabaseAdmin
    .from('tenants')
    .update({ mode: body.mode })
    .eq('id', ctx.tenantId)
    .select('id, mode')
    .single())
})
