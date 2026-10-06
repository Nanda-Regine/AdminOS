import 'react-native-url-polyfill/auto'
import '../global.css'
import { useEffect } from 'react'
import { Text, View } from 'react-native'
import { Stack, router, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import * as Updates from 'expo-updates'
import NetInfo from '@react-native-community/netinfo'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { queryClient, persister, shouldPersist } from '@/lib/queryClient'
import { flushClockQueue } from '@/lib/offlineQueue'
import { CONFIG_ERROR } from '@/lib/config'
import { useSession } from '@/store/session'
import { usePushRegistration } from '@/hooks/usePushRegistration'
import { useAppLock } from '@/hooks/useAppLock'
import { Button, C } from '@/components/ui'

SplashScreen.preventAutoHideAsync().catch(() => undefined)

/** Apply a downloaded OTA update on the next cold start — never mid-task. */
async function fetchUpdateQuietly() {
  if (__DEV__ || !Updates.isEnabled) return
  try {
    const r = await Updates.checkForUpdateAsync()
    if (r.isAvailable) await Updates.fetchUpdateAsync()
  } catch {
    /* offline or no channel — try next launch */
  }
}

function AuthGate() {
  const status = useSession((s) => s.status)
  const segments = useSegments()

  useEffect(() => {
    if (status === 'loading') return
    const inAuth = segments[0] === '(auth)'
    if (status === 'signedOut' && !inAuth) router.replace('/login')
    if (status === 'signedIn' && inAuth) router.replace('/')
  }, [status, segments])

  return null
}

function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  return (
    <View className="absolute inset-0 bg-navy-900 items-center justify-center px-8 gap-4" accessibilityViewIsModal>
      <Ionicons name="lock-closed" size={40} color={C.brand} />
      <Text className="text-white text-xl font-bold">AdminOS is locked</Text>
      <Text className="text-slate-400 text-center">Unlock with your fingerprint, face or device PIN.</Text>
      <View className="self-stretch mt-2"><Button label="Unlock" icon="finger-print" onPress={onUnlock} /></View>
    </View>
  )
}

export default function RootLayout() {
  const status = useSession((s) => s.status)
  const setSession = useSession((s) => s.setSession)
  const { locked, unlock } = useAppLock(status === 'signedIn')
  usePushRegistration()

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data }) => setSession(data.session))
      .catch(() => setSession(null))
      .finally(() => SplashScreen.hideAsync().catch(() => undefined))

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    fetchUpdateQuietly()
    return () => subscription.unsubscribe()
  }, [setSession])

  // Send offline clock-ins whenever we come back online (and on launch).
  useEffect(() => {
    if (status !== 'signedIn') return
    flushClockQueue().then((r) => { if (r.sent) void queryClient.invalidateQueries({ queryKey: ['clock'] }) })
    return NetInfo.addEventListener((s) => {
      if (s.isConnected && s.isInternetReachable !== false) {
        flushClockQueue().then((r) => { if (r.sent) void queryClient.invalidateQueries({ queryKey: ['clock'] }) })
      }
    })
  }, [status])

  if (CONFIG_ERROR) {
    return (
      <View className="flex-1 bg-navy-900 items-center justify-center px-8">
        <Text className="text-white text-lg font-bold mb-2">AdminOS can’t start</Text>
        <Text className="text-slate-400 text-center">{CONFIG_ERROR}</Text>
      </View>
    )
  }

  return (
    <SafeAreaProvider>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister,
          maxAge: 1000 * 60 * 60 * 24 * 3,
          dehydrateOptions: { shouldDehydrateQuery: shouldPersist },
        }}
      >
        <StatusBar style="light" />
        <AuthGate />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg }, animation: 'slide_from_right' }} />
        {locked && <LockScreen onUnlock={unlock} />}
      </PersistQueryClientProvider>
    </SafeAreaProvider>
  )
}
