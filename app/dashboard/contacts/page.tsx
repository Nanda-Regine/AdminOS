import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { TopBar } from '@/components/dashboard/TopBar'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Users, AlertCircle, TrendingUp, Search, Plus, ChevronRight } from 'lucide-react'

type ContactRow = {
  id:               string
  full_name:        string | null
  phone:            string | null
  email:            string | null
  company:          string | null
  contact_type:     string | null
  balance_owed:     number
  total_invoiced:   number
  total_paid:       number
  sentiment_score:  number | null
  last_contacted_at: string | null
  tags:             string[]
  source:           string | null
  wa_id:            string | null
  created_at:       string
}

function initials(name: string | null, phone: string | null): string {
  if (name) {
    const parts = name.trim().split(' ')
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase()
  }
  return (phone ?? '??').slice(-2)
}

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  client:   { bg: 'rgba(99,102,241,0.15)',  text: '#818CF8' },
  supplier: { bg: 'rgba(245,158,11,0.15)',  text: '#F59E0B' },
  staff:    { bg: 'rgba(34,197,94,0.15)',   text: '#22C55E' },
  unknown:  { bg: 'rgba(148,163,184,0.12)', text: '#94A3B8' },
}

const SENTIMENT_LABEL: Record<number, { label: string; color: string }> = {
  5: { label: 'Excellent', color: '#22C55E' },
  4: { label: 'Positive',  color: '#4ADE80' },
  3: { label: 'Neutral',   color: '#94A3B8' },
  2: { label: 'Negative',  color: '#F97316' },
  1: { label: 'Urgent',    color: '#EF4444' },
}

function sentimentInfo(score: number | null) {
  if (!score) return null
  const clamped = Math.max(1, Math.min(5, Math.round(score)))
  return SENTIMENT_LABEL[clamped] ?? null
}

const AVATAR_COLORS = [
  '#6366F1', '#8B5CF6', '#EC4899', '#0EA5E9',
  '#10B981', '#F59E0B', '#EF4444', '#14B8A6',
]
function avatarColor(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

export default async function ContactsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const tenantId = user.user_metadata?.tenant_id as string

  const { data: contacts = [] } = await supabaseAdmin
    .from('contacts')
    .select('id, full_name, phone, email, company, contact_type, balance_owed, total_invoiced, total_paid, sentiment_score, last_contacted_at, tags, source, wa_id, created_at')
    .eq('tenant_id', tenantId)
    .order('updated_at', { ascending: false })
    .limit(500)

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
      />
      <div className="p-6 space-y-6">

        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: Users,        label: 'Total Contacts',    value: totalContacts.toLocaleString(),          color: '#818CF8' },
            { icon: AlertCircle,  label: 'With Outstanding',  value: withDebt.toLocaleString(),               color: '#EF4444' },
            { icon: TrendingUp,   label: 'Total Outstanding', value: `R${totalOutstanding.toLocaleString()}`, color: '#F59E0B' },
            { icon: TrendingUp,   label: 'Lifetime Revenue',  value: `R${totalRevenue.toLocaleString()}`,     color: '#22C55E' },
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

        {/* Table card */}
        <div className="glass rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4"
            style={{ borderBottom: '1px solid var(--border)' }}>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>All Contacts</h2>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
                  style={{ color: 'var(--text-muted)' }} />
                <input
                  placeholder="Search…"
                  className="pl-8 pr-3 py-1.5 rounded-lg text-sm outline-none"
                  style={{
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                    width: '200px',
                  }}
                />
              </div>
              <Link
                href="/dashboard/contacts/new"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium"
                style={{ background: 'var(--indigo)', color: '#fff' }}
              >
                <Plus className="w-3.5 h-3.5" />
                Add Contact
              </Link>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
                  {['Contact', 'Type', 'Sentiment', 'Balance Owed', 'Revenue', 'Last Contacted', ''].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide"
                      style={{ color: 'var(--text-muted)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((contact) => {
                  const sinfo  = sentimentInfo(contact.sentiment_score)
                  const tcolor = TYPE_COLORS[contact.contact_type ?? 'unknown'] ?? TYPE_COLORS.unknown
                  const color  = avatarColor(contact.id)
                  const init   = initials(contact.full_name, contact.phone)

                  return (
                    <tr key={contact.id}
                      style={{ borderBottom: '1px solid var(--border)' }}
                      className="transition-colors"
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.04)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      {/* Name / phone */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                            style={{ background: color }}>
                            {init}
                          </div>
                          <div>
                            <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                              {contact.full_name || contact.phone || '(unnamed)'}
                            </p>
                            {contact.phone && (
                              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{contact.phone}</p>
                            )}
                            {contact.company && (
                              <p className="text-xs" style={{ color: 'var(--text-dim)' }}>{contact.company}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Type */}
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{ background: tcolor.bg, color: tcolor.text }}>
                          {contact.contact_type ?? 'unknown'}
                        </span>
                      </td>

                      {/* Sentiment */}
                      <td className="px-5 py-3.5">
                        {sinfo ? (
                          <span className="text-xs font-medium" style={{ color: sinfo.color }}>
                            {sinfo.label}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-dim)' }}>—</span>
                        )}
                      </td>

                      {/* Balance owed */}
                      <td className="px-5 py-3.5">
                        {contact.balance_owed > 0 ? (
                          <span className="font-semibold text-red-400">
                            R{Number(contact.balance_owed).toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-xs" style={{ color: '#22C55E' }}>Clear</span>
                        )}
                      </td>

                      {/* Revenue */}
                      <td className="px-5 py-3.5">
                        <span style={{ color: 'var(--text-secondary)' }}>
                          R{Number(contact.total_paid || 0).toLocaleString()}
                        </span>
                      </td>

                      {/* Last contacted */}
                      <td className="px-5 py-3.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                        {contact.last_contacted_at
                          ? new Date(contact.last_contacted_at).toLocaleDateString('en-ZA')
                          : '—'}
                      </td>

                      {/* Detail link */}
                      <td className="px-5 py-3.5">
                        <Link href={`/dashboard/contacts/${contact.id}`}
                          className="inline-flex items-center gap-1 text-xs font-medium transition-colors"
                          style={{ color: 'var(--indigo-light)' }}>
                          View <ChevronRight className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  )
                })}

                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-16 text-center">
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                        style={{ background: 'var(--indigo-muted)' }}>
                        <Users className="w-6 h-6" style={{ color: 'var(--indigo-light)' }} />
                      </div>
                      <p className="font-medium mb-1" style={{ color: 'var(--text-primary)' }}>No contacts yet</p>
                      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                        Contacts are created automatically when someone messages you, or add one manually.
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  )
}
