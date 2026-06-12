import { useState } from 'react'
import {
  FlatList, View, Text, TouchableOpacity, Modal, TextInput,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Image,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import { ScreenHeader } from '@/components/layout/ScreenHeader'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'

const CATEGORIES = ['travel', 'meals', 'accommodation', 'equipment', 'software', 'other'] as const

function statusColor(s: string) {
  if (s === 'approved') return 'green' as const
  if (s === 'rejected') return 'red' as const
  return 'yellow' as const
}

export default function ExpensesScreen() {
  const { staffId, tenantId } = useAuthStore()
  const qc = useQueryClient()
  const [show, setShow] = useState(false)
  const [category, setCategory] = useState<typeof CATEGORIES[number]>('travel')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [receiptUri, setReceiptUri] = useState<string | null>(null)

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['expenses', staffId],
    queryFn: async () => {
      const { data } = await supabase
        .from('expenses')
        .select('id, category, amount, description, status, receipt_url, created_at')
        .eq('staff_id', staffId!)
        .order('created_at', { ascending: false })
      return data ?? []
    },
    enabled: !!staffId,
  })

  async function pickReceipt() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') { Alert.alert('Camera permission required'); return }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7, base64: false })
    if (!result.canceled) setReceiptUri(result.assets[0].uri)
  }

  const submitMutation = useMutation({
    mutationFn: async () => {
      let receiptUrl: string | null = null
      if (receiptUri) {
        const ext = receiptUri.split('.').pop() ?? 'jpg'
        const fileName = `${staffId}/${Date.now()}.${ext}`
        const formData = new FormData()
        formData.append('file', { uri: receiptUri, name: fileName, type: `image/${ext}` } as any)
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('receipts')
          .upload(fileName, formData as any, { contentType: `image/${ext}` })
        if (!uploadErr && uploadData) {
          const { data: urlData } = supabase.storage.from('receipts').getPublicUrl(uploadData.path)
          receiptUrl = urlData.publicUrl
        }
      }
      const { error } = await supabase.from('expenses').insert({
        staff_id: staffId,
        tenant_id: tenantId,
        category,
        amount: parseFloat(amount),
        description,
        receipt_url: receiptUrl,
        status: 'pending',
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses', staffId] })
      setShow(false)
      setAmount(''); setDescription(''); setReceiptUri(null)
    },
    onError: (e: Error) => Alert.alert('Error', e.message),
  })

  const totalPending = expenses.filter(e => e.status === 'pending').reduce((s, e) => s + (e.amount ?? 0), 0)

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      <ScreenHeader
        title="Expenses"
        right={
          <TouchableOpacity onPress={() => setShow(true)} className="bg-brand rounded-xl px-4 py-2">
            <Text className="text-white font-semibold text-sm">+ Claim</Text>
          </TouchableOpacity>
        }
      />

      {totalPending > 0 && (
        <View className="mx-4 mt-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
          <Text className="text-amber-700 text-sm font-medium">R{totalPending.toFixed(2)} pending approval</Text>
        </View>
      )}

      {isLoading
        ? <ActivityIndicator className="mt-10" color="#6366F1" />
        : (
          <FlatList
            data={expenses}
            keyExtractor={i => i.id}
            contentContainerClassName="py-3 px-4 gap-3"
            ListEmptyComponent={<Text className="text-gray-400 text-sm text-center mt-10">No expense claims yet</Text>}
            renderItem={({ item }) => (
              <View className="bg-white rounded-2xl p-4 flex-row items-center gap-3">
                <View className="w-10 h-10 rounded-xl bg-indigo-100 items-center justify-center">
                  <Text className="text-lg">{item.category === 'meals' ? '🍽' : item.category === 'travel' ? '🚗' : '📦'}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-gray-900 font-semibold text-sm capitalize">{item.category}</Text>
                  <Text className="text-gray-500 text-xs" numberOfLines={1}>{item.description}</Text>
                </View>
                <View className="items-end gap-1">
                  <Text className="text-gray-900 font-bold text-sm">R{(item.amount ?? 0).toFixed(2)}</Text>
                  <Badge label={item.status} color={statusColor(item.status)} />
                </View>
              </View>
            )}
          />
        )
      }

      <Modal visible={show} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 bg-white">
          <View className="px-5 py-6 flex-1">
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-gray-900 text-xl font-bold">Claim Expense</Text>
              <TouchableOpacity onPress={() => setShow(false)}><Text className="text-gray-500">Cancel</Text></TouchableOpacity>
            </View>

            <Text className="text-gray-600 text-xs font-medium mb-2 uppercase tracking-wide">Category</Text>
            <View className="flex-row flex-wrap gap-2 mb-4">
              {CATEGORIES.map(c => (
                <TouchableOpacity key={c} onPress={() => setCategory(c)}
                  className={`rounded-xl px-3 py-2 ${category === c ? 'bg-indigo-600' : 'bg-gray-100'}`}>
                  <Text className={`text-sm font-medium capitalize ${category === c ? 'text-white' : 'text-gray-700'}`}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text className="text-gray-600 text-xs font-medium mb-1.5 uppercase tracking-wide">Amount (ZAR)</Text>
            <TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="250.00"
              placeholderTextColor="#9CA3AF" className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm mb-4" />

            <Text className="text-gray-600 text-xs font-medium mb-1.5 uppercase tracking-wide">Description</Text>
            <TextInput value={description} onChangeText={setDescription} placeholder="Petrol to client meeting"
              placeholderTextColor="#9CA3AF" className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm mb-4" />

            <TouchableOpacity onPress={pickReceipt} className="border-2 border-dashed border-gray-200 rounded-xl p-4 items-center mb-6">
              {receiptUri
                ? <Image source={{ uri: receiptUri }} className="w-full h-32 rounded-xl" resizeMode="cover" />
                : <>
                    <Text className="text-3xl mb-2">📷</Text>
                    <Text className="text-gray-500 text-sm">Tap to scan receipt</Text>
                  </>
              }
            </TouchableOpacity>

            <Button label="Submit Claim" onPress={() => submitMutation.mutate()} loading={submitMutation.isPending} />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  )
}
