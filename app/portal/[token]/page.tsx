export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase/admin'

interface Props {
  params: Promise<{ token: string }>
}

async function getPortalData(token: string) {
  // Verify token — must exist, not revoked, not expired
  const { data: session } = await supabaseAdmin
    .from('portal_sessions')
    .select('*')
    .eq('token', token)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .single()

  if (!session) return null

  const { tenant_id: tenantId, contact_identifier: contactIdentifier } = session as {
    tenant_id: string
    contact_identifier: string
  }

  // Fetch contact
  const { data: contact } = await supabaseAdmin
    .from('contacts')
    .select('id, name, email, phone, tags, type')
    .eq('tenant_id', tenantId)
    .eq('id', contactIdentifier)
    .maybeSingle()

  // Fetch open invoices
  const { data: invoices } = await supabaseAdmin
    .from('invoices')
    .select('id, invoice_number, amount, status, due_date, created_at')
    .eq('tenant_id', tenantId)
    .eq('contact_id', contactIdentifier)
    .in('status', ['unpaid', 'partial', 'overdue'])
    .order('due_date', { ascending: true })

  // Fetch recent conversations
  const { data: conversations } = await supabaseAdmin
    .from('conversations')
    .select('id, summary, status, created_at, last_message_at')
    .eq('tenant_id', tenantId)
    .eq('contact_id', contactIdentifier)
    .order('last_message_at', { ascending: false })
    .limit(5)

  // Fetch tenant name
  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('name')
    .eq('id', tenantId)
    .single()

  return { contact, invoices: invoices ?? [], conversations: conversations ?? [], tenantName: tenant?.name ?? 'Your Business' }
}

export default async function PortalPage({ params }: Props) {
  const { token } = await params
  const data = await getPortalData(token)

  if (!data) notFound()

  const { contact, invoices, conversations, tenantName } = data
  const totalOwed = invoices.reduce((sum, inv) => sum + Number((inv as { amount: number }).amount || 0), 0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white">
      {/* Header */}
      <header className="border-b border-white/10 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-sm text-white/50">Powered by</p>
            <h1 className="text-lg font-bold text-white">{tenantName}</h1>
          </div>
          <span className="text-xs bg-white/10 px-3 py-1 rounded-full text-white/70">Client Portal</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        {/* Welcome */}
        <div>
          <h2 className="text-2xl font-bold">
            Welcome back{contact?.name ? `, ${(contact as { name: string }).name}` : ''}
          </h2>
          <p className="text-white/50 text-sm mt-1">Here&apos;s a summary of your account</p>
        </div>

        {/* Outstanding balance */}
        {invoices.length > 0 && (
          <section className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6">
            <h3 className="text-sm font-medium text-white/60 uppercase tracking-wide mb-4">Outstanding Invoices</h3>
            <p className="text-3xl font-bold text-amber-400 mb-6">
              R{totalOwed.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
            </p>
            <div className="space-y-3">
              {invoices.map((inv) => {
                const invoice = inv as { id: string; invoice_number?: string; amount: number; status: string; due_date?: string }
                return (
                  <div key={invoice.id} className="flex items-center justify-between py-3 border-t border-white/10">
                    <div>
                      <p className="text-sm font-medium">{invoice.invoice_number ?? invoice.id.slice(0, 8)}</p>
                      {invoice.due_date && (
                        <p className="text-xs text-white/40">Due {new Date(invoice.due_date).toLocaleDateString('en-ZA')}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">R{Number(invoice.amount).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        invoice.status === 'overdue'
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-amber-500/20 text-amber-400'
                      }`}>
                        {invoice.status}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Recent conversations */}
        {conversations.length > 0 && (
          <section className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6">
            <h3 className="text-sm font-medium text-white/60 uppercase tracking-wide mb-4">Recent Conversations</h3>
            <div className="space-y-3">
              {conversations.map((conv) => {
                const c = conv as { id: string; summary?: string; status: string; last_message_at?: string }
                return (
                  <div key={c.id} className="flex items-start justify-between py-3 border-t border-white/10">
                    <p className="text-sm text-white/70 max-w-xs truncate">
                      {c.summary ?? 'No summary available'}
                    </p>
                    <div className="text-right ml-4 flex-shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        c.status === 'open'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-white/10 text-white/40'
                      }`}>
                        {c.status}
                      </span>
                      {c.last_message_at && (
                        <p className="text-xs text-white/30 mt-1">
                          {new Date(c.last_message_at).toLocaleDateString('en-ZA')}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {invoices.length === 0 && conversations.length === 0 && (
          <div className="text-center py-16 text-white/40">
            <p className="text-lg">All clear — no pending items.</p>
          </div>
        )}
      </main>

      <footer className="text-center py-6 text-xs text-white/20">
        This portal link expires in 7 days · Secured by AdminOS
      </footer>
    </div>
  )
}
