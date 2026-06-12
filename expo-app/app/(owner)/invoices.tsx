import { useState } from 'react'
import {
  FlatList, View, Text, TouchableOpacity, Modal,
  TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'

type StatusColor = 'green' | 'red' | 'yellow' | 'gray'
function statusColor(s: string): StatusColor {
  if (s === 'paid') return 'green'
  if (s === 'overdue') return 'red'
  if (s === 'pending') return 'yellow'
  return 'gray'
}

function formatZAR(n: number) {
  return `R ${n.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`
}

export default function InvoicesScreen() {
  const { tenantId } = useAuthStore()
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [clientName, setClientName] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoices', tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from('invoices')
        .select('id, invoice_number, client_name, total_amount, status, due_date, created_at')
        .eq('tenant_id', tenantId!)
        .order('created_at', { ascending: false })
        .limit(30)
      return data ?? []
    },
    enabled: !!tenantId,
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const { error } = await supabase.from('invoices').insert({
        tenant_id: tenantId,
        client_name: clientName,
        total_amount: parseFloat(amount),
        description,
        status: 'draft',
        created_by: session?.user.id,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices', tenantId] })
      setShowCreate(false)
      setClientName(''); setAmount(''); setDescription('')
    },
    onError: (e: Error) => Alert.alert('Error', e.message),
  })

  const totalDue = invoices.filter(i => i.status !== 'paid').reduce((s, i) => s + (i.total_amount ?? 0), 0)

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      {/* Header */}
      <View className="bg-navy-900 px-5 pt-4 pb-4">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-white text-xl font-bold">Invoices</Text>
          <TouchableOpacity
            onPress={() => setShowCreate(true)}
            className="bg-brand rounded-xl px-4 py-2"
          >
            <Text className="text-white font-semibold text-sm">+ New</Text>
          </TouchableOpacity>
        </View>
        <View className="bg-white/10 rounded-xl px-4 py-3">
          <Text className="text-gray-400 text-xs">Total outstanding</Text>
          <Text className="text-white text-2xl font-bold mt-0.5">{formatZAR(totalDue)}</Text>
        </View>
      </View>

      {isLoading
        ? <ActivityIndicator className="mt-10" color="#6366F1" />
        : (
          <FlatList
            data={invoices}
            keyExtractor={i => i.id}
            contentContainerClassName="py-2"
            ItemSeparatorComponent={() => <View className="h-px bg-gray-100 mx-4" />}
            renderItem={({ item }) => (
              <View className="bg-white px-4 py-3.5 flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className="text-gray-900 font-semibold text-sm">{item.client_name}</Text>
                  <Text className="text-gray-500 text-xs mt-0.5">{item.invoice_number ?? 'Draft'}</Text>
                </View>
                <View className="items-end gap-1">
                  <Text className="text-gray-900 font-bold text-sm">{formatZAR(item.total_amount)}</Text>
                  <Badge label={item.status} color={statusColor(item.status)} />
                </View>
              </View>
            )}
          />
        )
      }

      {/* Create modal */}
      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1 bg-white"
        >
          <View className="px-5 py-6 flex-1">
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-gray-900 text-xl font-bold">New Invoice</Text>
              <TouchableOpacity onPress={() => setShowCreate(false)}>
                <Text className="text-gray-500 text-base">Cancel</Text>
              </TouchableOpacity>
            </View>
            <View className="space-y-4 flex-1">
              {[
                { label: 'Client Name', value: clientName, onChange: setClientName, placeholder: 'Acme Corp' },
                { label: 'Amount (ZAR)', value: amount, onChange: setAmount, placeholder: '5000.00', keyboard: 'decimal-pad' as const },
                { label: 'Description', value: description, onChange: setDescription, placeholder: 'Website design services', multiline: true },
              ].map(f => (
                <View key={f.label}>
                  <Text className="text-gray-600 text-xs font-medium mb-1.5 uppercase tracking-wide">{f.label}</Text>
                  <TextInput
                    value={f.value}
                    onChangeText={f.onChange}
                    keyboardType={f.keyboard ?? 'default'}
                    placeholder={f.placeholder}
                    placeholderTextColor="#9CA3AF"
                    multiline={f.multiline}
                    numberOfLines={f.multiline ? 3 : 1}
                    className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm"
                    style={f.multiline ? { height: 80, textAlignVertical: 'top' } : {}}
                  />
                </View>
              ))}
            </View>
            <Button
              label="Create Invoice"
              onPress={() => createMutation.mutate()}
              loading={createMutation.isPending}
              className="mt-4"
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  )
}
