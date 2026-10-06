import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { withRoute, unwrap } from '@/lib/api/withRoute'

/**
 * Business logo, stored as a base64 data URL in tenants.settings.logo_url.
 * A data URL renders reliably on every document surface — HTML payslips, the
 * print/PDF board pack, emailed docs — with no storage bucket, signed-URL
 * expiry, or CORS to manage. Kept small (≤ 300 KB) so the settings row stays lean.
 */
const MAX_LEN = 400_000 // ~300 KB once base64-decoded

const schema = z.object({
  dataUrl: z.string().trim()
    .regex(/^data:image\/(png|jpeg|jpg|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/, 'Upload a PNG, JPG, WEBP or SVG image.')
    .max(MAX_LEN, 'Logo is too large. Use an image under ~300 KB.'),
})

async function writeLogo(tenantId: string, dataUrl: string | null) {
  const row = unwrap(await supabaseAdmin.from('tenants').select('settings').eq('id', tenantId).maybeSingle())
  const settings = { ...((row?.settings ?? {}) as Record<string, unknown>) }
  if (dataUrl) settings.logo_url = dataUrl
  else delete settings.logo_url
  unwrap(await supabaseAdmin.from('tenants').update({ settings }).eq('id', tenantId))
}

export const POST = withRoute({ action: 'settings.write', body: schema, audit: 'settings.logo_changed', resourceType: 'tenant' },
  async ({ ctx, body }) => { await writeLogo(ctx.tenantId, body.dataUrl); return { id: ctx.tenantId, ok: true } })

export const DELETE = withRoute({ action: 'settings.write', audit: 'settings.logo_removed', resourceType: 'tenant' },
  async ({ ctx }) => { await writeLogo(ctx.tenantId, null); return { id: ctx.tenantId, ok: true } })
