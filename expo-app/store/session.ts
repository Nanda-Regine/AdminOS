import { create } from 'zustand'
import type { Session } from '@supabase/supabase-js'
import * as Notifications from 'expo-notifications'
import { supabase } from '@/lib/supabase'
import { api, setUnauthorizedHandler } from '@/lib/api'
import { clearQueryCache } from '@/lib/queryClient'
import { clearOfflineQueue } from '@/lib/offlineQueue'
import type { Me, Permission } from '@/lib/types'
import AsyncStorage from '@react-native-async-storage/async-storage'

const CACHE_OWNER = 'adminos-cache-owner'

/**
 * The on-disk query cache belongs to one login. Sign-out clears it, but if a
 * different user's session ever appears without one (reinstall restoring a
 * backup, a crash mid sign-out), wipe the cache before anything renders it.
 */
async function claimCache(userId: string) {
  const owner = await AsyncStorage.getItem(CACHE_OWNER).catch(() => null)
  if (owner && owner !== userId) await clearQueryCache()
  if (owner !== userId) await AsyncStorage.setItem(CACHE_OWNER, userId).catch(() => undefined)
}

type Status = 'loading' | 'signedOut' | 'signedIn'

interface SessionState {
  status: Status
  session: Session | null
  /** Last push token registered for this login (revoked on sign-out). */
  pushToken: string | null
  setSession(session: Session | null): void
  setPushToken(token: string | null): void
  signOut(): Promise<void>
}

export const useSession = create<SessionState>((set, get) => ({
  status: 'loading',
  session: null,
  pushToken: null,

  setSession(session) {
    set({ session, status: session ? 'signedIn' : 'signedOut' })
    if (session) void claimCache(session.user.id)
  },

  setPushToken(token) {
    set({ pushToken: token })
  },

  /**
   * Sign-out leaves nothing behind for the next person to hold the phone:
   * this device stops receiving the user's pushes, cached responses are
   * wiped from memory and disk, unsent offline actions are discarded, and
   * the keystore session is removed.
   */
  async signOut() {
    const { pushToken, session } = get()
    if (pushToken && session) {
      await api.del('/api/push/register', { token: pushToken }).catch(() => undefined)
    }
    await Notifications.setBadgeCountAsync(0).catch(() => undefined)
    await supabase.auth.signOut().catch(() => undefined)
    await clearQueryCache()
    await clearOfflineQueue()
    set({ session: null, status: 'signedOut', pushToken: null })
  },
}))

// A 401 from the API means the session is gone server-side (expired refresh
// token, banned after account deletion): end it locally too.
setUnauthorizedHandler(() => {
  if (useSession.getState().status === 'signedIn') void useSession.getState().signOut()
})

export function can(me: Me | undefined | null, permission: Permission): boolean {
  if (!me) return false
  return me.permissions.includes('*') || me.permissions.includes(permission)
}

/** Owners, admins and managers get the decision-centred layout. */
export function isManager(me: Me | undefined | null): boolean {
  return can(me, 'approve_leave') || can(me, 'view_financials') || can(me, 'manage_staff') || can(me, 'view_communications')
}
