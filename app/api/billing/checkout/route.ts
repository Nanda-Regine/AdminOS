import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createHash } from 'crypto'

// PayFast plan amounts in ZAR — must match plan_catalogue table
const PLAN_AMOUNTS: Record<string, { amount: string; name: string }> = {
  solo:        { amount: '349.00',  name: 'AdminOS Solo'    },
  grow:        { amount: '899.00',  name: 'AdminOS Grow'    },
  operate:     { amount: '1999.00', name: 'AdminOS Operate' },
  scale:       { amount: '3999.00', name: 'AdminOS Scale'   },
  partner:     { amount: '9999.00', name: 'AdminOS Partner' },
}

const ADDON_AMOUNTS: Record<string, { amount: string; name: string }> = {
  ring:          { amount: '999.00',  name: 'AdminOS Ring Add-on'          },
  reach:         { amount: '499.00',  name: 'AdminOS Reach Add-on'         },
  sage:          { amount: '299.00',  name: 'AdminOS Sage Sync Add-on'     },
  languages:     { amount: '199.00',  name: 'AdminOS Languages Add-on'     },
  client_portal: { amount: '599.00',  name: 'AdminOS Client Portal Add-on' },
}

const PF_URL = process.env.NODE_ENV === 'production'
  ? 'https://www.payfast.co.za/eng/process'
  : 'https://sandbox.payfast.co.za/eng/process'

// PHP urlencode-compatible encoder — matches PayFast's server-side signature calculation
function phpUrlencode(str: string): string {
  return encodeURIComponent(str)
    .replace(/!/g, '%21').replace(/'/g, '%27')
    .replace(/\(/g, '%28').replace(/\)/g, '%29')
    .replace(/\*/g, '%2A').replace(/%20/g, '+')
}

function buildSignature(params: Record<string, string>, passphrase: string): string {
  const str = Object.entries(params)
    .filter(([, v]) => v !== '')
    .map(([k, v]) => `${k}=${phpUrlencode(v.trim())}`)
    .join('&') + `&passphrase=${phpUrlencode(passphrase.trim())}`
  return createHash('md5').update(str).digest('hex')
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const { searchParams } = new URL(request.url)
  const plan  = searchParams.get('plan')
  const addon = searchParams.get('addon')

  // Resolve item config — plan or add-on purchase
  const itemConfig = plan
    ? PLAN_AMOUNTS[plan]
    : addon
      ? ADDON_AMOUNTS[addon]
      : null

  if (!itemConfig) return new NextResponse('Invalid plan or addon', { status: 400 })

  const itemKey  = plan ?? addon!
  const isAddon  = !!addon

  const merchantId  = process.env.PAYFAST_MERCHANT_ID  || ''
  const merchantKey = process.env.PAYFAST_MERCHANT_KEY || ''
  const passphrase  = process.env.PAYFAST_PASSPHRASE   || ''
  const appUrl      = process.env.NEXT_PUBLIC_APP_URL  || 'https://adminos.co.za'

  if (!merchantId || !merchantKey || !passphrase) {
    console.error('PayFast credentials missing from environment variables')
    return new NextResponse('Billing configuration error', { status: 500 })
  }

  const tenantId = user.user_metadata?.tenant_id as string

  // Mirembe unified hub validates the ITN, books central Finance under the adminos
  // stream, and forwards it back to /api/billing/webhook here. Return/cancel stay on adminos.
  const appUrlClean = appUrl.replace(/\/$/, '')
  const HUB_NOTIFY = process.env.PAYFAST_HUB_NOTIFY_URL || 'https://jarvis.mirembemuse.co.za/api/payfast/notify'

  const params: Record<string, string> = {
    merchant_id:     merchantId,
    merchant_key:    merchantKey,
    return_url:      `${appUrlClean}/dashboard/settings/billing?success=1`,
    cancel_url:      `${appUrlClean}/dashboard/settings/billing?cancelled=1`,
    notify_url:      HUB_NOTIFY,
    name_first:      (user.user_metadata?.full_name || user.email || '').split(' ')[0],
    name_last:       (user.user_metadata?.full_name || '').split(' ').slice(1).join(' ') || 'User',
    email_address:   user.email || '',
    m_payment_id:    `mm.adminos.subscription.${tenantId}`,
    amount:          itemConfig.amount,
    item_name:       itemConfig.name,
    item_description: isAddon
      ? `AdminOS ${addon} add-on — monthly subscription`
      : `AdminOS ${plan} plan — monthly subscription`,
    subscription_type: '1',
    billing_date:    new Date().toISOString().split('T')[0],
    recurring_amount: itemConfig.amount,
    frequency:       '3', // monthly
    cycles:          '0', // indefinite
    custom_str1:     tenantId,
    custom_str2:     plan  ?? '',
    custom_str3:     addon ?? '',
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
