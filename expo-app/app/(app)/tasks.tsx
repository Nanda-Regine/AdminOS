import { useState } from 'react'
import { Alert, Text, View } from 'react-native'
import * as Haptics from 'expo-haptics'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, errorMessage } from '@/lib/api'
import { useMe } from '@/hooks/useMe'
import { shortDate, saToday } from '@/lib/format'
import type { Task } from '@/lib/types'
import { Screen, Card, Button, Badge, Segmented, EmptyState, QueryView, statusTone } from '@/components/ui'

const PRIORITY_TONE = { urgent: 'red', high: 'amber', medium: 'gray', low: 'gray' } as const

export default function TasksScreen() {
  const { data: me } = useMe()
  const qc = useQueryClient()
  const [view, setView] = useState<'open' | 'done'>('open')

  const q = useQuery({
    queryKey: ['tasks', 'mine'],
    queryFn: () => api.get<Task[]>('/api/tasks?mine=true&limit=300'),
    enabled: Boolean(me?.staff),
  })

  const move = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Task['status'] }) => api.patch(`/api/tasks/${id}`, { status }),
    // Optimistic: the tick lands instantly; rolled back if the server refuses.
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ['tasks', 'mine'] })
      const prev = qc.getQueryData<Task[]>(['tasks', 'mine'])
      qc.setQueryData<Task[]>(['tasks', 'mine'], (old) => old?.map((t) => (t.id === id ? { ...t, status } : t)))
      return { prev }
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['tasks', 'mine'], ctx.prev)
      Alert.alert('Couldn’t update the task', errorMessage(e))
    },
    onSuccess: (_d, v) => {
      if (v.status === 'done') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined)
      qc.invalidateQueries({ queryKey: ['me'] })
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['tasks', 'mine'] }),
  })

  if (me && !me.staff) {
    return <Screen title="My tasks" back><EmptyState icon="link-outline" title="No staff record linked" body="Tasks are assigned to staff records. Ask your employer for an app invite." /></Screen>
  }

  const today = saToday()
  return (
    <Screen title="My tasks" back refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      <Segmented value={view} onChange={setView} options={[{ value: 'open', label: 'To do' }, { value: 'done', label: 'Done' }]} />
      <QueryView query={q}>
        {(all) => {
          const list = all.filter((t) => (view === 'done' ? t.status === 'done' : !['done', 'cancelled'].includes(t.status)))
          if (list.length === 0) {
            return view === 'open'
              ? <EmptyState icon="checkmark-circle-outline" title="Nothing on your list" body="Tasks your manager assigns to you appear here." />
              : <EmptyState icon="time-outline" title="No finished tasks yet" />
          }
          return list.map((t) => {
            const due = t.due_date?.slice(0, 10)
            const overdue = due && due < today && t.status !== 'done'
            return (
              <Card key={t.id} className="gap-2">
                <View className="flex-row gap-2 items-start">
                  <Text className={`flex-1 text-base ${t.status === 'done' ? 'text-slate-500 line-through' : 'text-white font-semibold'}`}>{t.title}</Text>
                  <Badge label={t.priority} tone={PRIORITY_TONE[t.priority] ?? 'gray'} />
                </View>
                {t.description ? <Text className="text-slate-400 text-sm" numberOfLines={3}>{t.description}</Text> : null}
                <View className="flex-row items-center justify-between">
                  <Text className={overdue ? 'text-red-300 text-xs' : 'text-slate-500 text-xs'}>{due ? `${overdue ? 'Overdue · ' : 'Due '}${shortDate(due)}` : 'No due date'}</Text>
                  {t.status !== 'todo' && t.status !== 'done' ? <Badge label={t.status.replace('_', ' ')} tone={statusTone(t.status)} /> : null}
                </View>
                {view === 'open' ? (
                  <View className="flex-row gap-2">
                    {t.status === 'todo' && <View className="flex-1"><Button label="Start" variant="secondary" small onPress={() => move.mutate({ id: t.id, status: 'in_progress' })} /></View>}
                    <View className="flex-1"><Button label="Mark done" variant="success" small icon="checkmark" onPress={() => move.mutate({ id: t.id, status: 'done' })} /></View>
                  </View>
                ) : (
                  <Button label="Reopen" variant="ghost" small onPress={() => move.mutate({ id: t.id, status: 'todo' })} />
                )}
              </Card>
            )
          })
        }}
      </QueryView>
    </Screen>
  )
}
