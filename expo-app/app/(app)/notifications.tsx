import { Text, View } from 'react-native'
import { router } from 'expo-router'
import * as Notifications from 'expo-notifications'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { relative } from '@/lib/format'
import type { AppNotification } from '@/lib/types'
import { Screen, Card, Button, EmptyState, QueryView } from '@/components/ui'

/** Web dashboard links → the matching app screen (only ones the app has). */
function appRouteFor(n: AppNotification): string | null {
  const t = n.type
  if (t.startsWith('leave_request')) return '/approvals'
  if (t.startsWith('leave_')) return '/leave'
  if (t.startsWith('expense_')) return '/expenses'
  if (t === 'approval.needed') return '/approvals'
  if (t === 'task_assigned') return '/tasks'
  const url = n.action_url ?? ''
  if (url.startsWith('/dashboard/inbox')) return '/inbox'
  if (url.startsWith('/dashboard/invoices') || url.startsWith('/dashboard/money')) return '/invoices'
  if (url.startsWith('/dashboard/expenses')) return '/approvals'
  if (url.startsWith('/dashboard/team')) return '/approvals'
  return null
}

export default function NotificationsScreen() {
  const qc = useQueryClient()
  const q = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get<{ items: AppNotification[]; unread: number }>('/api/notifications?limit=50'),
  })

  const markAll = useMutation({
    mutationFn: () => api.post('/api/notifications', { all: true }),
    onSuccess: () => {
      Notifications.setBadgeCountAsync(0).catch(() => undefined)
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
  const markOne = useMutation({
    mutationFn: (id: string) => api.post('/api/notifications', { id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  function open(n: AppNotification) {
    if (!n.read) markOne.mutate(n.id)
    const route = appRouteFor(n)
    if (route) router.push(route as never)
  }

  return (
    <Screen
      title="Notifications"
      back
      refreshing={q.isRefetching}
      onRefresh={() => q.refetch()}
      right={q.data?.unread ? <Button label="Mark all read" variant="ghost" small onPress={() => markAll.mutate()} loading={markAll.isPending} /> : undefined}
    >
      <QueryView
        query={q}
        isEmpty={(d) => d.items.length === 0}
        empty={<EmptyState icon="notifications-off-outline" title="No notifications" body="Leave decisions, approvals and tasks for you appear here." />}
      >
        {(d) => d.items.map((n) => (
          <Card key={n.id} onPress={() => open(n)} className={n.read ? 'opacity-70' : ''}>
            <View className="flex-row items-center gap-2">
              {!n.read && <View className="w-2 h-2 rounded-full bg-brand" accessibilityLabel="Unread" />}
              <Text className={`flex-1 ${n.read ? 'text-slate-200' : 'text-white font-semibold'}`}>{n.title}</Text>
              <Text className="text-slate-500 text-xs">{relative(n.created_at)}</Text>
            </View>
            <Text className="text-slate-400 text-sm mt-1">{n.body}</Text>
          </Card>
        ))}
      </QueryView>
    </Screen>
  )
}
