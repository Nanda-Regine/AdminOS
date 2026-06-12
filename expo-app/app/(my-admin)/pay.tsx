import { FlatList, View, Text, TouchableOpacity, Linking, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import { ScreenHeader } from '@/components/layout/ScreenHeader'
import { Badge } from '@/components/ui/Badge'

function formatZAR(n: number | null) {
  return `R ${(n ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`
}

export default function PayScreen() {
  const { staffId } = useAuthStore()

  const { data: payslips = [], isLoading } = useQuery({
    queryKey: ['payslips', staffId],
    queryFn: async () => {
      const { data } = await supabase
        .from('payslips')
        .select('id, period_start, period_end, gross_pay, net_pay, deductions, status, pdf_url')
        .eq('staff_id', staffId!)
        .order('period_end', { ascending: false })
      return data ?? []
    },
    enabled: !!staffId,
  })

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      <ScreenHeader title="My Pay" subtitle="Payslip history" />

      {isLoading
        ? <ActivityIndicator className="mt-10" color="#6366F1" />
        : (
          <FlatList
            data={payslips}
            keyExtractor={i => i.id}
            contentContainerClassName="py-3 px-4 gap-3"
            ListHeaderComponent={
              payslips[0] ? (
                <View className="bg-navy-900 rounded-2xl p-5 mb-1">
                  <Text className="text-gray-400 text-xs mb-1">Latest Net Pay</Text>
                  <Text className="text-white text-3xl font-bold">{formatZAR(payslips[0].net_pay)}</Text>
                  <Text className="text-gray-400 text-sm mt-1">
                    {new Date(payslips[0].period_end ?? '').toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })}
                  </Text>
                </View>
              ) : null
            }
            ListEmptyComponent={<Text className="text-gray-400 text-sm text-center mt-10">No payslips yet</Text>}
            renderItem={({ item }) => (
              <View className="bg-white rounded-2xl p-4">
                <View className="flex-row items-center justify-between mb-3">
                  <Text className="text-gray-900 font-semibold">
                    {new Date(item.period_end ?? '').toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })}
                  </Text>
                  <Badge label={item.status ?? 'ready'} color="green" />
                </View>
                <View className="flex-row justify-between text-sm">
                  <View>
                    <Text className="text-gray-500 text-xs">Gross</Text>
                    <Text className="text-gray-800 font-medium">{formatZAR(item.gross_pay)}</Text>
                  </View>
                  <View>
                    <Text className="text-gray-500 text-xs">Deductions</Text>
                    <Text className="text-red-600 font-medium">-{formatZAR(item.deductions)}</Text>
                  </View>
                  <View>
                    <Text className="text-gray-500 text-xs">Net</Text>
                    <Text className="text-emerald-700 font-bold">{formatZAR(item.net_pay)}</Text>
                  </View>
                </View>
                {item.pdf_url && (
                  <TouchableOpacity
                    onPress={() => Linking.openURL(item.pdf_url!)}
                    className="mt-3 border border-indigo-200 rounded-xl py-2.5 items-center"
                  >
                    <Text className="text-brand font-medium text-sm">📄 Download PDF</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          />
        )
      }
    </SafeAreaView>
  )
}
