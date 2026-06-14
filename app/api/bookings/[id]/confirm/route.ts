import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { inngest } from '@/inngest/client'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.user_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  const { id } = await params

  const { data, error } = await supabaseAdmin
    .from('bookings')
    .update({ status: 'confirmed' })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Fire event so bookingReminder function can schedule the 24h reminder
  await inngest.send({
    name: 'adminos/booking.confirmed',
    data: { tenant_id: tenantId, booking_id: id },
  })

  const origin = new URL(_req.url).origin
  return NextResponse.redirect(new URL('/dashboard/bookings', origin))
}
