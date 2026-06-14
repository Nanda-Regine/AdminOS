import { useState } from 'react'
import { FlatList, View, Text, TextInput, TouchableOpacity, Linking, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import { ScreenHeader } from '@/components/layout/ScreenHeader'
import { Badge } from '@/components/ui/Badge'

function initials(name: string) {
  return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
}

const AVATAR_COLORS = ['bg-indigo-500', 'bg-purple-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500']

export default function TeamScreen() {
  const { tenantId } = useAuthStore()
  const [search, setSearch] = useState('')

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ['team', tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from('staff')
        .select('id, full_name, role, department, phone, employment_status, avatar_url')
        .eq('tenant_id', tenantId!)
        .eq('employment_status', 'active')
        .order('full_name')
      return data ?? []
    },
    enabled: !!tenantId,
  })

  const filtered = staff.filter(s =>
    s.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.department?.toLowerCase().includes(search.toLowerCase())
  )

  const departments = [...new Set(staff.map(s => s.department).filter(Boolean))]

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['bottom']}>
      <ScreenHeader title="Team Directory" subtitle={`${staff.length} members`} />

      <View className="px-4 py-3">
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name or department…"
          placeholderTextColor="#9CA3AF"
          className="bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 text-sm"
        />
      </View>

      {isLoading
        ? <ActivityIndicator className="mt-10" color="#6366F1" />
        : (
          <FlatList
            data={filtered}
            keyExtractor={i => i.id}
            contentContainerClassName="px-4 pb-4 gap-2"
            ItemSeparatorComponent={() => <View className="h-px bg-gray-100" />}
            renderItem={({ item, index }) => {
              const color = AVATAR_COLORS[index % AVATAR_COLORS.length]
              return (
                <View className="bg-white rounded-2xl p-4 flex-row items-center gap-3">
                  <View className={`w-12 h-12 rounded-full ${color} items-center justify-center`}>
                    <Text className="text-white font-bold text-base">{initials(item.full_name ?? '?')}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-gray-900 font-semibold">{item.full_name}</Text>
                    <Text className="text-gray-500 text-xs mt-0.5">{item.role} {item.department ? `· ${item.department}` : ''}</Text>
                  </View>
                  {item.phone && (
                    <TouchableOpacity
                      onPress={() => Linking.openURL(`tel:${item.phone}`)}
                      className="w-9 h-9 rounded-full bg-indigo-50 items-center justify-center"
                    >
                      <Text>📞</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )
            }}
          />
        )
      }
    </SafeAreaView>
  )
}
