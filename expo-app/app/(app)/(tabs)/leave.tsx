import { Alert, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, errorMessage } from '@/lib/api'
import { useMe } from '@/hooks/useMe'
import { LEAVE_LABEL, shortDate } from '@/lib/format'
import type { LeaveMine, LeaveRequest } from '@/lib/types'
import { Screen, Card, Button, Badge, SectionTitle, EmptyState, QueryView, statusTone } from '@/components/ui'

function span(r: LeaveRequest) {
  return r.start_date === r.end_date ? shortDate(r.start_date) : `${shortDate(r.start_date)} – ${shortDate(r.end_date)}`
}

export default function LeaveScreen() {
  const { data: me } = useMe()
  const qc = useQueryClient()
  const q = useQuery({
    queryKey: ['leave', 'mine'],
    queryFn: () => api.get<LeaveMine>('/api/leave?scope=mine'),
    enabled: Boolean(me),
  })

  const withdraw = useMutation({
    mutationFn: (id: string) => api.del(`/api/leave/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leave'] })
      qc.invalidateQueries({ queryKey: ['me'] })
    },
    onError: (e) => Alert.alert('Couldn’t withdraw', errorMessage(e)),
  })

  function confirmWithdraw(r: LeaveRequest) {
    Alert.alert('Withdraw this request?', `${LEAVE_LABEL[r.leave_type] ?? 'Leave'}, ${span(r)}`, [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Withdraw', style: 'destructive', onPress: () => withdraw.mutate(r.id) },
    ])
  }

  return (
    <Screen title="Leave" refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      <QueryView query={q}>
        {(data) => !data.linked ? (
          <EmptyState icon="link-outline" title="No staff record linked" body="Ask your employer to send you an app invite so your leave is linked to this login." />
        ) : (
          <>
            {data.balance && (
              <Card>
                <Text className="text-slate-400 text-xs">Annual leave left</Text>
                <Text className="text-white text-3xl font-bold mt-1">{data.balance.remaining} <Text className="text-lg text-slate-400">days</Text></Text>
                <Text className="text-slate-500 text-xs mt-1">{data.balance.taken} of {data.balance.entitlement} used. Sick and family leave don’t come off this balance.</Text>
              </Card>
            )}
            <Button label="Request leave" icon="add" onPress={() => router.push('/leave-request')} />

            <SectionTitle>My requests</SectionTitle>
            {data.requests.length === 0 ? (
              <EmptyState icon="sunny-outline" title="No leave requests yet" body="Requests you make appear here with their status." />
            ) : data.requests.map((r) => (
              <Card key={r.id} className="gap-1.5">
                <View className="flex-row justify-between items-start">
                  <Text className="text-white font-semibold flex-1">{LEAVE_LABEL[r.leave_type] ?? 'Leave'}</Text>
                  <Badge label={r.status} tone={statusTone(r.status)} />
                </View>
                <Text className="text-slate-300 text-sm">{span(r)} · {r.days} working day{Number(r.days) === 1 ? '' : 's'}</Text>
                {r.reason ? <Text className="text-slate-500 text-sm" numberOfLines={2}>{r.reason}</Text> : null}
                {r.status === 'pending' && (
                  <View className="mt-1 self-start">
                    <Button label="Withdraw" variant="secondary" small loading={withdraw.isPending && withdraw.variables === r.id} onPress={() => confirmWithdraw(r)} />
                  </View>
                )}
              </Card>
            ))}
          </>
        )}
      </QueryView>
    </Screen>
  )
}
