import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { TopBar } from '@/components/dashboard/TopBar'
import { redirect } from 'next/navigation'
import { Users, AlertCircle, TrendingUp } from 'lucide-react'
import { CreateContactModal } from './CreateContactModal'
import { ContactsTable, type ContactRow } from './ContactsTable'
import { formatZAR } from '@/lib/format'

export default async function ContactsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const tenantId = user.app_metadata?.tenant_id as string

  const { data: contacts = [] } = await supabaseAdmin
    .from('contacts')
    .select('id, full_name, phone, email, company, contact_type, balance_owed, total_invoiced, total_paid, sentiment_score, last_contacted_at, tags, source, wa_id, created_at')
    .eq('tenant_id', tenantId)
    .order('updated_at', { ascending: false })
    .limit(2000)

  const rows = (contacts ?? []) as ContactRow[]

  const totalContacts   = rows.length
  const withDebt        = rows.filter(c => c.balance_owed > 0).length
  const totalOutstanding = rows.reduce((s, c) => s + Number(c.balance_owed || 0), 0)
  const totalRevenue    = rows.reduce((s, c) => s + Number(c.total_paid || 0), 0)

  return (
    <div>
      <TopBar
        title="Contacts"
        subtitle={`${totalContacts} contacts in your CRM`}
        actions={<CreateContactModal />}
      />
      <div className="p-6 space-y-6">

        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: Users,        label: 'Total Contacts',    value: totalContacts.toLocaleString(), color: '#818CF8' },
            { icon: AlertCircle,  label: 'With Outstanding',  value: withDebt.toLocaleString(),      color: '#EF4444' },
            { icon: TrendingUp,   label: 'Total Outstanding', value: formatZAR(totalOutstanding),    color: '#F59E0B' },
            { icon: TrendingUp,   label: 'Lifetime Revenue',  value: formatZAR(totalRevenue),        color: '#22C55E' },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="glass rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: `${color}20` }}>
                  <Icon className="w-4 h-4" style={{ color }} />
                </div>
                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{label}</span>
              </div>
              <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Contacts table */}
        <ContactsTable rows={rows} />

      </div>
    </div>
  )
}
