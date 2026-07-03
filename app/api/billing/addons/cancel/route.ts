import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { checkPermission } from '@/lib/auth/permissions'

// ⚠️ PAYMENTS — cancel a single AdminOS ADD-ON (Paystack). DO NOT REMOVE ⚠️
//
// POST /api/billing/addons/cancel  { slug }
// Cancels ONLY the named add-on's Paystack subscription — never the plan or other add-ons.
// We resolve the add-on's live plan code from env and pass it to the hub as `planCode`, so
// the hub scopes the disable to exactly that subscription. Identity (email) is derived from
// the session, never the client. On success we flip subscriptions.addon_<slug> off (the
// column the billing UI reads); the subscription.disable webhook reconciles it too.
const ADDON_PLAN_ENV: Record<string, string> = {
  ring: 'PAYSTACK_PLAN_ADMINOS_RING', reach: 'PAYSTACK_PLAN_ADMINOS_REACH', sage: 'PAYSTACK_PLAN_ADMINOS_SAGE',
  languages: 'PAYSTACK_PLAN_ADMINOS_LANGUAGES', client_portal: 'PAYSTACK_PLAN_ADMINOS_CLIENT_PORTAL',
}
const HUB_URL = (process.env.PAYSTACK_HUB_URL || 'https://jarvis.mirembemuse.co.za').replace(/\/$/, '')

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.user_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  if (!(await checkPermission('manage_billing'))) return new NextResponse('Forbidden', { status: 403 })

  const body = (await request.json().catch(() => ({}))) as { slug?: string }
  const slug = (body.slug || '').trim()
  const planEnv = ADDON_PLAN_ENV[slug]
  if (!planEnv) return NextResponse.json({ error: 'Unknown add-on' }, { status: 400 })

  const planCode = process.env[planEnv]?.trim()
  // HARD GUARD: without a plan code the hub would cancel EVERY adminos subscription. Refuse.
  if (!planCode) return NextResponse.json({ error: 'This add-on is not configured for cancellation yet.' }, { status: 503 })

  const email = (user.email || '').trim().toLowerCase()
  if (!email) return NextResponse.json({ error: 'No billing email is set on your account.' }, { status: 400 })
  if (!process.env.HUB_INTERNAL_SECRET) return NextResponse.json({ error: 'Cancellation is temporarily unavailable.' }, { status: 503 })

  try {
    const r = await fetch(`${HUB_URL}/api/paystack/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-hub-secret': process.env.HUB_INTERNAL_SECRET },
      body: JSON.stringify({ email, app: 'adminos', planCode }),
      signal: AbortSignal.timeout(15_000),
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) {
      const msg = r.status === 404
        ? "We couldn't find an active subscription for this add-on."
        : (j.error || 'Could not cancel right now. Please try again or contact support.')
      return NextResponse.json({ error: msg }, { status: r.status === 404 ? 404 : 502 })
    }
    // Flip the boolean the billing page reads. The subscription.disable webhook reconciles.
    await supabaseAdmin
      .from('subscriptions')
      .update({ [`addon_${slug}`]: false, updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
    console.log('[addons/cancel] cancelled', slug, 'for tenant', tenantId)
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[addons/cancel] hub call failed:', (e as Error).message)
    return NextResponse.json({ error: 'Could not reach the billing service. Please try again shortly.' }, { status: 502 })
  }
}
