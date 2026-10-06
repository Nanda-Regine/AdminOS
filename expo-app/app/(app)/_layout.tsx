import { Stack } from 'expo-router'
import { useSession } from '@/store/session'
import { C } from '@/components/ui'

export default function AppLayout() {
  const status = useSession((s) => s.status)
  // The root AuthGate redirects; render nothing meanwhile so no screen fires
  // API calls without a session.
  if (status !== 'signedIn') return null
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg }, animation: 'slide_from_right' }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="leave-request" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="expense-new" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="delete-account" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
    </Stack>
  )
}
