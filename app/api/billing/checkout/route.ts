import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createHash } from 'crypto'

// PayFast plan amounts in ZAR (B2B SaaS pricing)
const PLAN_AMOUNTS: Record<string, { amount: string; name: string }> = {
  starter:     { amount: '2500.00',  name: 'AdminOS Starter'     },
  growth:      { amount: '4500.00',  name: 'AdminOS Growth'      },
  enterprise:  { amount: '8500.00',  name: 'AdminOS Enterprise'  },
  white_label: { amount: '14999.00', name: 'AdminOS White Label' },
}

const PF_URL = process.env.NODE_ENV === 'production'
  ? 'https://www.payfast.co.za/eng/process'
  : 'https://sandbox.payfast.co.za/eng/process'

function buildSignature(params: Record<string, string>, passphrase: string): string {
  const str = Object.entries(params)
    .filter(([, v]) => v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(v.trim()).replace(/%20/g, '+')}`)
    .join('&') + `&passphrase=${encodeURIComponent(passphrase.trim()).replace(/%20/g, '+')}`
  return createHash('md5').update(str).digest('hex')
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const { searchParams } = new URL(request.url)
  const plan = searchParams.get('plan') || 'starter'
  const planConfig = PLAN_AMOUNTS[plan]
  if (!planConfig) return new NextResponse('Invalid plan', { status: 400 })

  const merchantId  = process.env.PAYFAST_MERCHANT_ID  || ''
  const merchantKey = process.env.PAYFAST_MERCHANT_KEY || ''
  const passphrase  = process.env.PAYFAST_PASSPHRASE   || ''
  const appUrl      = process.env.NEXT_PUBLIC_APP_URL  || 'https://adminos.co.za'

  const tenantId = user.user_metadata?.tenant_id as string

  const params: Record<string, string> = {
    merchant_id:     merchantId,
    merchant_key:    merchantKey,
    return_url:      `${appUrl}/dashboard/settings/billing?success=true`,
    cancel_url:      `${appUrl}/dashboard/settings/billing?cancelled=true`,
    notify_url:      `${appUrl}/api/billing/webhook`,
    name_first:      (user.user_metadata?.full_name || user.email || '').split(' ')[0],
    name_last:       (user.user_metadata?.full_name || '').split(' ').slice(1).join(' ') || 'User',
    email_address:   user.email || '',
    m_payment_id:    `${tenantId}:${plan}:${Date.now()}`,
    amount:          planConfig.amount,
    item_name:       planConfig.name,
    item_description: `AdminOS ${plan} plan — monthly subscription`,
    subscription_type: '1',
    billing_date:    new Date().toISOString().split('T')[0],
    recurring_amount: planConfig.amount,
    frequency:       '3', // monthly
    cycles:          '0', // indefinite
    custom_str1:     tenantId,
    custom_str2:     plan,
  }

  const signature = buildSignature(params, passphrase)

  // Build the PayFast form as an HTML auto-submit page
  const formFields = Object.entries({ ...params, signature })
    .map(([k, v]) => `<input type="hidden" name="${k}" value="${v.replace(/"/g, '&quot;')}" />`)
    .join('\n')

  const html = `<!DOCTYPE html>
<html>
<head><title>Redirecting to PayFast...</title></head>
<body>
  <p style="font-family:system-ui;text-align:center;padding:40px;color:#374151">
    Redirecting to PayFast secure checkout...
  </p>
  <form id="pf" action="${PF_URL}" method="POST">
    ${formFields}
  </form>
  <script>document.getElementById('pf').submit()</script>
</body>
</html>`

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html' },
  })
}
