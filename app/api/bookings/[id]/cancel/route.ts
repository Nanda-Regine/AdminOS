import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { withRoute, unwrap } from '@/lib/api/withRoute'

// POST /api/bookings/[id]/cancel — the Cancel button (a form post) on Bookings.
// Session 20: no status check (a completed or already-cancelled booking could
// be "cancelled" again) and no audit. Only pending/confirmed bookings cancel;
// anything else just returns to the page unchanged.
export const POST = withRoute({
  action: 'bookings.write',
  audit: 'booking.cancelled',
  resourceType: 'booking',
}, async ({ request, ctx, params }) => {
  unwrap(await supabaseAdmin
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', params.id)
    .eq('tenant_id', ctx.tenantId)
    .is('deleted_at', null)
    .in('status', ['pending', 'confirmed']))
  return NextResponse.redirect(new URL('/dashboard/bookings', new URL(request.url).origin), 303)
})
