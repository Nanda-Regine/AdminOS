import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { TopBar } from '@/components/dashboard/TopBar'
import { SectionBackground } from '@/components/dashboard/SectionBackground'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { redirect } from 'next/navigation'
import { CreateStokvelModal, AddMemberModal } from './StokvelActions'

// Real schema (verified against prod):
//   stokvel_groups(id, name, rules, contribution_amount, frequency, status, created_at)
//   stokvel_members(id, group_id, name, phone, payout_position, joined_at)
//   stokvel_contributions(group_id, member_id, amount, status, period_month, period_year)
// The page previously read a non-existent `stokvels` table + `stokvel_members`
// columns that don't exist (stokvel_id/member_name/email/contribution_status), so
// it always rendered empty. member contribution status + pool are derived from
// stokvel_contributions.

type Group = {
  id: string
  name: string
  rules: string | null
  contribution_amount: number
  frequency: string
  status: string
  created_at: string
}

type MemberRow = {
  id: string
  group_id: string
  name: string
  phone: string | null
  payout_position: number | null
  joined_at: string
}

type ContributionRow = {
  group_id: string
  member_id: string
  amount: number
  status: string
  period_month: number
  period_year: number
}

type EnrichedMember = MemberRow & { contribution_status: string }

function formatZAR(amount: number): string {
  return `R${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function contributionStatusColor(status: string): 'green' | 'yellow' | 'red' | 'gray' {
  switch (status) {
    case 'paid': return 'green'
    case 'pending': return 'yellow'
    case 'overdue': return 'red'
    default: return 'gray'
  }
}

function frequencyLabel(freq: string): string {
  const map: Record<string, string> = {
    weekly: 'Weekly', monthly: 'Monthly', biweekly: 'Bi-weekly', quarterly: 'Quarterly',
  }
  return map[freq] ?? freq
}

export default async function StokvelPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const tenantId = user.app_metadata?.tenant_id as string

  const [groupResult, memberResult] = await Promise.all([
    supabaseAdmin
      .from('stokvel_groups')
      .select('id, name, rules, contribution_amount, frequency, status, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('stokvel_members')
      .select('id, group_id, name, phone, payout_position, joined_at')
      .eq('tenant_id', tenantId)
      .order('joined_at', { ascending: false }),
  ])

  const groups = (groupResult.data || []) as Group[]
  const members = (memberResult.data || []) as MemberRow[]

  // stokvel_contributions has no tenant_id column — scope it by the tenant's
  // group ids instead (groups are already tenant-filtered above).
  const groupIds = groups.map(g => g.id)
  const { data: contribData } = groupIds.length
    ? await supabaseAdmin
        .from('stokvel_contributions')
        .select('group_id, member_id, amount, status, period_month, period_year')
        .in('group_id', groupIds)
    : { data: [] }
  const contributions = (contribData || []) as ContributionRow[]

  // Latest contribution per member → their current status.
  const latestByMember: Record<string, ContributionRow> = {}
  for (const c of contributions) {
    const prev = latestByMember[c.member_id]
    if (!prev || c.period_year > prev.period_year || (c.period_year === prev.period_year && c.period_month > prev.period_month)) {
      latestByMember[c.member_id] = c
    }
  }

  // Paid pool per group = sum of all paid contributions.
  const poolByGroup: Record<string, number> = {}
  for (const c of contributions) {
    if (c.status === 'paid') poolByGroup[c.group_id] = (poolByGroup[c.group_id] ?? 0) + Number(c.amount || 0)
  }

  const membersByGroup: Record<string, EnrichedMember[]> = {}
  for (const m of members) {
    ;(membersByGroup[m.group_id] ??= []).push({
      ...m,
      contribution_status: latestByMember[m.id]?.status ?? 'pending',
    })
  }

  const activeGroups = groups.filter(g => g.status === 'active')
  const totalPool = groups.reduce((sum, g) => sum + (poolByGroup[g.id] ?? 0), 0)

  return (
    <div>
      <SectionBackground />
      <TopBar
        title="Stokvel"
        subtitle={`${activeGroups.length} active group${activeGroups.length !== 1 ? 's' : ''}`}
        actions={<CreateStokvelModal />}
      />
      <div className="p-6 space-y-6">

        {/* Summary row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <p className="text-xs text-[var(--text-muted)]">Active Groups</p>
            <p className="text-2xl font-bold text-[var(--text-primary)] mt-1">{activeGroups.length}</p>
          </Card>
          <Card>
            <p className="text-xs text-[var(--text-muted)]">Total Members</p>
            <p className="text-2xl font-bold text-violet-400 mt-1">{members.length}</p>
          </Card>
          <Card>
            <p className="text-xs text-[var(--text-muted)]">Combined Pool</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1">{formatZAR(totalPool)}</p>
          </Card>
        </div>

        {groups.length === 0 ? (
          <Card>
            <div className="text-center py-14 text-[var(--text-dim)]">
              <p className="text-4xl mb-3">🤝</p>
              <p className="text-sm font-medium text-[var(--text-muted)] mb-1">No stokvel groups yet</p>
              <p className="text-xs">Create a stokvel to start pooling resources with your community.</p>
            </div>
          </Card>
        ) : (
          groups.map((group) => {
            const groupMembers = membersByGroup[group.id] || []
            const paidCount = groupMembers.filter(m => m.contribution_status === 'paid').length
            const overdueCount = groupMembers.filter(m => m.contribution_status === 'overdue').length
            const pool = poolByGroup[group.id] ?? 0

            return (
              <Card key={group.id}>
                {/* Group header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-[var(--text-primary)] text-lg">{group.name}</h3>
                      <Badge variant={group.status === 'active' ? 'green' : 'gray'}>{group.status}</Badge>
                    </div>
                    {group.rules && (
                      <p className="text-xs text-[var(--text-dim)] mt-0.5">{group.rules}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-emerald-400">{formatZAR(pool)}</p>
                    <p className="text-xs text-[var(--text-dim)]">Total pool</p>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                  <div className="bg-[var(--surface-2)] rounded-lg p-3 text-center">
                    <p className="text-xs text-[var(--text-muted)]">Contribution</p>
                    <p className="font-bold text-[var(--text-secondary)] text-sm mt-0.5">{formatZAR(group.contribution_amount)}</p>
                  </div>
                  <div className="bg-[var(--surface-2)] rounded-lg p-3 text-center">
                    <p className="text-xs text-[var(--text-muted)]">Frequency</p>
                    <p className="font-bold text-[var(--text-secondary)] text-sm mt-0.5">{frequencyLabel(group.frequency)}</p>
                  </div>
                  <div className="rounded-lg p-3 text-center" style={{ background: 'rgba(34,197,94,0.10)' }}>
                    <p className="text-xs text-[var(--text-muted)]">Paid</p>
                    <p className="font-bold text-sm mt-0.5" style={{ color: '#34D399' }}>{paidCount} / {groupMembers.length}</p>
                  </div>
                  {overdueCount > 0 && (
                    <div className="rounded-lg p-3 text-center" style={{ background: 'rgba(239,68,68,0.10)' }}>
                      <p className="text-xs" style={{ color: '#F87171' }}>Overdue</p>
                      <p className="font-bold text-sm mt-0.5" style={{ color: '#F87171' }}>{overdueCount}</p>
                    </div>
                  )}
                </div>

                {/* Members list */}
                {groupMembers.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2">
                      Members ({groupMembers.length})
                    </h4>
                    <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                      {groupMembers.map((member) => (
                        <div key={member.id} className="flex items-center justify-between px-3 py-2 bg-[var(--surface-2)] rounded-lg">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                              style={{ background: 'rgba(139,92,246,0.20)', color: '#C4B5FD' }}>
                              {member.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-[var(--text-secondary)]">{member.name}</p>
                              {member.phone && <p className="text-xs text-[var(--text-dim)]">{member.phone}</p>}
                            </div>
                          </div>
                          <Badge variant={contributionStatusColor(member.contribution_status)}>
                            {member.contribution_status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {groupMembers.length === 0 && (
                  <p className="text-xs text-[var(--text-dim)] text-center py-3">No members added yet.</p>
                )}

                <AddMemberModal stokvelId={group.id} />
              </Card>
            )
          })
        )}

      </div>
    </div>
  )
}
