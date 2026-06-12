import { useState } from 'react'
import { FlatList, View, Text, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import { Badge } from '@/components/ui/Badge'

function sentimentColor(s: string | null) {
  if (s === 'positive') return 'green' as const
  if (s === 'negative') return 'red' as const
  return 'gray' as const
}

export default function InboxScreen() {
  const { tenantId } = useAuthStore()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('all')

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ['conversations', tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from('conversations')
        .select('id, contact_id, status, last_message_at, sentiment, contacts(name, phone)')
        .eq('tenant_id', tenantId!)
        .order('last_message_at', { ascending: false })
        .limit(50)
      return data ?? []
    },
    enabled: !!tenantId,
  })

  const filtered = conversations.filter(c => {
    const name = (c.contacts as any)?.name ?? ''
    const matchSearch = name.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || c.status === filter
    return matchSearch && matchFilter
  })

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      {/* Header */}
      <View className="bg-navy-900 px-5 pt-4 pb-4">
        <Text className="text-white text-xl font-bold mb-3">Inbox</Text>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search contacts…"
          placeholderTextColor="#6B7280"
          className="bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white text-sm mb-3"
        />
        <View className="flex-row gap-2">
          {(['all', 'open', 'resolved'] as const).map(f => (
            <TouchableOpacity
              key={f}
              onPress={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-full ${filter === f ? 'bg-brand' : 'bg-white/10'}`}
            >
              <Text className={`text-xs font-medium ${filter === f ? 'text-white' : 'text-gray-400'}`}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {isLoading
        ? <ActivityIndicator className="mt-10" color="#6366F1" />
        : (
          <FlatList
            data={filtered}
            keyExtractor={item => item.id}
            contentContainerClassName="py-2"
            ItemSeparatorComponent={() => <View className="h-px bg-gray-100 mx-4" />}
            renderItem={({ item }) => {
              const contact = item.contacts as any
              const initial = (contact?.name ?? '?')[0].toUpperCase()
              return (
                <TouchableOpacity className="flex-row items-center px-4 py-3.5 bg-white">
                  <View className="w-11 h-11 rounded-full bg-indigo-100 items-center justify-center mr-3">
                    <Text className="text-indigo-700 font-bold text-base">{initial}</Text>
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center justify-between mb-0.5">
                      <Text className="text-gray-900 font-semibold text-sm">{contact?.name ?? 'Unknown'}</Text>
                      <Badge label={item.status} color={item.status === 'open' ? 'green' : 'gray'} />
                    </View>
                    <Text className="text-gray-500 text-xs">{contact?.phone ?? ''}</Text>
                  </View>
                  {item.sentiment && (
                    <View className="ml-2">
                      <Badge label={item.sentiment} color={sentimentColor(item.sentiment)} />
                    </View>
                  )}
                </TouchableOpacity>
              )
            }}
          />
        )
      }
    </SafeAreaView>
  )
}
