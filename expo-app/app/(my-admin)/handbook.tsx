import { useState } from 'react'
import { FlatList, View, Text, TouchableOpacity, ActivityIndicator, Modal, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import { ScreenHeader } from '@/components/layout/ScreenHeader'
import { Badge } from '@/components/ui/Badge'

export default function HandbookScreen() {
  const { tenantId, user } = useAuthStore()
  const qc = useQueryClient()
  const [selected, setSelected] = useState<any>(null)

  const { data: sops = [], isLoading } = useQuery({
    queryKey: ['sop_documents', tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from('sop_documents')
        .select('id, title, category, version, content, published_at, status')
        .eq('tenant_id', tenantId!)
        .eq('status', 'active')
        .order('category')
      return data ?? []
    },
    enabled: !!tenantId,
  })

  const { data: acks = [] } = useQuery({
    queryKey: ['sop-acks', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('sop_acknowledgements')
        .select('sop_id')
        .eq('user_id', user!.id)
      return (data ?? []).map(a => a.sop_id)
    },
    enabled: !!user?.id,
  })

  const ackMutation = useMutation({
    mutationFn: async (sopId: string) => {
      const { error } = await supabase.from('sop_acknowledgements').upsert({
        sop_id: sopId,
        user_id: user!.id,
        acknowledged_at: new Date().toISOString(),
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sop-acks', user?.id] })
      setSelected(null)
    },
  })

  function extractText(content: unknown): string {
    if (typeof content === 'string') return content
    if (typeof content === 'object' && content !== null) {
      const c = content as Record<string, unknown>
      if (typeof c.text === 'string') return c.text
      if (typeof c.body === 'string') return c.body
      return JSON.stringify(content, null, 2)
    }
    return ''
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['bottom']}>
      <ScreenHeader title="Company Handbook" subtitle={`${sops.length} procedures`} />

      {isLoading
        ? <ActivityIndicator className="mt-10" color="#6366F1" />
        : (
          <FlatList
            data={sops}
            keyExtractor={i => i.id}
            contentContainerClassName="py-3 px-4 gap-3"
            ListEmptyComponent={<Text className="text-gray-400 text-sm text-center mt-10">No SOPs published yet</Text>}
            renderItem={({ item }) => {
              const acknowledged = acks.includes(item.id)
              return (
                <TouchableOpacity
                  onPress={() => setSelected(item)}
                  className="bg-white rounded-2xl p-4 flex-row items-center gap-3"
                >
                  <View className="w-10 h-10 rounded-xl bg-indigo-50 items-center justify-center">
                    <Text className="text-xl">📋</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-gray-900 font-semibold text-sm" numberOfLines={1}>{item.title}</Text>
                    <Text className="text-gray-500 text-xs mt-0.5 capitalize">{item.category ?? 'General'} · v{item.version}</Text>
                  </View>
                  <Badge label={acknowledged ? 'Signed' : 'Pending'} color={acknowledged ? 'green' : 'yellow'} />
                </TouchableOpacity>
              )
            }}
          />
        )
      }

      <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet">
        {selected && (
          <SafeAreaView className="flex-1 bg-white">
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-100">
              <Text className="text-gray-900 font-bold text-lg flex-1 mr-4" numberOfLines={1}>{selected.title}</Text>
              <TouchableOpacity onPress={() => setSelected(null)}><Text className="text-gray-500">Close</Text></TouchableOpacity>
            </View>
            <ScrollView className="flex-1 px-5 py-4">
              <Text className="text-gray-400 text-xs mb-4">
                Version {selected.version}
                {selected.published_at ? ` · Published ${new Date(selected.published_at).toLocaleDateString('en-ZA')}` : ''}
              </Text>
              <Text className="text-gray-800 text-sm leading-relaxed">{extractText(selected.content)}</Text>
            </ScrollView>
            {!acks.includes(selected.id) && (
              <View className="px-5 py-4 border-t border-gray-100">
                <TouchableOpacity
                  onPress={() => ackMutation.mutate(selected.id)}
                  disabled={ackMutation.isPending}
                  className="bg-brand rounded-xl py-4 items-center"
                >
                  <Text className="text-white font-semibold">I have read and understood this SOP</Text>
                </TouchableOpacity>
              </View>
            )}
          </SafeAreaView>
        )}
      </Modal>
    </SafeAreaView>
  )
}
