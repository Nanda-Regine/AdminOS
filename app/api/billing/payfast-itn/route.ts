/**
 * PayFast ITN (Instant Transaction Notification) handler.
 * PayFast sends a POST to this URL after every payment event.
 * Spec: https://developers.payfast.co.za/docs#itn
 */
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { writeAuditLog } from '@/lib/security/audit'
import { createHash } from 'crypto'

export const runtime = 'nodejs'

const PAYFAST_HOSTS = [
  'www.payfast.co.za',
  'sandbox.payfast.co.za',
  'w1w.payfast.co.za',
  'w2w.payfast.co.za',
]

async function isTrustedIp(request: Request): Promise<boolean> {
  if (process.env.NODE_ENV !== 'production') return true
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = (forwarded ? forwarded.split(',')[0] : '').trim()
  for (const host of PAYFAST_HOSTS) {
    try {
      const res  = await fetch(`https://dns.google/resolve?name=${host}&type=A`)
      const data = await res.json() as { Answer?: { data: string }[] }
      if ((data.Answer ?? []).some(a => a.data === ip)) return true
    } catch { /* non-fatal */ }
  }
  return false
}

function verifySignature(params: Record<string, string>, passphrase: string): boolean {
  const { signature, ...rest } = params
  const str = Object.entries(rest)
    .filter(([, v]) => v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(v.trim()).replace(/%20/g, '+')}`)
    .join('&') + `&passphrase=${encodeURIComponent(passphrase.trim()).replace(/%20/g, '+')}`
  return createHash('md5').update(str).digest('hex') === signature
}

export async function POST(request: Request) {
  // 1. IP check
  if (!await isTrustedIp(request)) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  // 2. Parse URL-encoded body
  const raw  = await request.text()
  const params: Record<string, string> = {}
  for (const [k, v] of new URLSearchParams(raw)) params[k] = v

  // 3. Signature validation
  const passphrase = process.env.PAYFAST_PASSPHRASE ?? ''
  if (!verifySignature(params, passphrase)) {
    return new NextResponse('Invalid signature', { status: 400 })
  }

  const paymentStatus = params.payment_status
  const customStr     = params.custom_str1 ?? ''    // "tenantId:{uuid}"
  const plan          = params.custom_str2 ?? ''    // plan name (optional)
  const addon         = params.custom_str3 ?? ''    // addon key (optional)
  const tenantId      = customStr.replace('tenantId:', '').trim()

  if (!tenantId) {
    return new NextResponse('Missing tenant', { status: 400 })
  }

  // 4. Log the billing event (non-fatal if table not yet migrated)
  await supabaseAdmin
    .from('billing_events')
    .insert({
      tenant_id:        tenantId,
      event_type:       `payfast.${paymentStatus?.toLowerCase() ?? 'unknown'}`,
      amount:           Number(params.amount_gross || 0),
      payfast_reference: params.pf_payment_id ?? null,
      metadata:         params,
    })
    .then(() => {}, () => {})

  if (paymentStatus === 'COMPLETE') {
    const periodEnd = new Date()
    periodEnd.setMonth(periodEnd.getMonth() + 1)

    if (addon) {
      const addonCol        = `addon_${addon}`
      const addonExpiresCol = `addon_${addon}_expires_at`
      await supabaseAdmin
        .from('subscriptions')
        .upsert(
          {
            tenant_id:         tenantId,
            status:            'active',
            payfast_token:     params.token ?? null,
            [addonCol]:        true,
            [addonExpiresCol]: periodEnd.toISOString(),
            updated_at:        new Date().toISOString(),
          },
          { onConflict: 'tenant_id' }
        )
        .then(() => {}, () => {})
    } else if (plan) {
      await Promise.all([
        supabaseAdmin
          .from('tenants')
          .update({ plan, active: true })
          .eq('id', tenantId),
        supabaseAdmin
          .from('subscriptions')
          .upsert(
            {
              tenant_id:             tenantId,
              plan,
              status:                'active',
              payfast_token:         params.token ?? null,
              payfast_subscription_id: params.token ?? null,
              amount:                Number(params.amount_gross || 0),
              current_period_start:  new Date().toISOString(),
              current_period_end:    periodEnd.toISOString(),
              updated_at:            new Date().toISOString(),
            },
            { onConflict: 'tenant_id' }
          ),
      ]).catch(() => {})
    }

    await writeAuditLog({
      tenantId,
      actor:    'payfast',
      action:   'billing.payment_complete',
      metadata: { plan: plan || null, addon: addon || null, amount: params.amount_gross },
    })
  } else if (paymentStatus === 'CANCELLED') {
    await supabaseAdmin
      .from('subscriptions')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .then(() => {}, () => {})

    await writeAuditLog({
      tenantId,
      actor:    'payfast',
      action:   'billing.subscription_cancelled',
      metadata: {},
    })
  }

  return new NextResponse('OK', { status: 200 })
}
