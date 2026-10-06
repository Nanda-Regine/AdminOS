import { Text, View } from 'react-native'
import { router } from 'expo-router'
import { usePayslips } from '@/hooks/usePayslips'
import { useMe } from '@/hooks/useMe'
import { zar, monthName } from '@/lib/format'
import { Screen, Card, EmptyState, QueryView } from '@/components/ui'

export default function PayScreen() {
  const { data: me } = useMe()
  const staffId = me?.staff?.id
  const q = usePayslips(staffId)

  if (me && !staffId) {
    return (
      <Screen title="Pay">
        <EmptyState icon="link-outline" title="No staff record linked" body="Ask your employer to send you an app invite so your payslips are linked to this login." />
      </Screen>
    )
  }

  return (
    <Screen title="Pay" subtitle="Your payslips" refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      <QueryView
        query={q}
        isEmpty={(d) => d.length === 0}
        empty={<EmptyState icon="wallet-outline" title="No payslips yet" body="Your payslips appear here once your employer has paid a payroll run." />}
      >
        {(slips) => (
          <>
            {slips.map((p, i) => (
              <Card key={p.id} onPress={() => router.push({ pathname: '/payslip/[id]', params: { id: p.id } })}>
                <View className="flex-row justify-between items-center">
                  <View>
                    <Text className="text-white text-base font-semibold">
                      {monthName(p.payroll_run.period_month)} {p.payroll_run.period_year}
                    </Text>
                    <Text className="text-slate-400 text-xs mt-0.5">Gross {zar(p.gross)}</Text>
                  </View>
                  <View className="items-end">
                    <Text className={`font-bold ${i === 0 ? 'text-xl text-white' : 'text-base text-slate-200'}`}>{zar(p.net)}</Text>
                    <Text className="text-slate-500 text-xs">take-home</Text>
                  </View>
                </View>
              </Card>
            ))}
            <Text className="text-slate-500 text-xs text-center mt-2">
              Payslips aren’t stored on this phone — they load from AdminOS each time.
            </Text>
          </>
        )}
      </QueryView>
    </Screen>
  )
}
