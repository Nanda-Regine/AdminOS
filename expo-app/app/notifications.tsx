import { FlatList, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import { ScreenHeader } from '@/components/layout/ScreenHeader'

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(diff / 3600000)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(diff / 86400000)}d ago`
}

const TYPE_ICON: Record<string, string> = {
  task_assigned: '✅',
  leave_approved: '🌴',
  leave_rejected: '❌',
  payslip_ready: '💰',
  achievement_earned: '🏆',
  announcement_new: '📣',
  invoice_paid: '🎉',
  new_message: '💬',
  low_stock: '⚠️',
  compliance_due: '📋',
  booking_reminder: '📅',
}

export default function NotificationsScreen() {
  const { user, tenantId } = useAuthStore()
  const qc = useQueryClient()

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('notifications')
        .select('id, type, title, body, read, created_at, action_url')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(50)
      return data ?? []
    },
    enabled: !!user?.id,
  })

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('notifications').update({ read: true }).eq('id', id)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications', user?.id] }),
  })

  const markAllRead = async () => {
    await supabase.from('notifications').update({ read: true }).eq('user_id', user!.id).eq('read', false)
    qc.invalidateQueries({ queryKey: ['notifications', user?.id] })
  }

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['bottom']}>
      <ScreenHeader
        title="Notifications"
        back
        right={
          unreadCount > 0 ? (
            <TouchableOpacity onPress={markAllRead}>
              <Text className="text-brand text-sm font-medium">Mark all read</Text>
            </TouchableOpacity>
          ) : undefined
        }
      />

      {isLoading
        ? <ActivityIndicator className="mt-10" color="#6366F1" />
        : (
          <FlatList
            data={notifications}
            keyExtractor={i => i.id}
            contentContainerClassName="py-2"
            ItemSeparatorComponent={() => <View className="h-px bg-gray-100 mx-4" />}
            ListEmptyComponent={
              <View className="items-center mt-20">
                <Text className="text-4xl mb-3">🔔</Text>
                <Text className="text-gray-500">All caught up!</Text>
              </View>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => { markReadMutation.mutate(item.id) }}
                className={`px-4 py-4 flex-row gap-3 ${!item.read ? 'bg-indigo-50/60' : 'bg-white'}`}
              >
                <View className="w-10 h-10 rounded-full bg-white border border-gray-100 items-center justify-center shadow-sm">
                  <Text className="text-xl">{TYPE_ICON[item.type] ?? '🔔'}</Text>
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center justify-between mb-0.5">
                    <Text className="text-gray-900 font-semibold text-sm">{item.title}</Text>
                    <Text className="text-gray-400 text-xs">{timeAgo(item.created_at)}</Text>
                  </View>
                  <Text className="text-gray-600 text-sm leading-relaxed">{item.body}</Text>
                </View>
                {!item.read && <View className="w-2 h-2 rounded-full bg-brand mt-1.5" />}
              </TouchableOpacity>
            )}
          />
        )
      }
    </SafeAreaView>
  )
}
