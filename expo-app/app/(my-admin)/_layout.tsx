import { Tabs } from 'expo-router'
import { Text } from 'react-native'

function Icon({ emoji }: { emoji: string }) {
  return <Text className="text-lg">{emoji}</Text>
}

export default function MyAdminLayout() {
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
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="index"         options={{ title: 'Home',    tabBarIcon: () => <Icon emoji="🏠" /> }} />
      <Tabs.Screen name="clock"         options={{ title: 'Clock',   tabBarIcon: () => <Icon emoji="⏱️" /> }} />
      <Tabs.Screen name="tasks"         options={{ title: 'Tasks',   tabBarIcon: () => <Icon emoji="✅" /> }} />
      <Tabs.Screen name="leave"         options={{ title: 'Leave',   tabBarIcon: () => <Icon emoji="🌴" /> }} />
      <Tabs.Screen name="pay"           options={{ title: 'Pay',     tabBarIcon: () => <Icon emoji="💰" /> }} />
      <Tabs.Screen name="expenses"      options={{ title: 'Expense', tabBarIcon: () => <Icon emoji="🧾" /> }} />
      <Tabs.Screen name="documents"     options={{ title: 'Docs',    tabBarIcon: () => <Icon emoji="📄" /> }} />
      <Tabs.Screen name="training"      options={{ title: 'Train',   tabBarIcon: () => <Icon emoji="🎓" /> }} />
      <Tabs.Screen name="handbook"      options={{ title: 'SOPs',    tabBarIcon: () => <Icon emoji="📋" /> }} />
      <Tabs.Screen name="announcements" options={{ title: 'News',    tabBarIcon: () => <Icon emoji="📣" /> }} />
      <Tabs.Screen name="team"          options={{ title: 'Team',    tabBarIcon: () => <Icon emoji="👥" /> }} />
    </Tabs>
  )
}
