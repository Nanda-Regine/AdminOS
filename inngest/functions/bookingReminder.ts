import { inngest } from '@/inngest/client'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sendWhatsApp } from '@/lib/whatsapp/send'

// Listens for booking confirmations and sends a WhatsApp reminder 24h before start
export const bookingReminderFunction = inngest.createFunction(
  { id: 'booking-reminder-24h', retries: 2 },
  { event: 'adminos/booking.confirmed' },
  async ({ event, step }) => {
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

    // Step 4: Send the WhatsApp reminder
    await step.run('send-whatsapp-reminder', async () => {
      const serviceName = service?.name ?? 'your appointment'
      const message = `Hi ${contact.full_name ?? 'there'} 👋 Just a reminder that you have *${serviceName}* tomorrow, ${dateStr} at ${timeStr}. See you then! Reply CANCEL to cancel.`

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
