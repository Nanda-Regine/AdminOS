import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Me } from '@/lib/types'
import { useSession } from '@/store/session'

/** Identity, permissions and the "today" feed. Never persisted to disk. */
export function useMe() {
  const userId = useSession((s) => s.session?.user.id)
  return useQuery({
    queryKey: ['me', userId],
    queryFn: () => api.get<Me>('/api/me'),
    enabled: Boolean(userId),
    staleTime: 30_000,
  })
}
