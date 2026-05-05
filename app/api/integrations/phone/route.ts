import { NextRequest, NextResponse } from 'next/server'
import { validatePhone } from '@/lib/integrations/phone'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const body = await request.json() as { phone?: string }
  if (!body.phone?.trim()) {
    return NextResponse.json({ error: 'phone required' }, { status: 400 })
  }
  const result = validatePhone(body.phone.trim())
  return NextResponse.json(result)
}
