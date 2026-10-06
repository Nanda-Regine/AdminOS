import { useState } from 'react'
import { Alert, Text, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, errorMessage } from '@/lib/api'
import { useMe } from '@/hooks/useMe'
import { shortDate } from '@/lib/format'
import type { Sop } from '@/lib/types'
import { Screen, Card, Button, Badge, EmptyState, QueryView } from '@/components/ui'

/** SOP content is jsonb; the web editor writes { text }. */
function contentText(content: unknown): string {
  if (typeof content === 'string') return content
  if (content && typeof content === 'object' && typeof (content as { text?: unknown }).text === 'string') {
    return (content as { text: string }).text
  }
  return ''
}

export default function HandbookScreen() {
  const { data: me } = useMe()
  const qc = useQueryClient()
  const [open, setOpen] = useState<string | null>(null)
  const q = useQuery({ queryKey: ['handbook'], queryFn: () => api.get<Sop[]>('/api/sops?status=active') })

  const ack = useMutation({
    mutationFn: (id: string) => api.post(`/api/sops/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['handbook'] }),
    onError: (e) => Alert.alert('Not recorded', errorMessage(e)),
  })

  const acked = (s: Sop) => (s.acks ?? []).some((a) => a.user_id === me?.user.id)

  return (
    <Screen title="Handbook" subtitle="Company policies and procedures" back refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      <QueryView
        query={q}
        isEmpty={(d) => d.filter((s) => s.status === 'active').length === 0}
        empty={<EmptyState icon="book-outline" title="No published policies yet" body="When your employer publishes a policy or procedure, it appears here." />}
      >
        {(list) => list.filter((s) => s.status === 'active').map((s) => {
          const needsAck = s.requires_acknowledgement && !acked(s)
          const expanded = open === s.id
          const text = contentText(s.content)
          return (
            <Card key={s.id} onPress={() => setOpen(expanded ? null : s.id)} className="gap-2">
              <View className="flex-row items-start gap-2">
                <Text className="text-white font-semibold flex-1">{s.title}</Text>
                {needsAck ? <Badge label="Please read" tone="amber" /> : s.requires_acknowledgement ? <Badge label="Read ✓" tone="green" /> : null}
              </View>
              <Text className="text-slate-500 text-xs">
                {s.category ? `${s.category} · ` : ''}Version {s.version ?? 1}{s.published_at ? ` · ${shortDate(s.published_at)}` : ''}
              </Text>
              {expanded && (
                <>
                  <Text className="text-slate-200 leading-6" selectable>{text || 'This policy has no written content yet.'}</Text>
                  {needsAck && (
                    <Button label="I have read and understood this" variant="success" small loading={ack.isPending && ack.variables === s.id} onPress={() => ack.mutate(s.id)} />
                  )}
                </>
              )}
            </Card>
          )
        })}
      </QueryView>
    </Screen>
  )
}
