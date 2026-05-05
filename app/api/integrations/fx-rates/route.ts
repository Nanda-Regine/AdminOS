import { NextRequest, NextResponse } from 'next/server'
import { getFxRates } from '@/lib/integrations/fx-rates'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const base = request.nextUrl.searchParams.get('base') ?? 'ZAR'
  const data  = await getFxRates(base.toUpperCase())
  return NextResponse.json(data)
}
