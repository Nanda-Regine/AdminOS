import { Text, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { useMe } from '@/hooks/useMe'
import { zar, monthName } from '@/lib/format'
import { Screen, Card, Row, Divider, EmptyState, QueryView } from '@/components/ui'
import { usePayslips } from '@/hooks/usePayslips'

export default function PayslipScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { data: me } = useMe()
  const q = usePayslips(me?.staff?.id)

  return (
    <Screen title="Payslip" back>
      <QueryView query={q}>
        {(slips) => {
          const p = slips.find((s) => s.id === id)
          if (!p) return <EmptyState icon="document-outline" title="Payslip not found" body="It may have been replaced by a corrected payslip. Go back and pull to refresh." />
          const paye = Number(p.paye ?? 0)
          const uif = Number(p.uif ?? 0)
          const other = Number(p.deductions ?? 0)
          return (
            <>
              <Card className="items-center py-6">
                <Text className="text-slate-400">{monthName(p.payroll_run.period_month)} {p.payroll_run.period_year}</Text>
                <Text className="text-white text-4xl font-extrabold mt-1">{zar(p.net)}</Text>
                <Text className="text-slate-500 text-xs mt-1">Take-home pay</Text>
              </Card>
              <Card>
                <Row label="Gross pay" value={zar(p.gross)} strong />
                <Divider />
                <Row label="PAYE (income tax)" value={`− ${zar(paye)}`} />
                <Row label="UIF (1%)" value={`− ${zar(uif)}`} />
                {other > 0 && <Row label="Other deductions" value={`− ${zar(other)}`} />}
                <Divider />
                <Row label="Net pay" value={zar(p.net)} strong />
              </Card>
              <View className="px-1">
                <Text className="text-slate-500 text-xs leading-5">
                  Questions about this payslip? Speak to your employer’s payroll person. Your employer keeps the official
                  record and can give you a printed copy or IRP5 on request.
                </Text>
              </View>
            </>
          )
        }}
      </QueryView>
    </Screen>
  )
}
