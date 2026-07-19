import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

/**
 * Business logo, stored as a base64 data URL in tenants.settings.logo_url.
 * A data URL renders reliably on every document surface — HTML payslips, the
 * print/PDF board pack, emailed docs — with no storage bucket, signed-URL
 * expiry, or CORS to manage. Kept small (≤ 300 KB) so the settings row stays lean.
 */
const MAX_LEN = 400_000 // ~300 KB once base64-decoded

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })
  const tenantId = user.app_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  const body = await request.json().catch(() => ({})) as { dataUrl?: string }
  const dataUrl = body.dataUrl?.trim()
  if (!dataUrl || !/^data:image\/(png|jpeg|jpg|webp|svg\+xml);base64,/.test(dataUrl)) {
    return NextResponse.json({ error: 'Upload a PNG, JPG, WEBP or SVG image.' }, { status: 400 })
  }
  if (dataUrl.length > MAX_LEN) {
    return NextResponse.json({ error: 'Logo is too large. Use an image under ~300 KB.' }, { status: 413 })
  }

  const { data: row } = await supabaseAdmin.from('tenants').select('settings').eq('id', tenantId).maybeSingle()
  const settings = { ...((row?.settings ?? {}) as Record<string, unknown>), logo_url: dataUrl }
  const { error } = await supabaseAdmin.from('tenants').update({ settings }).eq('id', tenantId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })
  const tenantId = user.app_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  const { data: row } = await supabaseAdmin.from('tenants').select('settings').eq('id', tenantId).maybeSingle()
  const settings = { ...((row?.settings ?? {}) as Record<string, unknown>) }
  delete settings.logo_url
  const { error } = await supabaseAdmin.from('tenants').update({ settings }).eq('id', tenantId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
