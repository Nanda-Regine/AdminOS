import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { TopBar } from '@/components/dashboard/TopBar'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { redirect } from 'next/navigation'

const sentimentColor: Record<string, string> = {
  positive: 'text-green-600',
  neutral:  'text-gray-400',
  negative: 'text-red-500',
  urgent:   'text-orange-500',
}

const sentimentIcon: Record<string, string> = {
  positive: '😊',
  neutral:  '😐',
  negative: '😟',
  urgent:   '🚨',
}

const contactTypeVariant: Record<string, 'blue' | 'green' | 'yellow' | 'gray'> = {
  client:   'blue',
  staff:    'green',
  supplier: 'yellow',
  unknown:  'gray',
}

export default async function ContactsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const tenantId = user.user_metadata?.tenant_id as string

  // Pull all unique contacts from conversations with their latest info
  const [convsRes, invoicesRes, staffRes] = await Promise.all([
    supabaseAdmin
      .from('conversations')
      .select('contact_identifier, contact_name, contact_type, sentiment, intent, updated_at, status')
      .eq('tenant_id', tenantId)
      .not('contact_identifier', 'is', null)
      .order('updated_at', { ascending: false }),
    supabaseAdmin
      .from('invoices')
      .select('contact_phone, amount, amount_paid, status')
      .eq('tenant_id', tenantId),
    supabaseAdmin
      .from('staff')
      .select('phone, full_name, role, department')
      .eq('tenant_id', tenantId),
  ])

  const conversations = convsRes.data   || []
  const invoices      = invoicesRes.data || []
  const staffList     = staffRes.data    || []

  // Build staff lookup by phone
  const staffByPhone = Object.fromEntries(
    staffList.filter((s) => s.phone).map((s) => [s.phone, s])
  )

  // Build invoice outstanding balance lookup by contact phone
  const balanceByPhone: Record<string, number> = {}
  for (const inv of invoices) {
    if (!inv.contact_phone || inv.status === 'paid') continue
    balanceByPhone[inv.contact_phone] = (balanceByPhone[inv.contact_phone] || 0)
      + (Number(inv.amount) - Number(inv.amount_paid))
  }

  // Deduplicate contacts — one record per unique contact_identifier, keep latest conv data
  const seen = new Set<string>()
  const contacts: {
    identifier: string
    name:        string | null
    type:        string | null
    sentiment:   string | null
    intent:      string | null
    lastSeen:    string
    balance:     number
    staff:       typeof staffList[0] | undefined
    convCount:   number
  }[] = []

  const convCountByContact: Record<string, number> = {}
  for (const c of conversations) {
    if (!c.contact_identifier) continue
    convCountByContact[c.contact_identifier] = (convCountByContact[c.contact_identifier] || 0) + 1
  }

  for (const c of conversations) {
    if (!c.contact_identifier || seen.has(c.contact_identifier)) continue
    seen.add(c.contact_identifier)
    contacts.push({
      identifier: c.contact_identifier,
      name:       c.contact_name,
      type:       c.contact_type,
      sentiment:  c.sentiment,
      intent:     c.intent,
      lastSeen:   c.updated_at,
      balance:    balanceByPhone[c.contact_identifier] || 0,
      staff:      staffByPhone[c.contact_identifier],
      convCount:  convCountByContact[c.contact_identifier] || 1,
    })
  }

  const totalOutstanding = contacts.reduce((sum, c) => sum + c.balance, 0)
  const withDebt         = contacts.filter((c) => c.balance > 0).length

  return (
    <div>
      <TopBar title="Contacts" subtitle="Unified view of everyone who has reached your business" />
      <div className="p-6 space-y-6">

        {/* Summary row */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <p className="text-sm text-gray-500">Total contacts</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{contacts.length}</p>
          </Card>
          <Card>
            <p className="text-sm text-gray-500">With outstanding balance</p>
            <p className="text-2xl font-bold text-red-600 mt-1">{withDebt}</p>
          </Card>
          <Card>
            <p className="text-sm text-gray-500">Total outstanding</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">R{totalOutstanding.toLocaleString()}</p>
          </Card>
        </div>

        {/* Contact list */}
        <Card padding="none">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">All Contacts</h3>
            <span className="text-sm text-gray-400">{contacts.length} contacts</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Contact</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Sentiment</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Last intent</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Conversations</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Outstanding</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Last seen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {contacts.map((contact) => (
                  <tr key={contact.identifier} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-gray-900">
                        {contact.name || contact.staff?.full_name || contact.identifier}
                      </p>
                      <p className="text-xs text-gray-400">{contact.identifier}</p>
                      {contact.staff && (
                        <p className="text-xs text-emerald-600">{contact.staff.role} · {contact.staff.department}</p>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge variant={contactTypeVariant[contact.type || 'unknown'] || 'gray'}>
                        {contact.type || 'unknown'}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5">
                      {contact.sentiment ? (
                        <span className={`text-sm ${sentimentColor[contact.sentiment] || ''}`}>
                          {sentimentIcon[contact.sentiment] || ''} {contact.sentiment}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-gray-600 capitalize">
                      {contact.intent?.replace(/_/g, ' ') || '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-gray-100 text-xs font-semibold text-gray-600">
                        {contact.convCount}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {contact.balance > 0 ? (
                        <span className="text-red-600 font-semibold">R{contact.balance.toLocaleString()}</span>
                      ) : (
                        <span className="text-emerald-600 text-xs">Clear</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-gray-400 text-xs">
                      {new Date(contact.lastSeen).toLocaleDateString('en-ZA')}
                    </td>
                  </tr>
                ))}
                {contacts.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-gray-400">
                      <p className="text-3xl mb-2">🧑‍💼</p>
                      <p className="text-sm font-medium">No contacts yet</p>
                      <p className="text-xs mt-1">Contacts are built automatically from inbound WhatsApp conversations</p>
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
