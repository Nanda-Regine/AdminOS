import AsyncStorage from '@react-native-async-storage/async-storage'
import { QueryClient, type Query } from '@tanstack/react-query'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { ApiError } from './api'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 1000 * 60 * 60 * 24 * 3,
      networkMode: 'offlineFirst',
      // Don't hammer the server on 4xx (permission, not found) — only retry
      // network blips and 5xx.
      retry: (count, err) => count < 2 && (!(err instanceof ApiError) || err.isNetwork || err.status >= 500),
    },
    mutations: { networkMode: 'online', retry: false },
  },
})

/**
 * Offline cache on disk. AsyncStorage is plain files, so anything that would
 * hurt in the wrong hands stays memory-only: pay, profile, receipts, approvals
 * customer conversations and GPS-tagged clock history are never written to disk. What persists (task
 * list, leave history, handbook, announcements, team names) is what an
 * employee needs during load-shedding and is low-harm.
 */
const NEVER_PERSIST = new Set(['me', 'payslips', 'expenses', 'approvals', 'conversations', 'conversation', 'invoices', 'documents', 'notifications', 'clock'])

export function shouldPersist(query: Query): boolean {
  const root = String(query.queryKey[0])
  return query.state.status === 'success' && !NEVER_PERSIST.has(root)
}

export const persister = createAsyncStoragePersister({ storage: AsyncStorage, key: 'adminos-query-cache' })

/** Sign-out: drop every cached response, in memory and on disk. */
export async function clearQueryCache(): Promise<void> {
  queryClient.clear()
  await AsyncStorage.removeItem('adminos-query-cache').catch(() => undefined)
}
