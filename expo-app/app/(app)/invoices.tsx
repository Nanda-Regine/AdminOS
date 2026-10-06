import { useState } from 'react'
import { Alert, Modal, Pressable, Text, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, errorMessage } from '@/lib/api'
import { useMe } from '@/hooks/useMe'
import { can } from '@/store/session'
import { zar, shortDate, saToday } from '@/lib/format'
import type { Invoice } from '@/lib/types'
import { Screen, Card, Button, Badge, Field, Segmented, EmptyState, QueryView, statusTone } from '@/components/ui'

type Filter = 'overdue' | 'open' | 'all'
const OPEN = ['sent', 'unpaid', 'partial', 'overdue', 'in_collections']
const METHODS = [
  { key: 'eft', label: 'EFT' }, { key: 'cash', label: 'Cash' }, { key: 'card', label: 'Card' },
  { key: 'mobile_money', label: 'Mobile money' }, { key: 'other', label: 'Other' },
] as const

const owed = (i: Invoice) => Math.max(0, Number(i.amount_due ?? Number(i.amount) - Number(i.amount_paid ?? 0)))

export default function InvoicesScreen() {
  const { data: me } = useMe()
  const qc = useQueryClient()
  const [filter, setFilter] = useState<Filter>('overdue')
  const [paying, setPaying] = useState<Invoice | null>(null)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<(typeof METHODS)[number]['key']>('eft')
  const writer = can(me, 'manage_invoices')

  const q = useQuery({
    queryKey: ['invoices', filter],
    queryFn: () => api.get<Invoice[]>(`/api/invoices?limit=200${filter === 'overdue' ? '&overdue=true' : ''}`),
    enabled: can(me, 'manage_invoices') || can(me, 'view_financials'),
  })

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['invoices'] })
    qc.invalidateQueries({ queryKey: ['me'] })
  }

  const pay = useMutation({
    mutationFn: ({ id, value }: { id: string; value: number }) => api.patch(`/api/invoices/${id}`, { payment: { amount: value, method } }),
    onSuccess: () => { setPaying(null); refresh() },
    onError: (e) => Alert.alert('Payment not recorded', errorMessage(e)),
  })
  const markSent = useMutation({
    mutationFn: (id: string) => api.patch(`/api/invoices/${id}`, { status: 'sent' }),
    onSuccess: refresh,
    onError: (e) => Alert.alert('Not updated', errorMessage(e)),
  })

  function startPay(i: Invoice) {
    setPaying(i)
    setAmount(owed(i).toFixed(2))
    setMethod('eft')
  }
  function submitPay() {
    const value = Number(amount.replace(/[R\s]/gi, '').replace(',', '.'))
    if (!paying || !Number.isFinite(value) || value <= 0) { Alert.alert('Enter the amount received'); return }
    if (value > owed(paying) + 0.005) { Alert.alert('Too much', `Only ${zar(owed(paying))} is outstanding on this invoice.`); return }
    pay.mutate({ id: paying.id, value: Math.round(value * 100) / 100 })
  }

  const today = saToday()
  return (
    <Screen title="Invoices" back refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      <Segmented value={filter} onChange={setFilter} options={[{ value: 'overdue', label: 'Overdue' }, { value: 'open', label: 'Unpaid' }, { value: 'all', label: 'All' }]} />
      <QueryView
        query={q}
        isEmpty={(d) => (filter === 'open' ? d.filter((i) => OPEN.includes(i.status)) : d).length === 0}
        empty={filter === 'overdue'
          ? <EmptyState icon="checkmark-circle-outline" title="Nothing overdue" body="Every invoice past its due date has been paid." />
          : <EmptyState icon="document-text-outline" title="No invoices" body="Create invoices on the web dashboard; they show up here." />}
      >
        {(all) => (filter === 'open' ? all.filter((i) => OPEN.includes(i.status)) : all).map((i) => {
          const due = i.due_date
          const late = due && due < today && OPEN.includes(i.status)
          return (
            <Card key={i.id} className="gap-1.5">
              <View className="flex-row justify-between items-start">
                <View className="flex-1 pr-2">
                  <Text className="text-white font-semibold" numberOfLines={1}>{i.contact?.name ?? i.contact_name ?? 'Customer'}</Text>
                  <Text className="text-slate-500 text-xs">{i.invoice_number ?? 'Draft'} · {due ? `${late ? 'was due' : 'due'} ${shortDate(due)}` : 'no due date'}</Text>
                </View>
                <View className="items-end">
                  <Text className="text-white font-bold">{zar(OPEN.includes(i.status) ? owed(i) : i.amount)}</Text>
                  <Badge label={late ? 'overdue' : i.status.replace('_', ' ')} tone={late ? 'red' : statusTone(i.status)} />
                </View>
              </View>
              {writer && (
                <View className="flex-row gap-2 mt-1">
                  {i.status === 'draft' && <View className="flex-1"><Button label="Mark as sent" variant="secondary" small loading={markSent.isPending && markSent.variables === i.id} onPress={() => markSent.mutate(i.id)} /></View>}
                  {OPEN.includes(i.status) && owed(i) > 0 && <View className="flex-1"><Button label="Record payment" variant="success" small onPress={() => startPay(i)} /></View>}
                </View>
              )}
            </Card>
          )
        })}
      </QueryView>

      <Modal visible={paying != null} transparent animationType="slide" onRequestClose={() => setPaying(null)}>
        <Pressable className="flex-1 bg-black/60" onPress={() => setPaying(null)} accessibilityLabel="Close" />
        <View className="bg-navy-800 rounded-t-3xl p-5 gap-4 pb-10">
          <Text className="text-white text-lg font-bold">Record payment</Text>
          {paying && <Text className="text-slate-400">{paying.contact?.name ?? paying.contact_name} · {zar(owed(paying))} outstanding</Text>}
          <Field label="Amount received (R)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
          <View className="flex-row flex-wrap gap-2">
            {METHODS.map((m) => (
              <Pressable key={m.key} onPress={() => setMethod(m.key)} accessibilityRole="radio" accessibilityState={{ checked: method === m.key }}
                className={`px-3 py-2 rounded-full border ${method === m.key ? 'bg-brand border-brand' : 'border-white/15'}`}>
                <Text className={method === m.key ? 'text-white' : 'text-slate-300'}>{m.label}</Text>
              </Pressable>
            ))}
          </View>
          <Button label="Save payment" variant="success" loading={pay.isPending} onPress={submitPay} />
        </View>
      </Modal>
    </Screen>
  )
}
