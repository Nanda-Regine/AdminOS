import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { TopBar } from '@/components/dashboard/TopBar'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { redirect } from 'next/navigation'
import { CreateSOPModal } from './CreateSOPModal'

// Assign a stable badge colour per category name
function categoryVariant(category: string): 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'gray' {
  const map: Record<string, 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'gray'> = {
    hr: 'blue',
    operations: 'green',
    finance: 'yellow',
    safety: 'red',
    compliance: 'purple',
  }
  return map[category?.toLowerCase()] ?? 'gray'
}

interface Sop {
  id: string
  tenant_id: string
  title: string
  content: string | null
  category: string
  version: number
  acknowledgement_required: boolean
  created_at: string
}

interface AckStat {
  sop_id: string
  ack_count: number
}

export default async function HandbookPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const tenantId = user.app_metadata?.tenant_id as string

  const [sopsResult, staffCountResult, acksResult] = await Promise.all([
    supabaseAdmin
      .from('sops')
      .select('id, tenant_id, title, content, category, version, acknowledgement_required, created_at')
      .eq('tenant_id', tenantId)
      .order('category')
      .order('title'),
    supabaseAdmin
      .from('staff')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId),
    supabaseAdmin
      .from('sop_acknowledgements')
      .select('sop_id')
      .eq('tenant_id', tenantId),
  ])

  const sops: Sop[] = sopsResult.data || []
  const totalStaff = staffCountResult.count || 0
  const acks = acksResult.data || []

  // Build ack count per sop_id
  const ackMap: Record<string, number> = {}
  for (const a of acks) {
    ackMap[a.sop_id] = (ackMap[a.sop_id] || 0) + 1
  }

  // Group SOPs by category
  const grouped: Record<string, Sop[]> = {}
  for (const sop of sops) {
    const cat = sop.category || 'General'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(sop)
  }

  const categories = Object.keys(grouped).sort()

  return (
    <div>
      <TopBar title="Handbook & SOPs" subtitle={`${sops.length} procedures`} actions={<CreateSOPModal />} />
      <div className="p-6 space-y-6">

        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <p className="text-xs text-gray-500">Total SOPs</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{sops.length}</p>
          </Card>
          <Card>
            <p className="text-xs text-gray-500">Categories</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{categories.length}</p>
          </Card>
          <Card>
            <p className="text-xs text-gray-500">Require Acknowledgement</p>
            <p className="text-2xl font-bold text-yellow-600 mt-1">
              {sops.filter(s => s.acknowledgement_required).length}
            </p>
          </Card>
          <Card>
            <p className="text-xs text-gray-500">Staff Members</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{totalStaff}</p>
          </Card>
        </div>

        {/* SOPs grouped by category */}
        {categories.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            No SOPs found. Upload your first procedure to build your handbook.
          </div>
        ) : (
          categories.map((category) => (
            <Card key={category} padding="none">
              <div className="p-5 border-b border-gray-100 flex items-center gap-3">
                <Badge variant={categoryVariant(category)}>
                  {category}
                </Badge>
                <h3 className="font-semibold text-gray-900 capitalize">{category}</h3>
                <span className="text-xs text-gray-400 ml-auto">{grouped[category].length} procedures</span>
              </div>
              <div className="divide-y divide-gray-50">
                {grouped[category].map((sop) => {
                  const ackCount = ackMap[sop.id] || 0
                  return (
                    <div key={sop.id} className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-900 truncate">{sop.title}</p>
                          {sop.acknowledgement_required && (
                            <Badge variant="yellow">Ack required</Badge>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">Version {sop.version}</p>
                      </div>
                      <div className="text-right ml-4 shrink-0">
                        {sop.acknowledgement_required && totalStaff > 0 ? (
                          <>
                            <p className={`text-sm font-semibold ${
                              ackCount >= totalStaff ? 'text-emerald-600' : 'text-orange-500'
                            }`}>
                              {ackCount} / {totalStaff}
                            </p>
                            <p className="text-xs text-gray-400">staff ack&apos;d</p>
                          </>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
