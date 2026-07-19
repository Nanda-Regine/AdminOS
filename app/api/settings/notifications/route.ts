import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

/**
 * Owner notification controls, persisted in tenants.settings:
 *   - settings.quiet_hours = { start, end }  (minutes since midnight, SAST)
 *   - settings.notify[type].whatsapp = bool  (per-type WhatsApp opt-out)
 * GET returns the current values; POST merges a single change in.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })
  const tenantId = user.app_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  const { data } = await supabaseAdmin.from('tenants').select('settings').eq('id', tenantId).maybeSingle()
  const settings = (data?.settings ?? {}) as Record<string, unknown>
  return NextResponse.json({
    quietHours: settings.quiet_hours ?? null,
    notify: settings.notify ?? {},
  })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })
  const tenantId = user.app_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  const body = await request.json().catch(() => ({})) as {
    quietHours?: { start: number; end: number } | null
    type?: string
    whatsapp?: boolean
  }

  // Read-merge-write the settings JSON so we never clobber unrelated keys.
  const { data: row } = await supabaseAdmin.from('tenants').select('settings').eq('id', tenantId).maybeSingle()
  const settings = { ...((row?.settings ?? {}) as Record<string, unknown>) }

  if (body.quietHours !== undefined) {
    if (body.quietHours === null) {
      delete settings.quiet_hours
    } else {
      const { start, end } = body.quietHours
      if (![start, end].every(n => Number.isInteger(n) && n >= 0 && n <= 1439)) {
        return NextResponse.json({ error: 'quietHours start/end must be minutes 0–1439' }, { status: 400 })
      }
      settings.quiet_hours = { start, end }
    }
  }

  if (body.type !== undefined && typeof body.whatsapp === 'boolean') {
    const notify = { ...((settings.notify ?? {}) as Record<string, { whatsapp?: boolean }>) }
    notify[body.type] = { ...notify[body.type], whatsapp: body.whatsapp }
    settings.notify = notify
  }

  const { error } = await supabaseAdmin.from('tenants').update({ settings }).eq('id', tenantId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
