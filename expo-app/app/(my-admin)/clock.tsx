import { useState } from 'react'
import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as Location from 'expo-location'
import * as Haptics from 'expo-haptics'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import { ScreenHeader } from '@/components/layout/ScreenHeader'
import { Card } from '@/components/ui/Card'

export default function ClockScreen() {
  const { staffId, tenantId } = useAuthStore()
  const qc = useQueryClient()
  const [locLoading, setLocLoading] = useState(false)

  // Last event tells us if clocked in or out
  const { data: lastEvent, isLoading } = useQuery({
    queryKey: ['last-clock-event', staffId],
    queryFn: async () => {
      const { data } = await supabase
        .from('clock_events')
        .select('id, event_type, timestamp, lat, lng')
        .eq('staff_id', staffId!)
        .in('event_type', ['clock_in', 'clock_out'])
        .order('timestamp', { ascending: false })
        .limit(1)
        .maybeSingle()
      return data
    },
    enabled: !!staffId,
  })

  const { data: recentEvents = [] } = useQuery({
    queryKey: ['recent-clock-events', staffId],
    queryFn: async () => {
      const { data } = await supabase
        .from('clock_events')
        .select('id, event_type, timestamp')
        .eq('staff_id', staffId!)
        .in('event_type', ['clock_in', 'clock_out'])
        .order('timestamp', { ascending: false })
        .limit(14)
      return data ?? []
    },
    enabled: !!staffId,
  })

  const clockMutation = useMutation({
    mutationFn: async (action: 'clock_in' | 'clock_out') => {
      setLocLoading(true)
      let lat: number | null = null
      let lng: number | null = null
      try {
        const { status } = await Location.requestForegroundPermissionsAsync()
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
          lat = loc.coords.latitude
          lng = loc.coords.longitude
        }
      } finally {
        setLocLoading(false)
      }
      const { error } = await supabase.from('clock_events').insert({
        staff_id: staffId,
        tenant_id: tenantId,
        event_type: action,
        timestamp: new Date().toISOString(),
        lat,
        lng,
      })
      if (error) throw error
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      qc.invalidateQueries({ queryKey: ['last-clock-event', staffId] })
      qc.invalidateQueries({ queryKey: ['recent-clock-events', staffId] })
    },
    onError: (e: Error) => Alert.alert('Error', e.message),
  })

  const isClockedIn = lastEvent?.event_type === 'clock_in'
  const busy = clockMutation.isPending || locLoading || isLoading

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })
  }

  function sinceClockIn() {
    if (!lastEvent || !isClockedIn) return null
    const diff = Date.now() - new Date(lastEvent.timestamp).getTime()
    const hrs = Math.floor(diff / 3_600_000)
    const mins = Math.floor((diff % 3_600_000) / 60_000)
    return `${hrs}h ${mins}m`
  }

  // Pair events into shifts: clock_in → clock_out pairs
  const pairs: { in: string; out: string | null }[] = []
  for (let i = 0; i < recentEvents.length; i++) {
    if (recentEvents[i].event_type === 'clock_in') {
      const next = recentEvents[i - 1]
      pairs.push({ in: recentEvents[i].timestamp, out: next?.event_type === 'clock_out' ? next.timestamp : null })
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      <ScreenHeader title="Clock In / Out" />

      <View className="flex-1 px-4 py-6 space-y-4">
        {/* Big button */}
        <View className="items-center py-8">
          <TouchableOpacity
            onPress={() => clockMutation.mutate(isClockedIn ? 'clock_out' : 'clock_in')}
            disabled={busy}
            className={`w-44 h-44 rounded-full items-center justify-center shadow-xl ${isClockedIn ? 'bg-red-500' : 'bg-emerald-500'}`}
            style={{ elevation: 8 }}
          >
            {busy
              ? <ActivityIndicator color="#fff" size="large" />
              : <>
                  <Text className="text-white text-5xl mb-1">{isClockedIn ? '⏹' : '▶'}</Text>
                  <Text className="text-white font-bold text-lg">{isClockedIn ? 'Clock Out' : 'Clock In'}</Text>
                </>
            }
          </TouchableOpacity>

          {isClockedIn && lastEvent && (
            <View className="mt-6 items-center">
              <Text className="text-gray-500 text-sm">Clocked in at {formatTime(lastEvent.timestamp)}</Text>
              <Text className="text-gray-900 font-bold text-2xl mt-1">{sinceClockIn()}</Text>
            </View>
          )}
        </View>

        {/* Recent */}
        <Card>
          <Text className="text-xs text-gray-500 font-medium mb-3 uppercase tracking-wide">Recent Shifts</Text>
          {pairs.length === 0
            ? <Text className="text-gray-400 text-sm">No clock events yet</Text>
            : pairs.slice(0, 7).map((p, i) => (
                <View key={i} className="flex-row items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <Text className="text-gray-700 text-sm">
                    {new Date(p.in).toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </Text>
                  <Text className="text-gray-500 text-sm">
                    {formatTime(p.in)} – {p.out ? formatTime(p.out) : '—'}
                  </Text>
                </View>
              ))
          }
        </Card>
      </View>
    </SafeAreaView>
  )
}
