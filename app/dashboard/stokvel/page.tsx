import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { TopBar } from '@/components/dashboard/TopBar'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { redirect } from 'next/navigation'

type Stokvel = {
  id: string
  tenant_id: string
  name: string
  description: string | null
  contribution_amount: number
  frequency: string
  member_count: number
  total_pool: number
  status: string
  created_at: string
}

type StokvelMember = {
  id: string
  stokvel_id: string
  tenant_id: string
  member_name: string
  phone: string | null
  email: string | null
  contribution_status: string
  joined_at: string
}

function formatZAR(amount: number): string {
  return `R${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function contributionStatusColor(status: string): string {
  switch (status) {
    case 'paid': return 'green'
    case 'pending': return 'yellow'
    case 'overdue': return 'red'
    default: return 'gray'
  }
}

function frequencyLabel(freq: string): string {
  const map: Record<string, string> = {
    weekly: 'Weekly',
    monthly: 'Monthly',
    biweekly: 'Bi-weekly',
    quarterly: 'Quarterly',
  }
  return map[freq] ?? freq
}

export default async function StokvelPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const tenantId = user.user_metadata?.tenant_id as string

  const [stokvelResult, memberResult] = await Promise.all([
    supabaseAdmin
      .from('stokvels')
      .select('id, tenant_id, name, description, contribution_amount, frequency, member_count, total_pool, status, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('stokvel_members')
      .select('id, stokvel_id, tenant_id, member_name, phone, email, contribution_status, joined_at')
      .eq('tenant_id', tenantId)
      .order('joined_at', { ascending: false }),
  ])

  const stokvels = (stokvelResult.data || []) as Stokvel[]
  const allMembers = (memberResult.data || []) as StokvelMember[]

  const activeStorkvels = stokvels.filter((s) => s.status === 'active')
  const totalPool = stokvels.reduce((sum, s) => sum + (s.total_pool || 0), 0)

  // Group members by stokvel
  const membersByStokvel: Record<string, StokvelMember[]> = {}
  for (const m of allMembers) {
    if (!membersByStokvel[m.stokvel_id]) membersByStokvel[m.stokvel_id] = []
    membersByStokvel[m.stokvel_id].push(m)
  }

  return (
    <div>
      <TopBar
        title="Stokvel"
        subtitle={`${activeStorkvels.length} active group${activeStorkvels.length !== 1 ? 's' : ''}`}
      />
      <div className="p-6 space-y-6">

        {/* Summary row */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <p className="text-xs text-gray-500">Active Groups</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{activeStorkvels.length}</p>
          </Card>
          <Card>
            <p className="text-xs text-gray-500">Total Members</p>
            <p className="text-2xl font-bold text-violet-600 mt-1">
              {allMembers.length}
            </p>
          </Card>
          <Card>
            <p className="text-xs text-gray-500">Combined Pool</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{formatZAR(totalPool)}</p>
          </Card>
        </div>

        {stokvels.length === 0 ? (
          <Card>
            <div className="text-center py-14 text-gray-400">
              <p className="text-4xl mb-3">🤝</p>
              <p className="text-sm font-medium text-gray-500 mb-1">No stokvel groups yet</p>
              <p className="text-xs">Create a stokvel to start pooling resources with your community.</p>
            </div>
          </Card>
        ) : (
          stokvels.map((stokvel) => {
            const members = membersByStokvel[stokvel.id] || []
            const paidCount = members.filter((m) => m.contribution_status === 'paid').length
            const overdueCount = members.filter((m) => m.contribution_status === 'overdue').length

            return (
              <Card key={stokvel.id}>
                {/* Stokvel header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-gray-900 text-lg">{stokvel.name}</h3>
                      <Badge variant={stokvel.status === 'active' ? 'green' : 'gray'}>
                        {stokvel.status}
                      </Badge>
                    </div>
                    {stokvel.description && (
                      <p className="text-xs text-gray-400 mt-0.5">{stokvel.description}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-emerald-600">{formatZAR(stokvel.total_pool)}</p>
                    <p className="text-xs text-gray-400">Total pool</p>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500">Contribution</p>
                    <p className="font-bold text-gray-800 text-sm mt-0.5">{formatZAR(stokvel.contribution_amount)}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500">Frequency</p>
                    <p className="font-bold text-gray-800 text-sm mt-0.5">{frequencyLabel(stokvel.frequency)}</p>
                  </div>
                  <div className="bg-emerald-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500">Paid</p>
                    <p className="font-bold text-emerald-700 text-sm mt-0.5">{paidCount} / {members.length}</p>
                  </div>
                  {overdueCount > 0 && (
                    <div className="bg-red-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-red-500">Overdue</p>
                      <p className="font-bold text-red-700 text-sm mt-0.5">{overdueCount}</p>
                    </div>
                  )}
                </div>

                {/* Members list */}
                {members.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      Members ({members.length})
                    </h4>
                    <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                      {members.map((member) => (
                        <div
                          key={member.id}
                          className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg"
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 bg-violet-100 rounded-full flex items-center justify-center text-xs font-bold text-violet-700">
                              {member.member_name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-800">{member.member_name}</p>
                              {(member.phone || member.email) && (
                                <p className="text-xs text-gray-400">{member.phone || member.email}</p>
                              )}
                            </div>
                          </div>
                          <Badge variant={contributionStatusColor(member.contribution_status) as 'green' | 'yellow' | 'red' | 'gray'}>
                            {member.contribution_status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {members.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-3">No members added yet.</p>
                )}
              </Card>
            )
          })
        )}

      </div>
    </div>
  )
}
