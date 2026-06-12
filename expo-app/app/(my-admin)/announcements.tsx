import { FlatList, View, Text, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import { ScreenHeader } from '@/components/layout/ScreenHeader'

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return `${days} days ago`
}

export default function AnnouncementsScreen() {
  const { tenantId } = useAuthStore()

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['announcements', tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from('announcements')
        .select('id, title, body, created_at, pinned')
        .eq('tenant_id', tenantId!)
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false })
      return data ?? []
    },
    enabled: !!tenantId,
  })

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      <ScreenHeader title="Announcements" />

      {isLoading
        ? <ActivityIndicator className="mt-10" color="#6366F1" />
        : (
          <FlatList
            data={items}
            keyExtractor={i => i.id}
            contentContainerClassName="py-3 px-4 gap-3"
            ListEmptyComponent={<Text className="text-gray-400 text-sm text-center mt-10">No announcements yet</Text>}
            renderItem={({ item }) => (
              <View className={`bg-white rounded-2xl p-4 ${item.pinned ? 'border-l-4 border-brand' : ''}`}>
                <View className="flex-row items-center gap-2 mb-2">
                  {item.pinned && <Text className="text-xs text-brand font-semibold">📌 PINNED</Text>}
                  <Text className="text-gray-400 text-xs ml-auto">{timeAgo(item.created_at)}</Text>
                </View>
                <Text className="text-gray-900 font-bold text-sm mb-1.5">{item.title}</Text>
                <Text className="text-gray-600 text-sm leading-relaxed">{item.body}</Text>
              </View>
            )}
          />
        )
      }
    </SafeAreaView>
  )
}
