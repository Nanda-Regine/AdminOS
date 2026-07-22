import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
// Same-origin proxy so the feedback widget never exposes the Jarvis domain.
export async function POST(req: NextRequest) {
  const body = await req.text().catch(() => '')
  try {
    const res = await fetch('https://jarvis.mirembemuse.co.za/api/engineering/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal: AbortSignal.timeout(12000) })
    return new NextResponse(await res.text().catch(() => '{}'), { status: res.status, headers: { 'Content-Type': 'application/json' } })
  } catch { return NextResponse.json({ error: 'unavailable' }, { status: 502 }) }
}
