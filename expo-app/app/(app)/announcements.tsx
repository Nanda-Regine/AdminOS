import { useState } from 'react'
import { Text, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { api } from '@/lib/api'
import { relative } from '@/lib/format'
import type { Announcement } from '@/lib/types'
import { Screen, Card, EmptyState, QueryView, C } from '@/components/ui'

export default function AnnouncementsScreen() {
  const qc = useQueryClient()
  const [open, setOpen] = useState<string | null>(null)
  const q = useQuery({ queryKey: ['announcements'], queryFn: () => api.get<Announcement[]>('/api/announcements') })

  const markRead = useMutation({
    mutationFn: (id: string) => api.post(`/api/announcements/${id}/read`),
    onSuccess: (_d, id) => qc.setQueryData<Announcement[]>(['announcements'], (old) => old?.map((a) => (a.id === id ? { ...a, is_read: true } : a))),
  })

  function toggle(a: Announcement) {
    setOpen(open === a.id ? null : a.id)
    if (!a.is_read) markRead.mutate(a.id)
  }

  return (
    <Screen title="Announcements" back refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      <QueryView
        query={q}
        isEmpty={(d) => d.length === 0}
        empty={<EmptyState icon="megaphone-outline" title="No announcements" body="News from your employer appears here." />}
      >
        {(list) => list.map((a) => (
          <Card key={a.id} onPress={() => toggle(a)} className="gap-1.5">
            <View className="flex-row items-center gap-2">
              {a.pinned ? <Ionicons name="pin" size={14} color={C.warn} /> : null}
              {!a.is_read ? <View className="w-2 h-2 rounded-full bg-brand" accessibilityLabel="Unread" /> : null}
              <Text className={`flex-1 ${a.is_read ? 'text-slate-200' : 'text-white font-semibold'}`}>{a.title}</Text>
            </View>
            <Text className="text-slate-300 leading-6" numberOfLines={open === a.id ? undefined : 2} selectable={open === a.id}>{a.body}</Text>
            <Text className="text-slate-500 text-xs">{relative(a.published_at ?? a.created_at)}</Text>
          </Card>
        ))}
      </QueryView>
    </Screen>
  )
}
