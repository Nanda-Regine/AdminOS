import type { ColorValue } from 'react-native'
import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useMe } from '@/hooks/useMe'
import { can, isManager } from '@/store/session'
import { C } from '@/components/ui'

type IconName = keyof typeof Ionicons.glyphMap

function icon(name: IconName, active: IconName) {
  return ({ focused, color }: { focused: boolean; color: ColorValue }) => (
    <Ionicons name={focused ? active : name} size={22} color={color as string} />
  )
}

/**
 * Two layouts from one set of screens, chosen by permission (never by a role
 * name — tenants customise roles):
 *   employee → Home · Clock · Leave · Pay · More
 *   manager  → Home · Approvals · Inbox · More   (own clock/leave/pay under More)
 * Hidden tabs keep their routes, so a push can still open /leave for anyone.
 */
export default function TabsLayout() {
  const insets = useSafeAreaInsets()
  const { data: me } = useMe()
  const manager = isManager(me)
  const linked = Boolean(me?.staff)
  const approvals = can(me, 'approve_leave') || can(me, 'view_financials')

  const show = (visible: boolean) => (visible ? undefined : null)

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.brand,
        tabBarInactiveTintColor: C.dim,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarStyle: {
          backgroundColor: C.bg,
          borderTopColor: 'rgba(255,255,255,0.08)',
          height: 58 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 6),
          paddingTop: 6,
        },
        sceneStyle: { backgroundColor: C.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('home-outline', 'home') }} />
      <Tabs.Screen name="approvals" options={{ title: 'Approvals', href: show(manager && approvals), tabBarIcon: icon('checkmark-done-outline', 'checkmark-done') }} />
      <Tabs.Screen name="inbox" options={{ title: 'Inbox', href: show(can(me, 'view_communications')), tabBarIcon: icon('chatbubbles-outline', 'chatbubbles') }} />
      <Tabs.Screen name="clock" options={{ title: 'Clock', href: show(linked && !manager), tabBarIcon: icon('time-outline', 'time') }} />
      <Tabs.Screen name="leave" options={{ title: 'Leave', href: show(linked && !manager), tabBarIcon: icon('sunny-outline', 'sunny') }} />
      <Tabs.Screen name="pay" options={{ title: 'Pay', href: show(linked && !manager), tabBarIcon: icon('wallet-outline', 'wallet') }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: icon('grid-outline', 'grid') }} />
    </Tabs>
  )
}
