import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

/**
 * ⚠️⚠️ PAYMENTS — Paystack subscription receiver. DO NOT REMOVE ⚠️⚠️
 * The Mirembe hub (jarvis.mirembemuse.co.za) forwards verified Paystack events here,
 * authenticated with x-hub-secret == HUB_INTERNAL_SECRET. Activates the tenant's PLAN
 * or an ADD-ON from the transaction metadata (ref = tenant_id, tier = Paystack plan key).
 * AdminOS plans AND add-ons run through Paystack (not PayFast). Keep this flow.
 */

// metadata.tier (the hub's checkout plan key) → our internal plan / add-on slug.
const TIER_PLAN: Record<string, string> = {
  adminos_solo: 'solo', adminos_grow: 'grow', adminos_operate: 'operate', adminos_scale: 'scale', adminos_partner: 'partner',
}
const TIER_ADDON: Record<string, string> = {
  adminos_ring: 'ring', adminos_reach: 'reach',
  adminos_languages: 'languages', adminos_client_portal: 'client_portal',
}

// Fallback add-on resolution by plan code — for events that don't carry our metadata
// (e.g. subscription.disable), map the live Paystack plan code → add-on slug via env.
const ADDON_PLAN_ENV: Record<string, string> = {
  ring: 'PAYSTACK_PLAN_ADMINOS_RING', reach: 'PAYSTACK_PLAN_ADMINOS_REACH',
  languages: 'PAYSTACK_PLAN_ADMINOS_LANGUAGES', client_portal: 'PAYSTACK_PLAN_ADMINOS_CLIENT_PORTAL',
}
function addonByPlanCode(code: string | null): string | null {
  if (!code) return null
  for (const [slug, env] of Object.entries(ADDON_PLAN_ENV)) {
    if (process.env[env]?.trim() === code) return slug
  }
  return null
}

export async function POST(request: Request) {
  try {
    const hubSecret = process.env.HUB_INTERNAL_SECRET
    if (!hubSecret || request.headers.get('x-hub-secret') !== hubSecret) {
      return new NextResponse('Forbidden', { status: 403 })
    }
    const evt = await request.json().catch(() => null)
    if (!evt) return new NextResponse('OK', { status: 200 })

    const data = evt.data || {}
    const meta = (data.metadata && typeof data.metadata === 'object') ? data.metadata : {}
    const tenantId: string | undefined = meta.ref
    const tier = meta.tier as string | undefined
    const planCode: string | null = data.plan?.plan_code || (typeof data.plan === 'string' ? data.plan : null)

    const plan  = tier ? TIER_PLAN[tier] : undefined
    const addon = (tier && TIER_ADDON[tier]) || addonByPlanCode(planCode)

    if (evt.event === 'charge.success' && tenantId && addon) {
      // Add-on purchase or renewal → switch the add-on on + extend one month.
      const periodEnd = new Date()
      periodEnd.setMonth(periodEnd.getMonth() + 1)
      await supabaseAdmin.from('subscriptions').upsert({
        tenant_id: tenantId,
        [`addon_${addon}`]: true,
        [`addon_${addon}_expires_at`]: periodEnd.toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'tenant_id' })
      console.log('[paystack] activated add-on', tenantId, addon)
    } else if (evt.event === 'charge.success' && tenantId && plan) {
      // Plan purchase or renewal → activate the tenant's plan.
      const periodEnd = new Date()
      periodEnd.setMonth(periodEnd.getMonth() + 1)
      await Promise.all([
        supabaseAdmin.from('tenants').update({ plan, active: true }).eq('id', tenantId),
        supabaseAdmin.from('subscriptions').upsert({
          tenant_id: tenantId, plan, status: 'active',
          amount: Number(data.amount || 0) / 100,
          current_period_end: periodEnd.toISOString(), updated_at: new Date().toISOString(),
        }, { onConflict: 'tenant_id' }),
      ])
      console.log('[paystack] activated tenant', tenantId, plan)
    } else if ((evt.event === 'subscription.disable' || evt.event === 'subscription.not_renew') && tenantId) {
      if (addon) {
        // Only this add-on was cancelled — leave the plan subscription untouched.
        await supabaseAdmin.from('subscriptions')
          .update({ [`addon_${addon}`]: false, updated_at: new Date().toISOString() })
          .eq('tenant_id', tenantId)
        console.log('[paystack] cancelled add-on', tenantId, addon)
      } else {
        await supabaseAdmin.from('subscriptions')
          .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
          .eq('tenant_id', tenantId)
      }
    }
    return new NextResponse('OK', { status: 200 })
  } catch (e) {
    console.error('[paystack] webhook error', e)
    return new NextResponse('OK', { status: 200 })
  }
}
