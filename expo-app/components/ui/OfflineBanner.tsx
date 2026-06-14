import { View, Text, Animated } from 'react-native'
import { useEffect, useRef, useState } from 'react'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'

function formatAge(date: Date | null): string {
  if (!date) return ''
  const mins = Math.floor((Date.now() - date.getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function OfflineBanner() {
  const { isOffline, lastOnlineAt } = useNetworkStatus()
  const opacity = useRef(new Animated.Value(0)).current
  // Keep rendered during fade-out so animation completes before unmounting
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    if (isOffline) {
      setMounted(true)
      Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }).start()
    } else {
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        setMounted(false)
      })
    }
  }, [isOffline])

  if (!mounted) return null

  return (
    <Animated.View style={{ opacity }}>
      <View className="flex-row items-center justify-center gap-1.5 py-1.5 px-4 bg-amber-500/20 border-b border-amber-500/30">
        <View className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        <Text className="text-amber-300 text-xs font-medium">
          {'No internet · Showing cached data'}
          {lastOnlineAt ? `  · Last synced ${formatAge(lastOnlineAt)}` : ''}
        </Text>
      </View>
    </Animated.View>
  )
}
