/**
 * Deterministic avatar background colour from an id — same person always
 * gets the same colour, spread evenly across the palette. Was copy-pasted
 * verbatim in ContactsTable, contacts/[id] and staff/[id]; kept here so a
 * future palette change doesn't have to be made in three places in sync.
 */
const AVATAR_COLORS = ['#6366F1', '#8B5CF6', '#EC4899', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#14B8A6']

export function avatarColor(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}
