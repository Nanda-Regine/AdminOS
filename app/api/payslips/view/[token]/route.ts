import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { renderPayslip, PAYSLIP_SELECT, HTML_HEADERS } from '@/lib/payroll/renderPayslip'
import { checkRateLimit } from '@/lib/security/rateLimit'
import { getClientIp } from '@/lib/security/audit'

export const runtime = 'nodejs'

// GET /api/payslips/view/[token] — PUBLIC (middleware PUBLIC_PATTERNS).
//
// The link payslip distribution sends each employee. Staff don't need an
// AdminOS login (live, none have one): the token is 32 random bytes, unique,
// expires (set by the payroll run), and opens exactly one payslip. ID and bank
// account numbers are masked because the link travels over WhatsApp and can
// be forwarded. Every failure looks the same — no hint whether a token existed.
const GONE = () => new NextResponse(
  '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<title>Payslip link expired</title><body style="font-family:system-ui;padding:32px;max-width:480px;margin:auto">' +
  '<h1 style="font-size:18px">This payslip link has expired or is not valid.</h1>' +
  '<p>Please ask your employer to send it again.</p></body>',
  { status: 404, headers: HTML_HEADERS },
)

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!/^[a-f0-9]{64}$/.test(token)) return GONE()

  const { success } = await checkRateLimit('api', `payslip-view:${getClientIp(request) ?? 'unknown'}`)
  if (!success) return new NextResponse('Too many requests', { status: 429 })

  const { data: payslip } = await supabaseAdmin
    .from('payslips')
    .select(PAYSLIP_SELECT)
    .eq('view_token', token)
    .gt('view_token_expires_at', new Date().toISOString())
    .is('deleted_at', null)
    .maybeSingle()
  if (!payslip) return GONE()

  const html = await renderPayslip(payslip as unknown as Record<string, unknown>, { masked: true })
  return new NextResponse(html, { headers: HTML_HEADERS })
}
