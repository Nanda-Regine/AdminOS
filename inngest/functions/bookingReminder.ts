import { inngest } from '@/inngest/client'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sendWhatsApp } from '@/lib/whatsapp/send'
import { notifyTenant } from '@/lib/notifications/notify'
import { getTenantAutonomy } from '@/lib/autonomy/config'
import { resolveTier } from '@/lib/autonomy/tiers'

// Listens for booking confirmations and sends a WhatsApp reminder 24h before start
export const bookingReminderFunction = inngest.createFunction(
  { id: 'booking-reminder-24h', retries: 2, triggers: [{ event: 'adminos/booking.confirmed' }] },
  async ({ event, step }: any) => {
    const { tenant_id, booking_id } = event.data as {
      tenant_id: string
      booking_id: string
    }

    // Step 1: Fetch booking details to determine when to wake up
    const booking = await step.run('fetch-booking', async () => {
      const { data, error } = await supabaseAdmin
        .from('bookings')
        .select('id, tenant_id, contact_id, service_id, start_at, status, notes')
        .eq('id', booking_id)
        .eq('tenant_id', tenant_id)
        .maybeSingle()

      if (error) throw new Error(`Booking fetch failed: ${error.message}`)
      if (!data) throw new Error(`Booking ${booking_id} not found`)
      return data
    })

    // Only proceed for confirmed bookings
    if (booking.status === 'cancelled') {
      return { booking_id, skipped: true, reason: 'cancelled' }
    }

    // Calculate sleep duration: wake up 24h before start_at
    const startAt = new Date(booking.start_at).getTime()
    const reminderAt = startAt - 24 * 60 * 60 * 1000
    const now = Date.now()
    const sleepMs = reminderAt - now

    if (sleepMs > 0) {
      await step.sleep('wait-until-reminder-time', sleepMs)
    }

    // Step 2: Re-fetch booking to confirm it's still active (not cancelled while sleeping)
    const freshBooking = await step.run('re-fetch-booking', async () => {
      const { data } = await supabaseAdmin
        .from('bookings')
        .select('id, contact_id, service_id, start_at, status')
        .eq('id', booking_id)
        .maybeSingle()
      return data
    })

    if (!freshBooking || freshBooking.status === 'cancelled') {
      return { booking_id, skipped: true, reason: 'cancelled_before_reminder' }
    }

    // Step 3: Fetch contact and service details
    const [contact, service] = await step.run('fetch-contact-and-service', async () => {
      const [contactResult, serviceResult] = await Promise.all([
        supabaseAdmin
          .from('contacts')
          .select('id, full_name, phone, whatsapp_number')
          .eq('id', freshBooking.contact_id)
          .maybeSingle(),
        supabaseAdmin
          .from('services')
          .select('id, name, duration_minutes, price')
          .eq('id', freshBooking.service_id)
          .maybeSingle(),
      ])
      return [contactResult.data, serviceResult.data] as const
    })

    if (!contact?.phone && !contact?.whatsapp_number) {
      return { booking_id, skipped: true, reason: 'no_phone_number' }
    }

    const phone = (contact.whatsapp_number || contact.phone) as string
    const startDate = new Date(freshBooking.start_at)
    const dateStr = startDate.toLocaleDateString('en-ZA', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
    const timeStr = startDate.toLocaleTimeString('en-ZA', {
      hour: '2-digit',
      minute: '2-digit',
    })

    const serviceName = service?.name ?? 'your appointment'
    const message = `Hi ${contact.full_name ?? 'there'} 👋 Just a reminder that you have *${serviceName}* tomorrow, ${dateStr} at ${timeStr}. See you then! Reply CANCEL to cancel.`

    // Autonomy gate: sending a reminder to the CUSTOMER is a proactive action, so
    // it honours the tenant's ops/booking_reminder tier. Default is 'A' — sends
    // automatically, preserving today's behaviour. 'B' drafts it for the owner;
    // 'C' just surfaces that the booking is coming up. Owner-facing notifications
    // are always allowed.
    const tier = await step.run('resolve-autonomy', async () => {
      const rows = await getTenantAutonomy(tenant_id)
      return resolveTier(rows, 'ops', 'booking_reminder')
    })

    if (tier !== 'A') {
      await step.run('surface-to-owner', async () => {
        const who = contact.full_name ?? 'A customer'
        await notifyTenant(tenant_id, {
          type: 'booking.reminder',
          title: tier === 'B' ? 'Booking reminder ready to send' : 'Booking coming up',
          body: tier === 'B'
            ? `Reminder drafted for ${who}'s ${serviceName} tomorrow (${dateStr} ${timeStr}). Auto-send is off — send it when you're ready.`
            : `${who} has ${serviceName} tomorrow (${dateStr} ${timeStr}).`,
          actionUrl: '/dashboard/bookings',
          dedupeKey: `booking-reminder-${booking_id}`,
          dedupeHours: 26,
          whatsapp: tier === 'B',
        })
      })
      return { booking_id, sent: false, held_by_autonomy: tier, to: phone, booking_start: freshBooking.start_at }
    }

    // Step 4: Send the WhatsApp reminder to the customer (tier A)
    await step.run('send-whatsapp-reminder', async () => {
      await sendWhatsApp({ to: phone, message })
    })

    return {
      booking_id,
      sent: true,
      to: phone,
      booking_start: freshBooking.start_at,
    }
  }
)
