import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { TopBar } from '@/components/dashboard/TopBar'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Phone, Mail, Building2, Tag, MessageSquare,
  FileText, CreditCard, Shield, Clock, Edit, Send, MoreHorizontal,
} from 'lucide-react'

type Contact = {
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
  notes:            string | null
  tags:             string[]
  popia_consent:    boolean
  popia_consent_at: string | null
  source:           string | null
  wa_id:            string | null
  lifetime_value:   number | null
  created_at:       string
  updated_at:       string
}

type Conversation = {
  id:        string
  channel:   string
  status:    string
  sentiment: string | null
  intent:    string | null
  summary:   string | null
  created_at: string
  updated_at: string
}

type Invoice = {
  id:         string
  invoice_number: string | null
  amount:     number
  amount_paid: number
  status:     string
  due_date:   string | null
  created_at: string
}

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  client:   { bg: 'rgba(99,102,241,0.15)',  text: '#818CF8' },
  supplier: { bg: 'rgba(245,158,11,0.15)',  text: '#F59E0B' },
  staff:    { bg: 'rgba(34,197,94,0.15)',   text: '#22C55E' },
  unknown:  { bg: 'rgba(148,163,184,0.12)', text: '#94A3B8' },
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

function initials(name: string | null, phone: string | null): string {
  if (name) {
    const parts = name.trim().split(' ')
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase()
  }
  return (phone ?? '??').slice(-2)
}

const STATUS_COLORS: Record<string, string> = {
  open:     '#22C55E',
  resolved: '#94A3B8',
  pending:  '#F59E0B',
  escalated: '#EF4444',
}

const INVOICE_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  paid:        { bg: 'rgba(34,197,94,0.15)',  text: '#22C55E' },
  unpaid:      { bg: 'rgba(239,68,68,0.15)',  text: '#EF4444' },
  overdue:     { bg: 'rgba(239,68,68,0.2)',   text: '#F87171' },
  partial:     { bg: 'rgba(245,158,11,0.15)', text: '#F59E0B' },
  draft:       { bg: 'rgba(148,163,184,0.12)', text: '#94A3B8' },
}

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const tenantId = user.app_metadata?.tenant_id as string

  const [contactRes, convsRes, invoicesRes] = await Promise.all([
    supabaseAdmin
      .from('contacts')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single(),
    supabaseAdmin
      .from('conversations')
      .select('id, channel, status, sentiment, intent, summary, created_at, updated_at')
      .eq('contact_id', id)
      .eq('tenant_id', tenantId)
      .order('updated_at', { ascending: false })
      .limit(20),
    supabaseAdmin
      .from('invoices')
      .select('id, invoice_number, amount, amount_paid, status, due_date, created_at')
      .eq('tenant_id', tenantId)
      .eq('contact_phone', (await supabaseAdmin.from('contacts').select('phone').eq('id', id).single()).data?.phone ?? '')
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  if (!contactRes.data) notFound()

  const contact    = contactRes.data as Contact
  const convs      = (convsRes.data ?? []) as Conversation[]
  const invoices   = (invoicesRes.data ?? []) as Invoice[]
  const color      = avatarColor(contact.id)
  const init       = initials(contact.full_name, contact.phone)
  const tcolor     = TYPE_COLORS[contact.contact_type ?? 'unknown'] ?? TYPE_COLORS.unknown

  return (
    <div>
      <TopBar
        title={contact.full_name || contact.phone || 'Contact'}
        subtitle="Contact profile & history"
      />
      <div className="p-6 space-y-6">

        {/* Back link */}
        <Link href="/dashboard/contacts"
          className="inline-flex items-center gap-2 text-sm transition-colors"
          style={{ color: 'var(--text-muted)' }}>
          <ArrowLeft className="w-4 h-4" />
          Back to Contacts
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left: Profile card */}
          <div className="space-y-4">
            <div className="glass rounded-2xl p-6">
              {/* Avatar + name */}
              <div className="flex flex-col items-center text-center mb-6">
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-bold text-white mb-4"
                  style={{ background: color }}>
                  {init}
                </div>
                <h2 className="text-lg font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                  {contact.full_name || '(unnamed)'}
                </h2>
                {contact.company && (
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{contact.company}</p>
                )}
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-2"
                  style={{ background: tcolor.bg, color: tcolor.text }}>
                  {contact.contact_type ?? 'unknown'}
                </span>
              </div>

              {/* Quick actions */}
              <div className="flex gap-2 mb-6">
                {contact.phone && (
                  <a href={`https://wa.me/${contact.phone.replace(/\D/g, '')}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex-1 inline-flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium transition-all"
                    style={{ background: 'var(--indigo)', color: '#fff' }}>
                    <Send className="w-3.5 h-3.5" />
                    Message
                  </a>
                )}
                <button className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                  <Edit className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                </button>
                <button className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                  <MoreHorizontal className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                </button>
              </div>

              {/* Details */}
              <div className="space-y-3">
                {contact.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-dim)' }} />
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{contact.phone}</span>
                  </div>
                )}
                {contact.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-dim)' }} />
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{contact.email}</span>
                  </div>
                )}
                {contact.company && (
                  <div className="flex items-center gap-3">
                    <Building2 className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-dim)' }} />
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{contact.company}</span>
                  </div>
                )}
                {contact.source && (
                  <div className="flex items-center gap-3">
                    <Tag className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-dim)' }} />
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Source: {contact.source}</span>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <Clock className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-dim)' }} />
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Added {new Date(contact.created_at).toLocaleDateString('en-ZA')}
                  </span>
                </div>
              </div>

              {/* Tags */}
              {contact.tags?.length > 0 && (
                <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
                  <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>TAGS</p>
                  <div className="flex flex-wrap gap-1.5">
                    {contact.tags.map(tag => (
                      <span key={tag}
                        className="px-2 py-0.5 rounded-full text-xs"
                        style={{ background: 'var(--indigo-muted)', color: 'var(--indigo-light)' }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* POPIA */}
              <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4" style={{ color: contact.popia_consent ? '#22C55E' : '#94A3B8' }} />
                  <span className="text-xs" style={{ color: contact.popia_consent ? '#22C55E' : 'var(--text-dim)' }}>
                    {contact.popia_consent
                      ? `POPIA consent given${contact.popia_consent_at ? ' · ' + new Date(contact.popia_consent_at).toLocaleDateString('en-ZA') : ''}`
                      : 'No POPIA consent recorded'}
                  </span>
                </div>
              </div>
            </div>

            {/* Financial summary card */}
            <div className="glass rounded-2xl p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide mb-4"
                style={{ color: 'var(--text-muted)' }}>Financials</h3>
              <div className="space-y-3">
                {[
                  { label: 'Total Invoiced', value: contact.total_invoiced, color: 'var(--text-primary)' },
                  { label: 'Total Paid',     value: contact.total_paid,     color: '#22C55E' },
                  { label: 'Balance Owed',   value: contact.balance_owed,   color: contact.balance_owed > 0 ? '#EF4444' : '#22C55E' },
                ].map(({ label, value, color: c }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{label}</span>
                    <span className="text-sm font-semibold" style={{ color: c }}>
                      R{Number(value || 0).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Activity columns */}
          <div className="lg:col-span-2 space-y-6">

            {/* Notes */}
            {contact.notes && (
              <div className="glass rounded-2xl p-5">
                <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Notes</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{contact.notes}</p>
              </div>
            )}

            {/* Conversations */}
            <div className="glass rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4"
                style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" style={{ color: 'var(--indigo-light)' }} />
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    Conversations ({convs.length})
                  </h3>
                </div>
              </div>
              {convs.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No conversations yet</p>
                </div>
              ) : (
                <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {convs.map(conv => (
                    <div key={conv.id} className="px-5 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium capitalize"
                              style={{ color: 'var(--text-secondary)' }}>{conv.channel}</span>
                            <span className="text-xs px-1.5 py-0.5 rounded"
                              style={{ background: `${STATUS_COLORS[conv.status] ?? '#94A3B8'}20`, color: STATUS_COLORS[conv.status] ?? '#94A3B8' }}>
                              {conv.status}
                            </span>
                            {conv.intent && (
                              <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
                                {conv.intent.replace(/_/g, ' ')}
                              </span>
                            )}
                          </div>
                          {conv.summary && (
                            <p className="text-sm line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                              {conv.summary}
                            </p>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {new Date(conv.updated_at).toLocaleDateString('en-ZA')}
                          </p>
                          <Link href={`/dashboard/inbox?conv=${conv.id}`}
                            className="text-xs mt-1 inline-block"
                            style={{ color: 'var(--indigo-light)' }}>
                            Open →
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Invoices */}
            <div className="glass rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4"
                style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4" style={{ color: 'var(--indigo-light)' }} />
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    Invoices ({invoices.length})
                  </h3>
                </div>
                <Link href={`/dashboard/invoices/new?contact=${contact.id}`}
                  className="text-xs font-medium"
                  style={{ color: 'var(--indigo-light)' }}>
                  + New Invoice
                </Link>
              </div>
              {invoices.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No invoices yet</p>
                </div>
              ) : (
                <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {invoices.map(inv => {
                    const sc = INVOICE_STATUS_COLORS[inv.status] ?? INVOICE_STATUS_COLORS.draft
                    const outstanding = Number(inv.amount) - Number(inv.amount_paid)
                    return (
                      <div key={inv.id} className="px-5 py-3.5 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                            {inv.invoice_number || `#${inv.id.slice(0, 8)}`}
                          </p>
                          {inv.due_date && (
                            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                              Due {new Date(inv.due_date).toLocaleDateString('en-ZA')}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{ background: sc.bg, color: sc.text }}>
                            {inv.status}
                          </span>
                          <div className="text-right">
                            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                              R{Number(inv.amount).toLocaleString()}
                            </p>
                            {outstanding > 0 && (
                              <p className="text-xs text-red-400">
                                R{outstanding.toLocaleString()} owed
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
