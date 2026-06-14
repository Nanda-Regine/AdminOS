import { ScrollView, View, Text, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import { Card } from '@/components/ui/Card'
import { ScreenHeader } from '@/components/layout/ScreenHeader'
import { useOfflineFriendlyQuery } from '@/hooks/useOfflineFriendlyQuery'
import { STALE } from '@/lib/cacheWarmer'

function HealthRing({ score }: { score: number }) {
  const color = score >= 75 ? '#10B981' : score >= 50 ? '#F59E0B' : '#EF4444'
  return (
    <View className="items-center">
      <View
        className="w-28 h-28 rounded-full items-center justify-center border-8"
        style={{ borderColor: color }}
      >
        <Text className="text-3xl font-bold text-white">{score}</Text>
        <Text className="text-gray-400 text-xs">/ 100</Text>
      </View>
      <Text className="text-gray-400 text-sm mt-2">Business Health</Text>
    </View>
  )
}

export default function OwnerDashboard() {
  const { tenantId, user } = useAuthStore()

  const { data: healthScore, isLoading: loadingHealth, refetch, isRefetching } = useOfflineFriendlyQuery({
    queryKey: ['health-score', tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from('health_scores')
        .select('score, dimensions')
        .eq('tenant_id', tenantId!)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      return data
    },
    enabled: !!tenantId,
    staleTime: STALE.healthScore,
  })

  const { data: stats } = useOfflineFriendlyQuery({
    queryKey: ['owner-stats', tenantId],
    queryFn: async () => {
      const [invoices, conversations, tasks] = await Promise.all([
        supabase.from('invoices').select('id, total_amount, status').eq('tenant_id', tenantId!),
        supabase.from('conversations').select('id, status').eq('tenant_id', tenantId!),
        supabase.from('tasks').select('id, status').eq('tenant_id', tenantId!),
      ])
      const overdueInvoices = (invoices.data ?? []).filter(i => i.status === 'overdue')
      const overdueAmount = overdueInvoices.reduce((s, i) => s + (i.total_amount ?? 0), 0)
      const openConvs = (conversations.data ?? []).filter(c => c.status === 'open').length
      const pendingTasks = (tasks.data ?? []).filter(t => t.status === 'pending' || t.status === 'in_progress').length
      return { overdueAmount, openConvs, pendingTasks, overdueCount: overdueInvoices.length }
    },
    enabled: !!tenantId,
    staleTime: STALE.invoices,
  })

  const name = user?.user_metadata?.full_name?.split(' ')[0] ?? 'there'

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['bottom']}>
      <ScreenHeader title={`Hey ${name} 👋`} subtitle="Business overview" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >

        <View className="px-4 pt-4 space-y-4 pb-8">
          {/* Health Ring Card */}
          <Card className="items-center py-6">
            {loadingHealth
              ? <ActivityIndicator color="#6366F1" />
              : <HealthRing score={healthScore?.score ?? 72} />
            }
          </Card>

          {/* KPI Row */}
          <View className="flex-row gap-3">
            <Card className="flex-1">
              <Text className="text-2xl font-bold text-red-600">
                R{((stats?.overdueAmount ?? 0) / 1000).toFixed(0)}k
              </Text>
              <Text className="text-gray-500 text-xs mt-1">Overdue ({stats?.overdueCount ?? 0})</Text>
            </Card>
            <Card className="flex-1">
              <Text className="text-2xl font-bold text-indigo-600">{stats?.openConvs ?? 0}</Text>
              <Text className="text-gray-500 text-xs mt-1">Open chats</Text>
            </Card>
            <Card className="flex-1">
              <Text className="text-2xl font-bold text-amber-600">{stats?.pendingTasks ?? 0}</Text>
              <Text className="text-gray-500 text-xs mt-1">Tasks due</Text>
            </Card>
          </View>

          {/* Quick actions */}
          <Card>
            <Text className="text-sm font-semibold text-gray-700 mb-3">Quick actions</Text>
            <View className="flex-row flex-wrap gap-2">
              {[
                { label: '+ Invoice', color: 'bg-indigo-100', text: 'text-indigo-700' },
                { label: 'Send brief', color: 'bg-purple-100', text: 'text-purple-700' },
                { label: 'View reports', color: 'bg-emerald-100', text: 'text-emerald-700' },
                { label: 'Run payroll', color: 'bg-amber-100', text: 'text-amber-700' },
              ].map(a => (
                <TouchableOpacity key={a.label} className={`rounded-xl px-4 py-2 ${a.color}`}>
                  <Text className={`text-sm font-medium ${a.text}`}>{a.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
