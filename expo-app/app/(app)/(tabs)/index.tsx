import type { ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { api } from '@/lib/api'
import { useMe } from '@/hooks/useMe'
import { can, isManager } from '@/store/session'
import { zar, monthName, greeting, relative } from '@/lib/format'
import type { Announcement } from '@/lib/types'
import { Screen, Card, SectionTitle, EmptyState, ErrorState, Loading, C } from '@/components/ui'

function Decision({ icon, tone, title, detail, onPress }: {
  icon: keyof typeof Ionicons.glyphMap
  tone: string
  title: string
  detail: string
  onPress: () => void
}) {
  return (
    <Card onPress={onPress} className="flex-row items-center gap-3">
      <View className="w-10 h-10 rounded-xl items-center justify-center" style={{ backgroundColor: `${tone}26` }}>
        <Ionicons name={icon} size={20} color={tone} />
      </View>
      <View className="flex-1">
        <Text className="text-white text-base font-semibold">{title}</Text>
        <Text className="text-slate-400 text-sm">{detail}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={C.dim} />
    </Card>
  )
}

function Stat({ label, value, onPress }: { label: string; value: string; onPress?: () => void }) {
  return (
    <Card onPress={onPress} className="flex-1">
      <Text className="text-slate-400 text-xs">{label}</Text>
      <Text className="text-white text-xl font-bold mt-1">{value}</Text>
    </Card>
  )
}

export default function HomeScreen() {
  const meQ = useMe()
  const me = meQ.data
  const announcements = useQuery({
    queryKey: ['announcements'],
    queryFn: () => api.get<Announcement[]>('/api/announcements'),
    enabled: Boolean(me),
  })

  const refresh = () => { meQ.refetch(); announcements.refetch() }

  if (!me) {
    return (
      <Screen title="AdminOS">
        {meQ.error ? <ErrorState error={meQ.error} onRetry={() => meQ.refetch()} /> : <Loading />}
      </Screen>
    )
  }

  const first = (me.staff?.fullName ?? me.user.name ?? '').split(' ')[0]
  const d = me.decisions
  const manager = isManager(me)
  const decisions: ReactNode[] = []
  if (d.leaveToApprove) decisions.push(<Decision key="leave" icon="sunny" tone="#818CF8" title={`${d.leaveToApprove} leave request${d.leaveToApprove === 1 ? '' : 's'}`} detail="Waiting for your approval" onPress={() => router.push('/approvals')} />)
  if (d.expensesToApprove) decisions.push(<Decision key="exp" icon="receipt" tone="#FBBF24" title={`${d.expensesToApprove} expense claim${d.expensesToApprove === 1 ? '' : 's'}`} detail="Waiting for your approval" onPress={() => router.push('/approvals')} />)
  if (d.money && d.money.overdueCount > 0) decisions.push(<Decision key="money" icon="alert-circle" tone="#F87171" title={`${zar(d.money.overdue)} overdue`} detail={`${d.money.overdueCount} invoice${d.money.overdueCount === 1 ? '' : 's'} past due`} onPress={() => router.push('/invoices')} />)
  if (d.escalatedConversations) decisions.push(<Decision key="inbox" icon="chatbubbles" tone="#34D399" title={`${d.escalatedConversations} customer${d.escalatedConversations === 1 ? '' : 's'} need you`} detail="Conversations the AI handed over" onPress={() => router.push('/inbox')} />)

  const unread = (announcements.data ?? []).filter((a) => !a.is_read).slice(0, 2)

  return (
    <Screen
      title={`${greeting()}${first ? `, ${first}` : ''}`}
      subtitle={me.tenant.name ?? undefined}
      right={
        <Pressable
          onPress={() => router.push('/notifications')}
          accessibilityRole="button"
          accessibilityLabel="Notifications"
          hitSlop={8}
          className="w-10 h-10 rounded-full bg-white/10 items-center justify-center active:bg-white/20"
        >
          <Ionicons name="notifications-outline" size={20} color="#fff" />
        </Pressable>
      }
      refreshing={meQ.isRefetching}
      onRefresh={refresh}
    >
      {manager && (
        <>
          <SectionTitle>Needs a decision</SectionTitle>
          {decisions.length ? decisions : (
            <Card className="flex-row items-center gap-3">
              <Ionicons name="checkmark-circle" size={22} color={C.success} />
              <Text className="text-slate-300 flex-1">You’re all caught up — nothing is waiting on you.</Text>
            </Card>
          )}
          {(d.money || d.health) && (
            <View className="flex-row gap-3">
              {d.money ? <Stat label="Owed to you" value={zar(d.money.owed)} onPress={can(me, 'manage_invoices') ? () => router.push('/invoices') : undefined} /> : null}
              {d.health ? <Stat label="Business health" value={`${Math.round(d.health.overall_score)}/100`} /> : null}
            </View>
          )}
        </>
      )}

      {me.staff ? (
        <>
          <SectionTitle>My day</SectionTitle>
          <View className="flex-row gap-3">
            <Stat label="Open tasks" value={String(me.mine.openTasks ?? 0)} onPress={() => router.push('/tasks')} />
            <Stat label="Leave left" value={`${me.staff.leave.remaining} d`} onPress={() => router.push('/leave')} />
          </View>
          <View className="flex-row gap-3">
            <Card onPress={() => router.push('/clock')} className="flex-1 flex-row items-center gap-2">
              <Ionicons name="time" size={20} color={C.brand} />
              <Text className="text-white font-semibold">Clock in / out</Text>
            </Card>
            {me.mine.latestPayslip ? (
              <Card onPress={() => router.push('/pay')} className="flex-1">
                <Text className="text-slate-400 text-xs">
                  {monthName(me.mine.latestPayslip.payroll_run.period_month)} pay
                </Text>
                <Text className="text-white text-lg font-bold">{zar(me.mine.latestPayslip.net)}</Text>
              </Card>
            ) : null}
          </View>
          {me.mine.pendingLeave ? (
            <Text className="text-slate-400 text-sm">{me.mine.pendingLeave} leave request{me.mine.pendingLeave === 1 ? '' : 's'} waiting for approval.</Text>
          ) : null}
        </>
      ) : !manager ? (
        <EmptyState
          icon="link-outline"
          title="Your login isn’t linked yet"
          body="Ask your employer to send you an app invite from your staff profile. Entering that code links your payslips, leave and clock-in to this login."
        />
      ) : null}

      {unread.length > 0 && (
        <>
          <SectionTitle>Announcements</SectionTitle>
          {unread.map((a) => (
            <Card key={a.id} onPress={() => router.push('/announcements')}>
              <Text className="text-white font-semibold" numberOfLines={1}>{a.title}</Text>
              <Text className="text-slate-400 text-sm mt-1" numberOfLines={2}>{a.body}</Text>
              <Text className="text-slate-500 text-xs mt-2">{relative(a.published_at ?? a.created_at)}</Text>
            </Card>
          ))}
        </>
      )}
    </Screen>
  )
}
