import { useState } from 'react'
import {
  FlatList, View, Text, TouchableOpacity, Modal, TextInput,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import { ScreenHeader } from '@/components/layout/ScreenHeader'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'

const LEAVE_TYPES = ['annual', 'sick', 'family_responsibility', 'maternity', 'unpaid'] as const
type LeaveType = typeof LEAVE_TYPES[number]

function statusColor(s: string) {
  if (s === 'approved') return 'green' as const
  if (s === 'rejected') return 'red' as const
  return 'yellow' as const
}

export default function LeaveScreen() {
  const { staffId, tenantId } = useAuthStore()
  const qc = useQueryClient()
  const [show, setShow] = useState(false)
  const [type, setType] = useState<LeaveType>('annual')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')

  const { data: leaves = [], isLoading } = useQuery({
    queryKey: ['leaves', staffId],
    queryFn: async () => {
      const { data } = await supabase
        .from('leave_requests')
        .select('id, type, status, start_date, end_date, reason, created_at')
        .eq('staff_id', staffId!)
        .order('created_at', { ascending: false })
      return data ?? []
    },
    enabled: !!staffId,
  })

  const applyMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('leave_requests').insert({
        staff_id: staffId,
        tenant_id: tenantId,
        type,
        start_date: startDate,
        end_date: endDate,
        reason,
        status: 'pending',
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leaves', staffId] })
      setShow(false)
      setStartDate(''); setEndDate(''); setReason('')
    },
    onError: (e: Error) => Alert.alert('Error', e.message),
  })

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      <ScreenHeader
        title="Leave"
        right={
          <TouchableOpacity onPress={() => setShow(true)} className="bg-brand rounded-xl px-4 py-2">
            <Text className="text-white font-semibold text-sm">+ Apply</Text>
          </TouchableOpacity>
        }
      />

      {isLoading
        ? <ActivityIndicator className="mt-10" color="#6366F1" />
        : (
          <FlatList
            data={leaves}
            keyExtractor={i => i.id}
            contentContainerClassName="py-3 px-4 gap-3"
            ListEmptyComponent={<Text className="text-gray-400 text-sm text-center mt-10">No leave applications yet</Text>}
            renderItem={({ item }) => (
              <View className="bg-white rounded-2xl p-4">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-gray-900 font-semibold capitalize">{item.type.replace('_', ' ')}</Text>
                  <Badge label={item.status} color={statusColor(item.status)} />
                </View>
                <Text className="text-gray-500 text-sm">
                  {new Date(item.start_date).toLocaleDateString('en-ZA')} – {new Date(item.end_date).toLocaleDateString('en-ZA')}
                </Text>
                {item.reason && <Text className="text-gray-500 text-xs mt-1 italic">"{item.reason}"</Text>}
              </View>
            )}
          />
        )
      }

      <Modal visible={show} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 bg-white">
          <View className="px-5 py-6 flex-1">
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-gray-900 text-xl font-bold">Apply for Leave</Text>
              <TouchableOpacity onPress={() => setShow(false)}><Text className="text-gray-500">Cancel</Text></TouchableOpacity>
            </View>

            <Text className="text-gray-600 text-xs font-medium mb-2 uppercase tracking-wide">Leave Type</Text>
            <View className="flex-row flex-wrap gap-2 mb-4">
              {LEAVE_TYPES.map(t => (
                <TouchableOpacity
                  key={t}
                  onPress={() => setType(t)}
                  className={`rounded-xl px-3 py-2 ${type === t ? 'bg-indigo-600' : 'bg-gray-100'}`}
                >
                  <Text className={`text-sm font-medium capitalize ${type === t ? 'text-white' : 'text-gray-700'}`}>
                    {t.replace('_', ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View className="flex-row gap-3 mb-4">
              <View className="flex-1">
                <Text className="text-gray-600 text-xs font-medium mb-1.5 uppercase tracking-wide">Start Date</Text>
                <TextInput
                  value={startDate}
                  onChangeText={setStartDate}
                  placeholder="2026-07-01"
                  placeholderTextColor="#9CA3AF"
                  className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm"
                />
              </View>
              <View className="flex-1">
                <Text className="text-gray-600 text-xs font-medium mb-1.5 uppercase tracking-wide">End Date</Text>
                <TextInput
                  value={endDate}
                  onChangeText={setEndDate}
                  placeholder="2026-07-05"
                  placeholderTextColor="#9CA3AF"
                  className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm"
                />
              </View>
            </View>

            <Text className="text-gray-600 text-xs font-medium mb-1.5 uppercase tracking-wide">Reason (optional)</Text>
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder="Brief explanation…"
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={3}
              className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm mb-6"
              style={{ height: 80, textAlignVertical: 'top' }}
            />

            <Button label="Submit Application" onPress={() => applyMutation.mutate()} loading={applyMutation.isPending} />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  )
}
