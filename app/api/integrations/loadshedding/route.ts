import { NextResponse } from 'next/server'
import { getLoadSheddingStatus } from '@/lib/integrations/loadshedding'

export const runtime = 'nodejs'

export async function GET() {
  const data = await getLoadSheddingStatus()
  return NextResponse.json(data)
}
