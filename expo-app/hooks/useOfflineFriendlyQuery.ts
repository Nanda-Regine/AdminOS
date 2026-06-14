import { useQuery, UseQueryOptions, UseQueryResult } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useNetworkStatus } from './useNetworkStatus'

const SYNC_PREFIX = 'query_synced_at:'

type OfflineQueryResult<T> = UseQueryResult<T> & {
  isFromCache: boolean
  lastSyncedAt: Date | null
}

export function useOfflineFriendlyQuery<T>(
  options: UseQueryOptions<T>,
): OfflineQueryResult<T> {
  const { isOffline } = useNetworkStatus()
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null)

  // Stable key — JSON.stringify same array → same string
  const cacheKey = useMemo(
    () => `${SYNC_PREFIX}${JSON.stringify(options.queryKey)}`,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(options.queryKey)],
  )

  const result = useQuery<T>({
    ...options,
    // When offline: never treat cache as stale so React Query won't attempt a network fetch
    staleTime: isOffline ? Infinity : (options.staleTime as number | undefined),
    refetchOnWindowFocus: isOffline ? false : options.refetchOnWindowFocus,
    refetchOnReconnect: options.refetchOnReconnect ?? true,
    networkMode: 'offlineFirst',
  })

  // Track the query's own dataUpdatedAt — only stamp when we're online and data actually refreshed
  const prevUpdatedAtRef = useRef(0)
  useEffect(() => {
    const updatedAt = result.dataUpdatedAt
    if (!isOffline && updatedAt > 0 && updatedAt !== prevUpdatedAtRef.current) {
      prevUpdatedAtRef.current = updatedAt
      const now = new Date()
      setLastSyncedAt(now)
      AsyncStorage.setItem(cacheKey, now.toISOString())
    }
  }, [result.dataUpdatedAt, isOffline, cacheKey])

  // Restore persisted sync timestamp on mount
  useEffect(() => {
    AsyncStorage.getItem(cacheKey).then(raw => {
      if (raw) setLastSyncedAt(new Date(raw))
    })
  }, [cacheKey])

  const isFromCache = isOffline && result.data !== undefined

  return { ...result, isFromCache, lastSyncedAt } as OfflineQueryResult<T>
}
