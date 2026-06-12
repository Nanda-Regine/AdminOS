import { ScrollView, View, Text, TouchableOpacity, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

export default function MyAdminHome() {
  const { tenantId, staffId, user } = useAuthStore()
  const name = user?.user_metadata?.full_name?.split(' ')[0] ?? 'there'

  const { data, refetch, isRefetching } = useQuery({
    queryKey: ['my-admin-home', staffId],
    queryFn: async () => {
      const [tasks, leaves, payslips, announcements] = await Promise.all([
        supabase.from('tasks').select('id, title, status, due_date').eq('assigned_to', staffId!).eq('status', 'pending').limit(5),
        supabase.from('leave_requests').select('id, type, status, start_date, end_date').eq('staff_id', staffId!).eq('status', 'pending').limit(3),
        supabase.from('payslips').select('id, period_end, net_pay, status').eq('staff_id', staffId!).order('period_end', { ascending: false }).limit(1),
        supabase.from('announcements').select('id, title, created_at').eq('tenant_id', tenantId!).order('created_at', { ascending: false }).limit(3),
      ])
      return {
        tasks: tasks.data ?? [],
        leaves: leaves.data ?? [],
        latestPayslip: payslips.data?.[0] ?? null,
        announcements: announcements.data ?? [],
      }
    },
    enabled: !!staffId,
  })

  const quickLinks = [
    { label: '⏱ Clock In/Out', route: '/clock' },
    { label: '🌴 Apply Leave', route: '/leave' },
    { label: '🧾 Claim Expense', route: '/expenses' },
    { label: '💰 My Payslip', route: '/pay' },
  ] as const

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        {/* Header */}
        <View className="bg-navy-900 px-5 pt-4 pb-8">
          <Text className="text-gray-400 text-sm">Welcome back,</Text>
          <Text className="text-white text-2xl font-bold">{name}</Text>
        </View>

        <View className="px-4 -mt-4 space-y-4 pb-8">
          {/* Quick links */}
          <Card>
            <View className="flex-row flex-wrap gap-2.5">
              {quickLinks.map(l => (
                <TouchableOpacity
                  key={l.label}
                  onPress={() => router.push(l.route as any)}
                  className="flex-1 min-w-[44%] bg-indigo-50 rounded-xl px-3 py-3 items-center"
                >
                  <Text className="text-indigo-700 font-medium text-sm text-center">{l.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Card>

          {/* Latest payslip */}
          {data?.latestPayslip && (
            <Card>
              <Text className="text-xs text-gray-500 font-medium mb-2 uppercase tracking-wide">Latest Pay</Text>
              <View className="flex-row items-center justify-between">
                <View>
                  <Text className="text-gray-900 font-bold text-xl">
                    R{(data.latestPayslip.net_pay ?? 0).toLocaleString('en-ZA')}
                  </Text>
                  <Text className="text-gray-500 text-xs mt-0.5">
                    {data.latestPayslip.period_end ? new Date(data.latestPayslip.period_end).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' }) : ''}
                  </Text>
                </View>
                <Badge label={data.latestPayslip.status ?? 'ready'} color="green" />
              </View>
            </Card>
          )}

          {/* My tasks */}
          {(data?.tasks?.length ?? 0) > 0 && (
            <Card>
              <Text className="text-xs text-gray-500 font-medium mb-3 uppercase tracking-wide">My Tasks</Text>
              <View className="space-y-2">
                {data?.tasks.map(t => (
                  <View key={t.id} className="flex-row items-center justify-between py-1">
                    <Text className="text-gray-800 text-sm flex-1 mr-2" numberOfLines={1}>{t.title}</Text>
                    {t.due_date && (
                      <Text className="text-gray-400 text-xs">{new Date(t.due_date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}</Text>
                    )}
                  </View>
                ))}
              </View>
            </Card>
          )}

          {/* Announcements */}
          {(data?.announcements?.length ?? 0) > 0 && (
            <Card>
              <Text className="text-xs text-gray-500 font-medium mb-3 uppercase tracking-wide">Announcements</Text>
              <View className="space-y-2">
                {data?.announcements.map(a => (
                  <View key={a.id} className="flex-row items-center gap-2 py-1">
                    <Text className="text-gray-400 text-lg">📣</Text>
                    <Text className="text-gray-800 text-sm flex-1" numberOfLines={2}>{a.title}</Text>
                  </View>
                ))}
              </View>
            </Card>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
