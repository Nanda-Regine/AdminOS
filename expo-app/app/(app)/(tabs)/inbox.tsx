import { useState } from 'react'
import { Text, View } from 'react-native'
import { router } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useMe } from '@/hooks/useMe'
import { can } from '@/store/session'
import { relative } from '@/lib/format'
import type { Conversation } from '@/lib/types'
import { Screen, Card, Badge, Segmented, EmptyState, QueryView, statusTone } from '@/components/ui'

type Filter = 'escalated' | 'open' | 'all'
const STATUS_LABEL: Record<string, string> = { open: 'open', escalated: 'needs you', auto_resolved: 'AI resolved', closed: 'closed' }

export default function InboxScreen() {
  const { data: me } = useMe()
  const [filter, setFilter] = useState<Filter>('escalated')
  const q = useQuery({
    queryKey: ['conversations', filter],
    queryFn: () => api.get<Conversation[]>(`/api/conversations?limit=100${filter === 'all' ? '' : `&status=${filter}`}`),
    enabled: can(me, 'view_communications'),
  })

  if (me && !can(me, 'view_communications')) {
    return <Screen title="Inbox"><EmptyState icon="lock-closed-outline" title="No access" body="Your role doesn’t include customer conversations." /></Screen>
  }

  return (
    <Screen title="Inbox" subtitle="Customer WhatsApp conversations" refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      <Segmented value={filter} onChange={setFilter} options={[
        { value: 'escalated', label: 'Needs you' },
        { value: 'open', label: 'Open' },
        { value: 'all', label: 'All' },
      ]} />
      <QueryView
        query={q}
        isEmpty={(d) => d.length === 0}
        empty={filter === 'escalated'
          ? <EmptyState icon="happy-outline" title="Nothing needs you" body="When the AI hands a customer over to a person, it shows up here." />
          : <EmptyState icon="chatbubbles-outline" title="No conversations" />}
      >
        {(list) => list.map((c) => (
          <Card key={c.id} onPress={() => router.push({ pathname: '/conversation/[id]', params: { id: c.id } })} className="gap-1">
            <View className="flex-row items-center gap-2">
              <Text className="text-white font-semibold flex-1" numberOfLines={1}>{c.contact_name || c.contact_identifier || 'Customer'}</Text>
              <Text className="text-slate-500 text-xs">{relative(c.updated_at)}</Text>
            </View>
            {c.summary ? <Text className="text-slate-400 text-sm" numberOfLines={2}>{c.summary}</Text> : c.intent ? <Text className="text-slate-400 text-sm">{c.intent}</Text> : null}
            <View className="flex-row gap-2 mt-1">
              <Badge label={STATUS_LABEL[c.status] ?? c.status} tone={statusTone(c.status)} />
              {c.sentiment === 'negative' || c.sentiment === 'urgent' ? <Badge label={c.sentiment} tone="red" /> : null}
            </View>
          </Card>
        ))}
      </QueryView>
    </Screen>
  )
}
