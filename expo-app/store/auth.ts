import { create } from 'zustand'
import type { Session, User } from '@supabase/supabase-js'

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

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  role: null,
  tenantId: null,
  staffId: null,

  setSession: (session) => {
    if (!session) return set({ session: null, user: null, role: null, tenantId: null, staffId: null })
    const meta = session.user.user_metadata as Record<string, string>
    set({
      session,
      user: session.user,
      role: (meta.role as Role) ?? 'staff',
      tenantId: meta.tenant_id ?? null,
      staffId: meta.staff_id ?? null,
    })
  },

  clear: () => set({ session: null, user: null, role: null, tenantId: null, staffId: null }),
}))
