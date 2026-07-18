import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkPermission } from '@/lib/auth/permissions'

// ⚠️ PAYMENTS — Paystack subscription CANCEL (AdminOS plans). DO NOT REMOVE ⚠️
//
// POST /api/billing/cancel — a tenant with `manage_billing` cancels their plan.
// We NEVER trust a client-supplied email: identity comes from the Supabase session
// (user.email = the billing email, app_metadata.tenant_id = the tenant — service-role
// writable only, never the spoofable user_metadata). We ask the
// Mirembe hub to disable the Paystack subscription for that email:
//     POST https://jarvis.mirembemuse.co.za/api/paystack/cancel
//     headers: x-hub-secret: HUB_INTERNAL_SECRET
//     body:    { email, app: 'adminos', ref: tenantId }
// The hub disables it on Paystack (source of truth), which then fires
// subscription.disable → hub → /api/paystack/webhook, flipping subscriptions.status
// to 'cancelled'. Cancel = "won't auto-renew"; access continues until the period ends.
const HUB_URL = (process.env.PAYSTACK_HUB_URL || 'https://jarvis.mirembemuse.co.za').replace(/\/$/, '')

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.app_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  if (!(await checkPermission('manage_billing'))) return new NextResponse('Forbidden', { status: 403 })

  const email = (user.email || '').trim().toLowerCase()
  if (!email) return NextResponse.json({ error: 'No billing email is set on your account.' }, { status: 400 })

  if (!process.env.HUB_INTERNAL_SECRET) {
    return NextResponse.json({ error: 'Cancellation is temporarily unavailable.' }, { status: 503 })
  }

  try {
    const r = await fetch(`${HUB_URL}/api/paystack/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-hub-secret': process.env.HUB_INTERNAL_SECRET },
      body: JSON.stringify({ email, app: 'adminos', ref: tenantId }),
      signal: AbortSignal.timeout(15_000),
    })
    const body = await r.json().catch(() => ({}))
    if (!r.ok) {
      // 404 = no active subscription found (already cancelled, or still on trial / PayFast one-time).
      const msg = r.status === 404
        ? "We couldn't find an active subscription for your account."
        : (body.error || 'Could not cancel right now. Please try again or contact support.')
      return NextResponse.json({ error: msg }, { status: r.status === 404 ? 404 : 502 })
    }
    // Success — Paystack marked it non-renewing; the subscription.disable webhook
    // is the source of truth and will flip subscriptions.status to 'cancelled'.
    console.log('[billing/cancel] cancelled for tenant', tenantId)
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[billing/cancel] hub call failed:', (e as Error).message)
    return NextResponse.json({ error: 'Could not reach the billing service. Please try again shortly.' }, { status: 502 })
  }
}
