import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

/**
 * ⚠️⚠️ PAYMENTS — Paystack subscription receiver. DO NOT REMOVE ⚠️⚠️
 * The Mirembe hub (jarvis.mirembemuse.co.za) forwards verified Paystack events here,
 * authenticated with x-hub-secret == HUB_INTERNAL_SECRET. Activates the tenant's plan
 * from the transaction metadata (ref = tenant_id, tier = Paystack plan key).
 * AdminOS plan subscriptions run through Paystack (not PayFast). Keep this flow.
 */
const TIER_PLAN: Record<string, string> = {
  adminos_solo: 'solo', adminos_grow: 'grow', adminos_operate: 'operate', adminos_scale: 'scale', adminos_partner: 'partner',
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
    const plan = TIER_PLAN[meta.tier as string]

    if (evt.event === 'charge.success' && tenantId && plan) {
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
      await supabaseAdmin.from('subscriptions').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('tenant_id', tenantId)
    }
    return new NextResponse('OK', { status: 200 })
  } catch (e) {
    console.error('[paystack] webhook error', e)
    return new NextResponse('OK', { status: 200 })
  }
}
