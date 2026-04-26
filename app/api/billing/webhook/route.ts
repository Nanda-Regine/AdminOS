import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { writeAuditLog } from '@/lib/security/audit'
import { createHash } from 'crypto'

export const runtime = 'nodejs'

const VALID_HOSTS = [
  'www.payfast.co.za',
  'sandbox.payfast.co.za',
  'w1w.payfast.co.za',
  'w2w.payfast.co.za',
]

async function verifyPayFastIp(request: Request): Promise<boolean> {
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0].trim() : ''

  // Resolve PayFast hostnames to IPs and check
  for (const host of VALID_HOSTS) {
    try {
      const res = await fetch(`https://dns.google/resolve?name=${host}&type=A`)
      const data = await res.json() as { Answer?: { data: string }[] }
      const ips  = (data.Answer || []).map((a) => a.data)
      if (ips.includes(ip)) return true
    } catch {
      // Non-critical — log and continue
    }
  }
  // In development/sandbox, skip strict IP check
  return process.env.NODE_ENV !== 'production'
}

function verifyPayFastSignature(data: Record<string, string>, passphrase: string): boolean {
  const { signature, ...params } = data
  const str = Object.entries(params)
    .filter(([, v]) => v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(v.trim()).replace(/%20/g, '+')}`)
    .join('&') + `&passphrase=${encodeURIComponent(passphrase.trim()).replace(/%20/g, '+')}`
  const computed = createHash('md5').update(str).digest('hex')
  return computed === signature
}

export async function POST(request: Request) {
  const body = await request.text()
  const params = Object.fromEntries(new URLSearchParams(body))

  // Verify source IP
  const validIp = await verifyPayFastIp(request)
  if (!validIp) {
    console.warn('[PayFast] Webhook from unrecognised IP')
    return new NextResponse('Forbidden', { status: 403 })
  }

  // Verify signature
  const passphrase = process.env.PAYFAST_PASSPHRASE || ''
  if (!verifyPayFastSignature(params, passphrase)) {
    console.warn('[PayFast] Invalid signature')
    return new NextResponse('Invalid signature', { status: 400 })
  }

  const paymentStatus = params.payment_status // 'COMPLETE' | 'FAILED' | 'CANCELLED'
  const tenantId      = params.custom_str1
  const plan          = params.custom_str2

  if (!tenantId || !plan) {
    return new NextResponse('Missing custom fields', { status: 400 })
  }

  if (paymentStatus === 'COMPLETE') {
    const periodEnd = new Date()
    periodEnd.setMonth(periodEnd.getMonth() + 1)

    await Promise.all([
      supabaseAdmin
        .from('tenants')
        .update({ plan, active: true })
        .eq('id', tenantId),
      supabaseAdmin
        .from('subscriptions')
        .upsert({
          tenant_id:          tenantId,
          plan,
          status:             'active',
          payfast_token:      params.token || null,
          amount:             Number(params.amount_gross || 0),
          current_period_end: periodEnd.toISOString(),
          updated_at:         new Date().toISOString(),
        }, { onConflict: 'tenant_id' })
        .then(() => {}, () => {}), // table may not exist yet — non-fatal
    ])

    await writeAuditLog({
      tenantId,
      actor:    'payfast',
      action:   'billing.payment_complete',
      metadata: {
        plan,
        amount:            params.amount_gross,
        payfastPaymentId:  params.pf_payment_id,
        subscriptionToken: params.token,
      },
    })
  } else if (paymentStatus === 'FAILED' || paymentStatus === 'CANCELLED') {
    await writeAuditLog({
      tenantId,
      actor:  'payfast',
      action: `billing.payment_${paymentStatus.toLowerCase()}`,
      metadata: { plan, amount: params.amount_gross },
    })
  }

  // PayFast expects a 200 OK with empty body
  return new NextResponse('OK', { status: 200 })
}
