import { Fragment, type ReactNode } from 'react'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useMe } from '@/hooks/useMe'
import { can, isManager } from '@/store/session'
import { Screen, Card, ListRow, Divider, SectionTitle, Loading } from '@/components/ui'

type Item = { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle?: string; href: string; show: boolean }

function Section({ title, items }: { title: string; items: Item[] }) {
  const visible = items.filter((i) => i.show)
  if (!visible.length) return null
  return (
    <>
      <SectionTitle>{title}</SectionTitle>
      <Card className="py-1">
        {visible.map((i, idx): ReactNode => (
          <Fragment key={i.href}>
            {idx > 0 && <Divider />}
            <ListRow icon={i.icon} title={i.title} subtitle={i.subtitle} onPress={() => router.push(i.href as never)} />
          </Fragment>
        ))}
      </Card>
    </>
  )
}

export default function MoreScreen() {
  const { data: me } = useMe()
  if (!me) return <Screen title="More"><Loading /></Screen>
  const manager = isManager(me)
  const linked = Boolean(me.staff)

  return (
    <Screen title="More" subtitle={me.tenant.name ?? undefined}>
      <Section title="My work" items={[
        { icon: 'time-outline', title: 'Clock in / out', href: '/clock', show: linked && manager },
        { icon: 'sunny-outline', title: 'My leave', href: '/leave', show: linked && manager },
        { icon: 'wallet-outline', title: 'My payslips', href: '/pay', show: linked && manager },
        { icon: 'checkbox-outline', title: 'My tasks', href: '/tasks', show: linked },
        { icon: 'receipt-outline', title: 'Expense claims', href: '/expenses', show: linked },
        { icon: 'folder-outline', title: 'My documents', href: '/documents', show: linked },
      ]} />
      <Section title="Business" items={[
        { icon: 'document-text-outline', title: 'Invoices', subtitle: 'Who owes you, record payments', href: '/invoices', show: can(me, 'manage_invoices') || can(me, 'view_financials') },
        { icon: 'sparkles-outline', title: 'Ask Langa', subtitle: 'Your AI business advisor', href: '/langa', show: can(me, 'view_analytics') },
      ]} />
      <Section title="Company" items={[
        { icon: 'megaphone-outline', title: 'Announcements', href: '/announcements', show: true },
        { icon: 'book-outline', title: 'Handbook', subtitle: 'Policies and procedures', href: '/handbook', show: true },
        { icon: 'people-outline', title: 'Team', href: '/team', show: true },
      ]} />
      <Section title="You" items={[
        { icon: 'notifications-outline', title: 'Notifications', href: '/notifications', show: true },
        { icon: 'person-circle-outline', title: 'Account & security', href: '/account', show: true },
      ]} />
    </Screen>
  )
}
