import { Text, View } from 'react-native'
import { router } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useMe } from '@/hooks/useMe'
import { zar, relative } from '@/lib/format'
import { categoryLabel } from '@/lib/categories'
import type { Expense } from '@/lib/types'
import { Screen, Card, Button, Badge, EmptyState, QueryView, statusTone } from '@/components/ui'

export default function ExpensesScreen() {
  const { data: me } = useMe()
  const q = useQuery({
    queryKey: ['expenses', 'mine'],
    // Non-finance callers only ever get their own claims back (server-enforced).
    queryFn: () => api.get<Expense[]>(`/api/expenses${me?.staff ? `?staffId=${me.staff.id}` : ''}`),
    enabled: Boolean(me?.staff),
  })

  if (me && !me.staff) {
    return <Screen title="Expenses" back><EmptyState icon="link-outline" title="No staff record linked" body="Ask your employer to send you an app invite so you can claim expenses." /></Screen>
  }

  return (
    <Screen title="Expenses" subtitle="Claims you’ve submitted" back refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      <Button label="New claim" icon="camera-outline" onPress={() => router.push('/expense-new')} />
      <QueryView
        query={q}
        isEmpty={(d) => d.length === 0}
        empty={<EmptyState icon="receipt-outline" title="No claims yet" body="Snap a photo of the slip, enter the amount, and your manager is notified." />}
      >
        {(list) => list.map((x) => (
          <Card key={x.id} className="gap-1">
            <View className="flex-row justify-between items-start">
              <Text className="text-white font-semibold flex-1">{categoryLabel(x.category)}</Text>
              <Text className="text-white font-bold">{zar(x.amount)}</Text>
            </View>
            {x.description ? <Text className="text-slate-400 text-sm" numberOfLines={2}>{x.description}</Text> : null}
            <View className="flex-row justify-between items-center mt-1">
              <Text className="text-slate-500 text-xs">{relative(x.submitted_at)}{x.receipt_url ? ' · receipt attached' : ''}</Text>
              <Badge label={x.status} tone={statusTone(x.status)} />
            </View>
          </Card>
        ))}
      </QueryView>
    </Screen>
  )
}
