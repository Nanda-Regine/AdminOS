import { useEffect } from 'react'
import { Platform } from 'react-native'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import { router } from 'expo-router'
import { api } from '@/lib/api'
import { STORE, EAS_PROJECT_ID } from '@/lib/config'
import { useSession } from '@/store/session'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

/** Screens a push may open. Anything else in a payload is ignored. */
const ROUTES = new Set(['/', '/leave', '/tasks', '/approvals', '/expenses', '/pay', '/notifications', '/announcements', '/handbook', '/inbox', '/clock'])

function openFromNotification(data: unknown) {
  const route = (data as { route?: unknown } | null)?.route
  if (typeof route === 'string' && ROUTES.has(route)) router.push(route as never)
  else router.push('/notifications')
}

/**
 * Registers this device for push once signed in, and routes notification
 * taps. Skipped on the Huawei build (no Google Play Services → no FCM) and on
 * emulators; both fall back to the in-app notification list. Permission is
 * asked once; a "no" is respected, not re-prompted.
 */
export function usePushRegistration() {
  const status = useSession((s) => s.status)
  const setPushToken = useSession((s) => s.setPushToken)

  useEffect(() => {
    if (status !== 'signedIn') return
    let cancelled = false

    ;(async () => {
      if (STORE === 'huawei' || !Device.isDevice || !EAS_PROJECT_ID) return
      try {
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'AdminOS',
            importance: Notifications.AndroidImportance.HIGH,
            lightColor: '#6366F1',
          })
        }
        const current = await Notifications.getPermissionsAsync()
        let granted = current.granted
        if (!granted && current.canAskAgain) granted = (await Notifications.requestPermissionsAsync()).granted
        if (!granted || cancelled) return

        const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: EAS_PROJECT_ID })
        if (cancelled) return
        await api.post('/api/push/register', { token, platform: Platform.OS === 'ios' ? 'ios' : 'android' })
        setPushToken(token)
      } catch (e) {
        // No FCM config in this build, or no network: in-app list still works.
        console.warn('[push] registration skipped', e)
      }
    })()

    return () => { cancelled = true }
  }, [status, setPushToken])

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      openFromNotification(r.notification.request.content.data)
    })
    // App opened from a notification while it was closed.
    Notifications.getLastNotificationResponseAsync().then((r) => {
      if (r) openFromNotification(r.notification.request.content.data)
    }).catch(() => undefined)
    return () => sub.remove()
  }, [])
}
