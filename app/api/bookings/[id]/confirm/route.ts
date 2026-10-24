import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { inngest } from '@/inngest/client'
import { withRoute, unwrap } from '@/lib/api/withRoute'

// POST /api/bookings/[id]/confirm — the Confirm button (a form post).
// Session 20: every press re-confirmed and re-fired booking.confirmed, so the
// customer could get the 24h reminder several times; a cancelled booking could
// be confirmed back. Only a pending booking confirms, and only then is the
// reminder scheduled.
export const POST = withRoute({
  action: 'bookings.write',
  audit: 'booking.confirmed',
  resourceType: 'booking',
}, async ({ request, ctx, params }) => {
  const confirmed = unwrap(await supabaseAdmin
    .from('bookings')
    .update({ status: 'confirmed' })
    .eq('id', params.id)
    .eq('tenant_id', ctx.tenantId)
    .is('deleted_at', null)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle())
  if (confirmed) {
    await inngest.send({ name: 'adminos/booking.confirmed', data: { tenant_id: ctx.tenantId, booking_id: params.id } })
  }
  return NextResponse.redirect(new URL('/dashboard/bookings', new URL(request.url).origin), 303)
})
