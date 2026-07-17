import 'react-native-url-polyfill/auto'
import '../global.css'
import { useEffect } from 'react'
import { Stack, router } from 'expo-router'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { useOfflineQueue } from '@/hooks/useOfflineQueue'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import * as Updates from 'expo-updates'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import { warmCache } from '@/lib/cacheWarmer'

SplashScreen.preventAutoHideAsync()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 60 * 24 * 3, // keep cache 3 days (was 1 day)
      retry: 2,
      networkMode: 'offlineFirst',
    },
  },
})

const persister = createAsyncStoragePersister({ storage: AsyncStorage })

async function checkOTA() {
  try {
    const update = await Updates.checkForUpdateAsync()
    if (update.isAvailable) {
      await Updates.fetchUpdateAsync()
      await Updates.reloadAsync()
    }
  } catch {}
}

export default function RootLayout() {
  const { setSession } = useAuthStore()
  usePushNotifications()
  useOfflineQueue()

  useEffect(() => {
    checkOTA()

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      SplashScreen.hideAsync()
      if (!session) {
        router.replace('/(auth)/login')
      } else {
        const r = session.user.app_metadata?.role ?? 'staff'
        const tenantId = session.user.app_metadata?.tenant_id
        if (tenantId) {
          warmCache(queryClient, tenantId)
        }
        router.replace(r === 'owner' || r === 'manager' ? '/(owner)' : '/(my-admin)')
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (!session) router.replace('/(auth)/login')
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister }}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </PersistQueryClientProvider>
  )
}
