import { Tabs } from 'expo-router'
import { Text } from 'react-native'

function Icon({ emoji }: { emoji: string }) {
  return <Text className="text-lg">{emoji}</Text>
}

export default function OwnerLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0A0F2C',
          borderTopColor: 'rgba(255,255,255,0.08)',
          paddingBottom: 4,
        },
        tabBarActiveTintColor: '#6366F1',
        tabBarInactiveTintColor: '#6B7280',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="index"    options={{ title: 'Dashboard', tabBarIcon: ({ focused }) => <Icon emoji={focused ? '📊' : '📉'} /> }} />
      <Tabs.Screen name="inbox"    options={{ title: 'Inbox',     tabBarIcon: () => <Icon emoji="💬" /> }} />
      <Tabs.Screen name="langa"    options={{ title: 'Langa',     tabBarIcon: () => <Icon emoji="🧠" /> }} />
      <Tabs.Screen name="invoices" options={{ title: 'Invoices',  tabBarIcon: () => <Icon emoji="🧾" /> }} />
    </Tabs>
  )
}
