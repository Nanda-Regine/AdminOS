import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { TopBar } from '@/components/dashboard/TopBar'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { redirect } from 'next/navigation'

const statusVariant: Record<string, 'gray' | 'yellow' | 'green' | 'red'> = {
  draft: 'gray',
  sent: 'yellow',
  signed: 'green',
  expired: 'red',
}

export default async function ContractsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const tenantId = user.user_metadata?.tenant_id as string

  const { data: contracts } = await supabaseAdmin
    .from('contracts')
    .select('id, tenant_id, title, contact_id, status, sign_token, signed_at, signer_name, created_at, contacts(full_name, email)')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  const allContracts = contracts || []

  const draftCount = allContracts.filter(c => c.status === 'draft').length
  const sentCount = allContracts.filter(c => c.status === 'sent').length
  const signedCount = allContracts.filter(c => c.status === 'signed').length
  const expiredCount = allContracts.filter(c => c.status === 'expired').length

  return (
    <div>
      <TopBar title="Contracts" subtitle={`${allContracts.length} contracts`} />
      <div className="p-6 space-y-6">

        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <p className="text-xs text-gray-500">Draft</p>
            <p className="text-2xl font-bold text-gray-700 mt-1">{draftCount}</p>
          </Card>
          <Card>
            <p className="text-xs text-gray-500">Sent (Awaiting)</p>
            <p className="text-2xl font-bold text-yellow-600 mt-1">{sentCount}</p>
          </Card>
          <Card>
            <p className="text-xs text-gray-500">Signed</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{signedCount}</p>
          </Card>
          <Card>
            <p className="text-xs text-gray-500">Expired</p>
            <p className="text-2xl font-bold text-red-500 mt-1">{expiredCount}</p>
          </Card>
        </div>

        {/* Awaiting signature callout */}
        {sentCount > 0 && (
          <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
            <span className="font-semibold">{sentCount} contract{sentCount !== 1 ? 's' : ''}</span>
            <span>sent and awaiting signature</span>
          </div>
        )}

        {/* Contracts table */}
        <Card padding="none">
          <div className="p-5 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">All Contracts</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Title</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Contact</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Created</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Signed</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Signer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {allContracts.map((contract) => {
                  const contact = contract.contacts as { full_name: string; email?: string } | null
                  return (
                    <tr key={contract.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-medium text-gray-900">{contract.title}</p>
                        {contract.sign_token && contract.status === 'sent' && (
                          <p className="text-xs text-gray-400 mt-0.5 font-mono truncate max-w-xs">
                            Token: {contract.sign_token.slice(0, 12)}…
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {contact ? (
                          <>
                            <p className="text-gray-900">{contact.full_name}</p>
                            {contact.email && (
                              <p className="text-xs text-gray-400">{contact.email}</p>
                            )}
                          </>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <Badge variant={statusVariant[contract.status] || 'gray'}>
                          {contract.status}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-gray-500 text-xs">
                        {contract.created_at
                          ? new Date(contract.created_at).toLocaleDateString('en-ZA')
                          : '—'}
                      </td>
                      <td className="px-5 py-3 text-gray-500 text-xs">
                        {contract.signed_at
                          ? new Date(contract.signed_at).toLocaleDateString('en-ZA')
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-5 py-3 text-gray-600 text-xs">
                        {contract.signer_name || <span className="text-gray-300">—</span>}
                      </td>
                    </tr>
                  )
                })}
                {allContracts.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-gray-400">
                      No contracts found. Create your first contract to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  )
}
