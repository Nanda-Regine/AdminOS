import { NextRequest, NextResponse } from 'next/server'
import { getWeather } from '@/lib/integrations/weather'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const city = request.nextUrl.searchParams.get('city') ?? 'johannesburg'
  const data  = await getWeather(city)
  return NextResponse.json(data)
}
