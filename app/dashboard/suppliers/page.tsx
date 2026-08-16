import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { TopBar } from '@/components/dashboard/TopBar'
import { Card } from '@/components/ui/card'
import { SuppliersTable, type SupplierRow } from './SuppliersTable'

export const metadata = {
  title: 'Suppliers — AdminOS',
  description: 'Who you buy from, with B-BBEE level and ownership for preferential procurement.',
}

/**
 * The suppliers table shipped in Phase 6 with SA-specific B-BBEE, women-owned,
 * youth-owned and community-verified fields, and a working filtered API — and
 * no page ever reached it. Preferential procurement is the one B-BBEE lever a
 * small buyer genuinely controls, so this data was the product's sharpest local
 * differentiator sitting invisible.
 */
export default async function SuppliersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const tenantId = user.app_metadata?.tenant_id as string | undefined
  if (!tenantId) redirect('/dashboard')

  const { data } = await supabaseAdmin
    .from('suppliers')
    .select('id, name, category, contact_person, phone, email, payment_terms, rating, is_community_verified, bbbbee_level, women_owned, youth_owned')
    .eq('tenant_id', tenantId)
    .order('name')

  const rows = (data ?? []) as SupplierRow[]

  const rated       = rows.filter(r => r.bbbbee_level !== null)
  const strong      = rated.filter(r => (r.bbbbee_level as number) <= 4).length
  const womenOwned  = rows.filter(r => r.women_owned).length
  const youthOwned  = rows.filter(r => r.youth_owned).length
  const unrecorded  = rows.length - rated.length

  const stats = [
    { label: 'Suppliers',        value: rows.length,  tone: 'var(--text-primary)' },
    { label: 'B-BBEE level 1–4', value: strong,       tone: 'var(--chip-green-fg)' },
    { label: 'Women-owned',      value: womenOwned,   tone: 'var(--chip-purple-fg)' },
    { label: 'Youth-owned',      value: youthOwned,   tone: 'var(--chip-blue-fg)' },
  ]

  return (
    <>
      <TopBar
        title="Suppliers"
        subtitle="Who you buy from — and what that spend does for your B-BBEE scorecard"
      />

      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {stats.map(s => (
            <Card key={s.label}>
              <div className="p-4">
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
                <div className="text-2xl font-bold mt-1" style={{ color: s.tone }}>{s.value}</div>
              </div>
            </Card>
          ))}
        </div>

        {/* Only surfaced when it is actionable — an empty nudge on an empty page
            is noise, and a fully-recorded book deserves silence, not a banner. */}
        {rows.length > 0 && unrecorded > 0 && (
          <Card>
            <div className="p-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <span style={{ color: 'var(--chip-amber-fg)' }}>{unrecorded}</span> of your{' '}
              {rows.length} suppliers have no B-BBEE level recorded. Preferential procurement
              spend only counts on your scorecard when you can evidence the supplier&apos;s level —
              ask them for their certificate or sworn affidavit.
            </div>
          </Card>
        )}

        <Card>
          <div className="p-3 md:p-5 overflow-x-auto">
            <SuppliersTable rows={rows} />
          </div>
        </Card>
      </div>
    </>
  )
}
