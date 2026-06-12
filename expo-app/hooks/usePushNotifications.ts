import { useEffect, useRef } from 'react'
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import { Platform } from 'react-native'
import { router } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

export function usePushNotifications() {
  const { user, tenantId } = useAuthStore()
  const notificationListener = useRef<Notifications.EventSubscription>()
  const responseListener = useRef<Notifications.EventSubscription>()

  useEffect(() => {
    if (!user) return
    registerForPushNotifications()

    notificationListener.current = Notifications.addNotificationReceivedListener(() => {})

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as Record<string, string>
      if (data?.route) router.push(data.route as any)
    })

    return () => {
      notificationListener.current?.remove()
      responseListener.current?.remove()
    }
  }, [user?.id])

  async function registerForPushNotifications() {
    if (!Device.isDevice) return

    const { status: existing } = await Notifications.getPermissionsAsync()
    let finalStatus = existing
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync()
      finalStatus = status
    }
    if (finalStatus !== 'granted') return

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'AdminOS',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#6366F1',
      })
    }

    const token = (await Notifications.getExpoPushTokenAsync()).data

    await supabase.from('push_tokens').upsert({
      user_id: user!.id,
      tenant_id: tenantId,
      token,
      platform: Platform.OS,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,platform' })
  }
}
