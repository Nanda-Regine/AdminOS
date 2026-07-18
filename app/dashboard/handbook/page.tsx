import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { TopBar } from '@/components/dashboard/TopBar'
import { Card } from '@/components/ui/card'
import { redirect } from 'next/navigation'
import { CreateSOPModal } from './CreateSOPModal'
import { HandbookTable, type SopRow } from './HandbookTable'

type SopWithAcks = {
  id:                       string
  title:                    string
  category:                 string | null
  content:                  unknown
  version:                  number
  status:                   string
  requires_acknowledgement: boolean
  created_at:               string
  acks:                     { user_id: string }[] | null
}

export default async function HandbookPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const tenantId = user.app_metadata?.tenant_id as string

  // Reads sop_documents (the real table + the one the /api/sops routes write to);
  // acks embed via the sop_acknowledgements FK (acks are keyed by sop_id, which is
  // already tenant-scoped — the ack table has no tenant_id column).
  const [sopsResult, staffCountResult] = await Promise.all([
    supabaseAdmin
      .from('sop_documents')
      .select('id, title, category, content, version, status, requires_acknowledgement, created_at, acks:sop_acknowledgements(user_id)')
      .eq('tenant_id', tenantId)
      .order('category')
      .order('title'),
    supabaseAdmin
      .from('staff')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId),
  ])

  const raw = (sopsResult.data || []) as SopWithAcks[]
  const totalStaff = staffCountResult.count || 0

  const sops: SopRow[] = raw.map(s => ({
    id:                       s.id,
    title:                    s.title,
    category:                 s.category,
    content:                  s.content,
    version:                  s.version,
    status:                   s.status,
    requires_acknowledgement: s.requires_acknowledgement,
    ack_count:                s.acks?.length ?? 0,
    created_at:               s.created_at,
  }))

  const categoryCount = new Set(sops.map(s => s.category || 'General')).size
  const ackRequiredCount = sops.filter(s => s.requires_acknowledgement).length

  return (
    <div>
      <TopBar title="Handbook & SOPs" subtitle={`${sops.length} procedures`} actions={<CreateSOPModal />} />
      <div className="p-6 space-y-6">

        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <p className="text-xs text-[var(--text-muted)]">Total SOPs</p>
            <p className="text-2xl font-bold text-[var(--text-primary)] mt-1">{sops.length}</p>
          </Card>
          <Card>
            <p className="text-xs text-[var(--text-muted)]">Categories</p>
            <p className="text-2xl font-bold text-[var(--text-primary)] mt-1">{categoryCount}</p>
          </Card>
          <Card>
            <p className="text-xs text-[var(--text-muted)]">Require Acknowledgement</p>
            <p className="text-2xl font-bold text-yellow-400 mt-1">{ackRequiredCount}</p>
          </Card>
          <Card>
            <p className="text-xs text-[var(--text-muted)]">Staff Members</p>
            <p className="text-2xl font-bold text-[var(--text-primary)] mt-1">{totalStaff}</p>
          </Card>
        </div>

        {/* SOPs table (searchable, filterable, openable) */}
        <HandbookTable rows={sops} totalStaff={totalStaff} />
      </div>
    </div>
  )
}
