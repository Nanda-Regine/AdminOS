import { create } from 'zustand'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

type Role = 'owner' | 'manager' | 'staff' | null

interface AuthState {
  session: Session | null
  user: User | null
  role: Role
  tenantId: string | null
  staffId: string | null
  setSession: (session: Session | null) => void
  clear: () => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  role: null,
  tenantId: null,
  staffId: null,

  setSession: (session) => {
    if (!session) return set({ session: null, user: null, role: null, tenantId: null, staffId: null })

    // tenant_id and role are security claims and live in app_metadata (service-
    // role writable only) since Phase 0 — user_metadata no longer holds them,
    // so reading from there left tenantId null and every query disabled.
    const meta = session.user.app_metadata as Record<string, string | undefined>
    const tenantId = meta.tenant_id ?? null
    const sameUser = get().user?.id === session.user.id
    set({
      session,
      user: session.user,
      role: (meta.role as Role) ?? 'staff',
      tenantId,
      staffId: sameUser ? get().staffId : null,
    })

    // No code path ever writes staff_id into the JWT, so resolve the caller's
    // staff row from staff.user_id (unique per tenant). Token refreshes re-fire
    // setSession, so skip the lookup once it's known for this user.
    if (!tenantId || (sameUser && get().staffId)) return
    supabase
      .from('staff')
      .select('id')
      .eq('user_id', session.user.id)
      .eq('tenant_id', tenantId)
      .maybeSingle()
      .then(({ data }) => {
        if (get().user?.id === session.user.id) set({ staffId: data?.id ?? null })
      })
  },

  clear: () => set({ session: null, user: null, role: null, tenantId: null, staffId: null }),
}))
