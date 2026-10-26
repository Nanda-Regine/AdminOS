/**
 * Deterministic avatar background colour from an id — same person always
 * gets the same colour, spread evenly across the palette. Was copy-pasted
 * verbatim in ContactsTable, contacts/[id] and staff/[id]; kept here so a
 * future palette change (every shade keeps white initials at >= 4.5:1) doesn't have to be made in three places in sync.
 */
const AVATAR_COLORS = ['#4F46E5', '#7C3AED', '#BE185D', '#0369A1', '#047857', '#B45309', '#B91C1C', '#0F766E']

export function avatarColor(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}
