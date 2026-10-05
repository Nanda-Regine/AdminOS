/**
 * Who may see an announcement. audience 'managers' and 'specific' were stored
 * but never enforced — every member saw "managers only" posts.
 *
 * Pure, no imports: used by /api/announcements and the announcements page.
 */
export interface Viewer {
  userId: string
  staffId: string | null
  permissions: readonly string[]
  isSuperAdmin: boolean
}

export interface AnnouncementLike {
  audience: string | null
  audience_ids?: string[] | null
  expires_at?: string | null
}

const MANAGER_PERMISSIONS = ['manage_staff', 'approve_leave', 'send_broadcasts']

export function canSeeAnnouncement(a: AnnouncementLike, v: Viewer, now = Date.now()): boolean {
  if (a.expires_at && new Date(a.expires_at).getTime() < now) return false
  if (v.isSuperAdmin) return true
  // Whoever can publish announcements can see all of them (to manage them).
  if (v.permissions.includes('send_broadcasts')) return true
  switch (a.audience ?? 'all') {
    case 'all':
      return true
    case 'managers':
      return MANAGER_PERMISSIONS.some((p) => v.permissions.includes(p))
    case 'specific': {
      // audience_ids may hold staff ids or auth user ids — accept either.
      const ids = a.audience_ids ?? []
      return ids.includes(v.userId) || (v.staffId != null && ids.includes(v.staffId))
    }
    default:
      return false
  }
}
