import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/security/rateLimit'
import { getClientIp } from '@/lib/security/audit'
export const dynamic = 'force-dynamic'

// @public — same-origin proxy so the feedback widget (public/mm-feedback.js,
// loaded site-wide, signed-out visitors included) never exposes the Jarvis
// domain. Session 20: it forwarded ANY body of ANY size from anyone — an open
// relay into Jarvis. Now: JSON objects only, ≤ 20 KB, rate limited per IP.
const MAX_BYTES = 20_000

export async function POST(req: NextRequest) {
  const ip = getClientIp(req) ?? 'unknown'
  const { success } = await checkRateLimit('onboarding', `feedback:${ip}`)
  if (!success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const body = await req.text().catch(() => '')
  if (!body || body.length > MAX_BYTES) return NextResponse.json({ error: 'Invalid feedback' }, { status: 400 })
  try {
    const parsed: unknown = JSON.parse(body)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object')
  } catch {
    return NextResponse.json({ error: 'Invalid feedback' }, { status: 400 })
  }

  try {
    const res = await fetch('https://jarvis.mirembemuse.co.za/api/engineering/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal: AbortSignal.timeout(12000) })
    return new NextResponse(await res.text().catch(() => '{}'), { status: res.status, headers: { 'Content-Type': 'application/json' } })
  } catch { return NextResponse.json({ error: 'unavailable' }, { status: 502 }) }
}
