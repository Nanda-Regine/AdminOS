import { FlatList, View, Text, TouchableOpacity, ActivityIndicator, Linking } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import { ScreenHeader } from '@/components/layout/ScreenHeader'

const TYPE_ICON: Record<string, string> = {
  contract: '📝',
  id: '🪪',
  certificate: '🎓',
  other: '📄',
}

export default function DocumentsScreen() {
  const { staffId } = useAuthStore()

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['staff-docs', staffId],
    queryFn: async () => {
      const { data } = await supabase
        .from('staff_documents')
        .select('id, name, type, url, created_at')
        .eq('staff_id', staffId!)
        .order('created_at', { ascending: false })
      return data ?? []
    },
    enabled: !!staffId,
  })

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['bottom']}>
      <ScreenHeader title="My Documents" />

      {isLoading
        ? <ActivityIndicator className="mt-10" color="#6366F1" />
        : (
          <FlatList
            data={documents}
            keyExtractor={i => i.id}
            contentContainerClassName="py-3 px-4 gap-3"
            ListEmptyComponent={<Text className="text-gray-400 text-sm text-center mt-10">No documents on file</Text>}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => item.url && Linking.openURL(item.url)}
                className="bg-white rounded-2xl p-4 flex-row items-center gap-3"
              >
                <View className="w-11 h-11 rounded-xl bg-indigo-50 items-center justify-center">
                  <Text className="text-2xl">{TYPE_ICON[item.type] ?? '📄'}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-gray-900 font-semibold text-sm">{item.name}</Text>
                  <Text className="text-gray-500 text-xs mt-0.5 capitalize">{item.type}</Text>
                </View>
                {item.url && <Text className="text-brand text-xs font-medium">View →</Text>}
              </TouchableOpacity>
            )}
          />
        )
      }
    </SafeAreaView>
  )
}
