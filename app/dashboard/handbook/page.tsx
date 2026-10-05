import { supabaseAdmin } from '@/lib/supabase/admin'
import { getContext } from '@/lib/auth/context'
import { can } from '@/lib/auth/roleMatrix'
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
  applicable_roles:         string[] | null
  published_at:             string | null
  created_at:               string
  acks:                     { user_id: string; acknowledged_at: string }[] | null
}

export default async function HandbookPage() {
  const ctx = await getContext()
  if (!ctx) redirect('/login')
  const tenantId = ctx.tenantId
  // Everyone reads the handbook; only HR writes it. Drafts and the create
  // button were shown to every member (and the API now 403s their saves).
  const editor = can(ctx, 'handbook.write')

  // Reads sop_documents (the real table + the one the /api/sops routes write to);
  // acks embed via the sop_acknowledgements FK (acks are keyed by sop_id, which is
  // already tenant-scoped — the ack table has no tenant_id column).
  const [sopsResult, staffCountResult] = await Promise.all([
    (() => {
      const q = supabaseAdmin
        .from('sop_documents')
        .select('id, title, category, content, version, status, requires_acknowledgement, applicable_roles, published_at, created_at, acks:sop_acknowledgements(user_id, acknowledged_at)')
        .eq('tenant_id', tenantId)
        .is('deleted_at', null)
        .order('category')
        .order('title')
        .limit(500)
      return editor ? q : q.eq('status', 'active')
    })(),
    supabaseAdmin
      .from('staff')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('active', true)
      .is('deleted_at', null),
  ])

  const raw = ((sopsResult.data || []) as SopWithAcks[]).filter((s) => {
    if (editor) return true
    const roles = s.applicable_roles ?? ['all']
    return roles.includes('all') || roles.includes(ctx.role)
  })
  const totalStaff = staffCountResult.count || 0

  // An acknowledgement counts for the version it was given against: when a
  // live SOP is reworded, PATCH bumps published_at, and everyone re-reads.
  const currentAcks = (s: SopWithAcks) =>
    (s.acks ?? []).filter((a) => !s.published_at || Date.parse(a.acknowledged_at) >= Date.parse(s.published_at))

  const sops: SopRow[] = raw.map(s => ({
    id:                       s.id,
    title:                    s.title,
    category:                 s.category,
    content:                  s.content,
    version:                  s.version,
    status:                   s.status,
    requires_acknowledgement: s.requires_acknowledgement,
    ack_count:                currentAcks(s).length,
    acked_by_me:              currentAcks(s).some((a) => a.user_id === ctx.userId),
    created_at:               s.created_at,
  }))

  const categoryCount = new Set(sops.map(s => s.category || 'General')).size
  const ackRequiredCount = sops.filter(s => s.requires_acknowledgement).length

  return (
    <div>
      <TopBar title="Handbook & SOPs" subtitle={`${sops.length} procedures`} actions={editor ? <CreateSOPModal /> : undefined} />
      <div className="p-4 md:p-6 space-y-6">

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
        <HandbookTable rows={sops} totalStaff={totalStaff} editor={editor} />
      </div>
    </div>
  )
}
