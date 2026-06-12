import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCoachingCard } from '@/lib/intelligence/coaching'

// GET /api/coaching?action=dismissal.initiate
// Returns the coaching card for a given pre-action trigger, or 404 if none exists
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const url    = new URL(request.url)
  const action = url.searchParams.get('action')

  if (!action) {
    return NextResponse.json({ error: 'action parameter required' }, { status: 400 })
  }

  const card = await getCoachingCard(action)
  if (!card) return new NextResponse(null, { status: 204 })  // No card for this action

  return NextResponse.json(card)
}
