import { useState } from 'react'
import { Alert, Text, View } from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, errorMessage } from '@/lib/api'
import { useMe } from '@/hooks/useMe'
import { can } from '@/store/session'
import { LEAVE_LABEL, shortDate, zar, relative } from '@/lib/format'
import type { Expense, LeaveRequest } from '@/lib/types'
import { categoryLabel } from '@/lib/categories'
import { Screen, Card, Button, Segmented, EmptyState, QueryView } from '@/components/ui'

type Tab = 'leave' | 'expenses'

export default function ApprovalsScreen() {
  const { data: me } = useMe()
  const qc = useQueryClient()
  const canLeave = can(me, 'approve_leave')
  const canExpenses = can(me, 'view_financials')
  const [tab, setTab] = useState<Tab>(canLeave ? 'leave' : 'expenses')

  const leave = useQuery({
    queryKey: ['approvals', 'leave'],
    queryFn: () => api.get<{ requests: LeaveRequest[] }>('/api/leave?scope=team&status=pending'),
    enabled: canLeave,
  })
  const expenses = useQuery({
    queryKey: ['approvals', 'expenses'],
    queryFn: () => api.get<Expense[]>('/api/expenses?status=pending'),
    enabled: canExpenses,
  })

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ['approvals'] })
    qc.invalidateQueries({ queryKey: ['me'] })
  }

  const decideLeave = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      api.post(`/api/leave/${id}/${approve ? 'approve' : 'decline'}`),
    onSuccess: refreshAll,
    onError: (e) => { Alert.alert('Not done', errorMessage(e)); refreshAll() },
  })
  const decideExpense = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      api.post(`/api/expenses/${id}/approve`, { action: approve ? 'approve' : 'reject' }),
    onSuccess: refreshAll,
    onError: (e) => { Alert.alert('Not done', errorMessage(e)); refreshAll() },
  })

  async function openReceipt(id: string) {
    try {
      const { url } = await api.get<{ url: string }>(`/api/expenses/${id}/receipt?json=1`)
      await WebBrowser.openBrowserAsync(url)
    } catch (e) {
      Alert.alert('Receipt', errorMessage(e))
    }
  }

  function confirm(title: string, message: string, label: string, onYes: () => void) {
    Alert.alert(title, message, [{ text: 'Cancel', style: 'cancel' }, { text: label, style: 'destructive', onPress: onYes }])
  }

  if (!canLeave && !canExpenses) {
    return <Screen title="Approvals"><EmptyState icon="lock-closed-outline" title="Nothing to approve" body="Your role doesn’t approve leave or expenses." /></Screen>
  }

  const busy = (id: string) => (decideLeave.isPending && decideLeave.variables?.id === id) || (decideExpense.isPending && decideExpense.variables?.id === id)

  return (
    <Screen title="Approvals" refreshing={leave.isRefetching || expenses.isRefetching} onRefresh={refreshAll}>
      {canLeave && canExpenses && (
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'leave', label: `Leave${leave.data ? ` (${leave.data.requests.length})` : ''}` },
            { value: 'expenses', label: `Expenses${expenses.data ? ` (${expenses.data.length})` : ''}` },
          ]}
        />
      )}

      {tab === 'leave' && canLeave && (
        <QueryView
          query={leave}
          isEmpty={(d) => d.requests.length === 0}
          empty={<EmptyState icon="checkmark-done-outline" title="No leave to approve" body="New requests appear here and on your phone as they come in." />}
        >
          {(d) => d.requests.map((r) => (
            <Card key={r.id} className="gap-2">
              <Text className="text-white font-semibold">{r.staff?.full_name ?? 'Team member'}</Text>
              <Text className="text-slate-300 text-sm">
                {LEAVE_LABEL[r.leave_type] ?? 'Leave'} · {r.start_date === r.end_date ? shortDate(r.start_date) : `${shortDate(r.start_date)} – ${shortDate(r.end_date)}`} · {r.days} day{Number(r.days) === 1 ? '' : 's'}
              </Text>
              {r.reason ? <Text className="text-slate-400 text-sm">“{r.reason}”</Text> : null}
              <Text className="text-slate-500 text-xs">Requested {relative(r.created_at)}</Text>
              <View className="flex-row gap-2 mt-1">
                <View className="flex-1"><Button label="Approve" variant="success" small loading={busy(r.id) && decideLeave.variables?.approve} disabled={busy(r.id)} onPress={() => decideLeave.mutate({ id: r.id, approve: true })} /></View>
                <View className="flex-1"><Button label="Decline" variant="secondary" small disabled={busy(r.id)} onPress={() => confirm('Decline this leave?', 'They’ll be notified. Consider telling them why.', 'Decline', () => decideLeave.mutate({ id: r.id, approve: false }))} /></View>
              </View>
            </Card>
          ))}
        </QueryView>
      )}

      {tab === 'expenses' && canExpenses && (
        <QueryView
          query={expenses}
          isEmpty={(d) => d.length === 0}
          empty={<EmptyState icon="receipt-outline" title="No claims to approve" body="Expense claims your team submits appear here." />}
        >
          {(list) => list.map((x) => (
            <Card key={x.id} className="gap-2">
              <View className="flex-row justify-between">
                <Text className="text-white font-semibold flex-1">{x.staff?.full_name ?? 'Team member'}</Text>
                <Text className="text-white font-bold">{zar(x.amount)}</Text>
              </View>
              <Text className="text-slate-300 text-sm">{categoryLabel(x.category)}{x.description ? ` — ${x.description}` : ''}</Text>
              <Text className="text-slate-500 text-xs">Submitted {relative(x.submitted_at)}</Text>
              {x.receipt_url ? <Button label="View receipt" variant="ghost" small icon="document-attach-outline" onPress={() => openReceipt(x.id)} /> : <Text className="text-amber-300 text-xs">No receipt attached</Text>}
              <View className="flex-row gap-2">
                <View className="flex-1"><Button label="Approve" variant="success" small loading={busy(x.id) && decideExpense.variables?.approve} disabled={busy(x.id)} onPress={() => decideExpense.mutate({ id: x.id, approve: true })} /></View>
                <View className="flex-1"><Button label="Reject" variant="secondary" small disabled={busy(x.id)} onPress={() => confirm('Reject this claim?', 'They’ll be notified.', 'Reject', () => decideExpense.mutate({ id: x.id, approve: false }))} /></View>
              </View>
            </Card>
          ))}
        </QueryView>
      )}
    </Screen>
  )
}
