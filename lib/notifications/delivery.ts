/**
 * Notification delivery policy — PURE + unit-tested (no imports beyond the quiet
 * -hours helper), so it stays laptop-safe.
 *
 * Two owner controls decide whether the WhatsApp MIRROR of a notification goes
 * out. The in-app bell is always written — it's the free, reliable channel.
 *   1. Per-type preference  (tenants.settings.notify[type].whatsapp) — default on.
 *   2. Quiet hours          (tenants.settings.quiet_hours {start,end} minutes) —
 *      during the window, WhatsApp is suppressed; the bell still shows it.
 */

/** Owner-facing notification categories shown in the preferences UI. */
export const NOTIFY_CATEGORIES: { key: string; label: string; description: string }[] = [
  { key: 'approval.needed',    label: 'Approvals waiting',           description: 'Leave & expense claims needing your sign-off.' },
  { key: 'payment.received',   label: 'Payments received',           description: 'When a customer pays you.' },
  { key: 'recovery.escalation',label: 'Collections needing review',  description: 'Overdue invoices past the gentle-reminder stage.' },
  { key: 'recovery.sent',      label: 'Reminders sent',              description: 'Confirmation when payment reminders go out.' },
  { key: 'booking.reminder',   label: 'Booking reminders',           description: 'Upcoming-booking alerts held or drafted for you.' },
]

type Settings = Record<string, unknown> | null | undefined

/** SAST (UTC+2, no DST) minutes-since-midnight for a given instant. */
export function nowMinutesSAST(now: Date = new Date()): number {
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes()
  return (utcMinutes + 120) % 1440
}

export interface QuietWindow { start: number; end: number }

/** Read a valid quiet-hours window from tenant settings, or null. */
export function parseQuietHours(settings: Settings): QuietWindow | null {
  const q = (settings as { quiet_hours?: { start?: unknown; end?: unknown } } | null | undefined)?.quiet_hours
  if (!q) return null
  const { start, end } = q
  if (typeof start !== 'number' || typeof end !== 'number') return null
  if (start < 0 || start > 1439 || end < 0 || end > 1439) return null
  if (start === end) return null // empty/disabled window
  return { start, end }
}

/** Minutes-in-window check; handles overnight wrap (e.g. 21:00 → 06:00). */
function withinWindow(nowMinutes: number, { start, end }: QuietWindow): boolean {
  return start <= end ? (nowMinutes >= start && nowMinutes < end) : (nowMinutes >= start || nowMinutes < end)
}

/** True when WhatsApp should be held right now for quiet hours. */
export function isQuietNow(settings: Settings, now: Date = new Date()): boolean {
  const window = parseQuietHours(settings)
  if (!window) return false
  return withinWindow(nowMinutesSAST(now), window)
}

/**
 * Is a channel enabled for a notification type? Defaults to true (opt-out model)
 * so a tenant who never touches preferences keeps getting everything.
 */
export function channelEnabled(settings: Settings, type: string, channel: 'in_app' | 'whatsapp'): boolean {
  const notify = (settings as { notify?: Record<string, { in_app?: boolean; whatsapp?: boolean }> } | null | undefined)?.notify
  const pref = notify?.[type]
  if (!pref) return true
  return pref[channel] !== false
}

/** The one question the spine asks: may this notification's WhatsApp mirror go out now? */
export function whatsappAllowed(settings: Settings, type: string, now: Date = new Date()): boolean {
  return channelEnabled(settings, type, 'whatsapp') && !isQuietNow(settings, now)
}
