import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { TopBar } from '@/components/dashboard/TopBar'
import { Card } from '@/components/ui/card'
import { redirect } from 'next/navigation'
import { CreateContractModal } from './CreateContractModal'
import { ContractsTable, type ContractRow } from './ContractsTable'

export default async function ContractsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const tenantId = user.app_metadata?.tenant_id as string

  const { data: contacts } = await supabaseAdmin
    .from('contacts')
    .select('id, full_name')
    .eq('tenant_id', tenantId)
    .order('full_name')
    .limit(100)

  // Note: sign_token is intentionally NOT selected — it's a signing secret and
  // was previously leaked into the rendered table.
  const { data: contracts } = await supabaseAdmin
    .from('contracts')
    .select('id, tenant_id, title, contact_id, status, signed_at, signer_name, created_at, contacts(full_name, email)')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  const allContracts = (contracts || []) as ContractRow[]

  const draftCount = allContracts.filter(c => c.status === 'draft').length
  const sentCount = allContracts.filter(c => c.status === 'sent').length
  const signedCount = allContracts.filter(c => c.status === 'signed').length
  const expiredCount = allContracts.filter(c => c.status === 'expired').length

  return (
    <div>
      <TopBar title="Contracts" subtitle={`${allContracts.length} contracts`} actions={<CreateContractModal contacts={contacts || []} />} />
      <div className="p-6 space-y-6">

        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <p className="text-xs text-[var(--text-muted)]">Draft</p>
            <p className="text-2xl font-bold text-[var(--text-secondary)] mt-1">{draftCount}</p>
          </Card>
          <Card>
            <p className="text-xs text-[var(--text-muted)]">Sent (Awaiting)</p>
            <p className="text-2xl font-bold text-yellow-400 mt-1">{sentCount}</p>
          </Card>
          <Card>
            <p className="text-xs text-[var(--text-muted)]">Signed</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1">{signedCount}</p>
          </Card>
          <Card>
            <p className="text-xs text-[var(--text-muted)]">Expired</p>
            <p className="text-2xl font-bold text-red-400 mt-1">{expiredCount}</p>
          </Card>
        </div>

        {/* Awaiting signature callout */}
        {sentCount > 0 && (
          <div
            className="flex items-center gap-2 p-3 rounded-lg text-sm"
            style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.30)', color: '#FBBF24' }}
          >
            <span className="font-semibold">{sentCount} contract{sentCount !== 1 ? 's' : ''}</span>
            <span style={{ color: 'var(--text-secondary)' }}>sent and awaiting signature</span>
          </div>
        )}

        {/* Contracts table */}
        <ContractsTable rows={allContracts} />
      </div>
    </div>
  )
}
