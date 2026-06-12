import { FlatList, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import { ScreenHeader } from '@/components/layout/ScreenHeader'
import { Badge } from '@/components/ui/Badge'

type Priority = 'low' | 'medium' | 'high'

function priorityColor(p: Priority | null) {
  if (p === 'high') return 'red' as const
  if (p === 'medium') return 'yellow' as const
  return 'gray' as const
}

export default function TasksScreen() {
  const { staffId } = useAuthStore()
  const qc = useQueryClient()

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['my-tasks', staffId],
    queryFn: async () => {
      const { data } = await supabase
        .from('tasks')
        .select('id, title, description, status, priority, due_date')
        .eq('assigned_to', staffId!)
        .in('status', ['pending', 'in_progress'])
        .order('due_date', { ascending: true, nullsFirst: false })
      return data ?? []
    },
    enabled: !!staffId,
  })

  const { data: doneTasks = [] } = useQuery({
    queryKey: ['my-done-tasks', staffId],
    queryFn: async () => {
      const { data } = await supabase
        .from('tasks')
        .select('id, title, status, updated_at')
        .eq('assigned_to', staffId!)
        .eq('status', 'done')
        .order('updated_at', { ascending: false })
        .limit(5)
      return data ?? []
    },
    enabled: !!staffId,
  })

  const completeMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase.from('tasks').update({ status: 'done' }).eq('id', taskId)
      if (error) throw error
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      qc.invalidateQueries({ queryKey: ['my-tasks', staffId] })
      qc.invalidateQueries({ queryKey: ['my-done-tasks', staffId] })
    },
  })

  function isOverdue(due: string | null) {
    if (!due) return false
    return new Date(due) < new Date()
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      <ScreenHeader title="My Tasks" subtitle={`${tasks.length} active`} />

      {isLoading
        ? <ActivityIndicator className="mt-10" color="#6366F1" />
        : (
          <FlatList
            data={[
              ...tasks.map(t => ({ ...t, section: 'active' })),
              ...(doneTasks.length > 0 ? [{ id: '__divider__', title: '', section: 'divider' as const, status: 'done', priority: null, due_date: null }] : []),
              ...doneTasks.map(t => ({ ...t, section: 'done' })),
            ]}
            keyExtractor={i => i.id}
            contentContainerClassName="py-3 px-4 gap-3"
            renderItem={({ item }) => {
              if (item.section === 'divider') {
                return <Text className="text-xs text-gray-400 font-medium uppercase tracking-wide mt-2 mb-1">Completed recently</Text>
              }
              const overdue = isOverdue(item.due_date)
              const isDone = item.section === 'done'
              return (
                <View className={`bg-white rounded-2xl p-4 ${isDone ? 'opacity-60' : ''}`}>
                  <View className="flex-row items-start gap-3">
                    {!isDone && (
                      <TouchableOpacity
                        onPress={() => completeMutation.mutate(item.id)}
                        className="w-6 h-6 rounded-full border-2 border-indigo-300 mt-0.5 items-center justify-center"
                      >
                        {completeMutation.isPending ? <ActivityIndicator size="small" color="#6366F1" /> : null}
                      </TouchableOpacity>
                    )}
                    {isDone && <Text className="text-emerald-500 text-lg mt-0.5">✓</Text>}
                    <View className="flex-1">
                      <Text className={`font-semibold text-sm ${isDone ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                        {item.title}
                      </Text>
                      <View className="flex-row items-center gap-2 mt-1.5">
                        {item.priority && <Badge label={item.priority} color={priorityColor(item.priority as Priority)} />}
                        {item.due_date && (
                          <Text className={`text-xs ${overdue ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                            {overdue ? '⚠ ' : ''}{new Date(item.due_date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>
                </View>
              )
            }}
          />
        )
      }
    </SafeAreaView>
  )
}
