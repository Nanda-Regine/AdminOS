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

  const { data: activeShift, isLoading } = useQuery({
    queryKey: ['active-shift', staffId],
    queryFn: async () => {
      const { data } = await supabase
        .from('shifts')
        .select('id, clock_in, notes')
        .eq('staff_id', staffId!)
        .is('clock_out', null)
        .order('clock_in', { ascending: false })
        .limit(1)
        .single()
      return data
    },
    enabled: !!staffId,
    retry: false,
  })

  const { data: recentShifts = [] } = useQuery({
    queryKey: ['recent-shifts', staffId],
    queryFn: async () => {
      const { data } = await supabase
        .from('shifts')
        .select('id, clock_in, clock_out')
        .eq('staff_id', staffId!)
        .not('clock_out', 'is', null)
        .order('clock_in', { ascending: false })
        .limit(7)
      return data ?? []
    },
    enabled: !!staffId,
  })

  const clockMutation = useMutation({
    mutationFn: async (action: 'in' | 'out') => {
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

      if (action === 'in') {
        const { error } = await supabase.from('shifts').insert({
          staff_id: staffId,
          tenant_id: tenantId,
          clock_in: new Date().toISOString(),
          location_lat: lat,
          location_lng: lng,
        })
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('shifts')
          .update({ clock_out: new Date().toISOString() })
          .eq('id', activeShift!.id)
        if (error) throw error
      }
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      qc.invalidateQueries({ queryKey: ['active-shift', staffId] })
      qc.invalidateQueries({ queryKey: ['recent-shifts', staffId] })
    },
    onError: (e: Error) => Alert.alert('Error', e.message),
  })

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })
  }

  function formatDuration(clockIn: string, clockOut?: string | null) {
    const start = new Date(clockIn).getTime()
    const end = clockOut ? new Date(clockOut).getTime() : Date.now()
    const hrs = Math.floor((end - start) / 3_600_000)
    const mins = Math.floor(((end - start) % 3_600_000) / 60_000)
    return `${hrs}h ${mins}m`
  }

  const isClockedIn = !!activeShift
  const busy = clockMutation.isPending || locLoading || isLoading

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      <ScreenHeader title="Clock In / Out" />

      <View className="flex-1 px-4 py-6 space-y-4">
        {/* Big clock button */}
        <View className="items-center py-8">
          <TouchableOpacity
            onPress={() => clockMutation.mutate(isClockedIn ? 'out' : 'in')}
            disabled={busy}
            className={`w-44 h-44 rounded-full items-center justify-center shadow-xl ${
              isClockedIn ? 'bg-red-500' : 'bg-emerald-500'
            }`}
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

          {isClockedIn && activeShift && (
            <View className="mt-6 items-center">
              <Text className="text-gray-500 text-sm">Clocked in at {formatTime(activeShift.clock_in)}</Text>
              <Text className="text-gray-900 font-bold text-2xl mt-1">{formatDuration(activeShift.clock_in)}</Text>
            </View>
          )}
        </View>

        {/* Recent shifts */}
        <Card>
          <Text className="text-xs text-gray-500 font-medium mb-3 uppercase tracking-wide">Recent Shifts</Text>
          {recentShifts.length === 0
            ? <Text className="text-gray-400 text-sm">No shifts yet</Text>
            : recentShifts.map(s => (
                <View key={s.id} className="flex-row items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <Text className="text-gray-700 text-sm">
                    {new Date(s.clock_in).toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </Text>
                  <Text className="text-gray-500 text-sm">
                    {formatTime(s.clock_in)} – {s.clock_out ? formatTime(s.clock_out) : '—'}
                  </Text>
                  <Text className="text-indigo-600 text-sm font-medium">{formatDuration(s.clock_in, s.clock_out)}</Text>
                </View>
              ))
          }
        </Card>
      </View>
    </SafeAreaView>
  )
}
