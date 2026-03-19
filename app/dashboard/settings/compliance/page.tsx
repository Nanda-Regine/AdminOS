import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { TopBar } from '@/components/dashboard/TopBar'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { redirect } from 'next/navigation'

const DATA_REGISTER = [
  {
    category:      'WhatsApp conversations',
    fields:        'Phone number, message content, intent, sentiment, timestamp',
    legalBasis:    'Legitimate interest — business communication',
    retention:     '24 months',
    who:           'Business owner, admin users only',
  },
  {
    category:      'Staff records',
    fields:        'Full name, phone, email, role, leave balance, wellness scores',
    legalBasis:    'Contract of employment',
    retention:     'Duration of employment + 3 years',
    who:           'HR manager, system admin only',
  },
  {
    category:      'Invoices & financial data',
    fields:        'Contact name, phone, email, amounts, due dates',
    legalBasis:    'Legal obligation (tax records)',
    retention:     '5 years (SARS requirement)',
    who:           'Business owner, finance role only',
  },
  {
    category:      'Documents',
    fields:        'File content, AI-extracted text, classification, uploader ID',
    legalBasis:    'Legitimate interest — business operations',
    retention:     '24 months or until deleted by user',
    who:           'Uploader + admin users only',
  },
  {
    category:      'Audit logs',
    fields:        'User ID, action, timestamp, IP address, metadata',
    legalBasis:    'Legal obligation (security + compliance)',
    retention:     '36 months — append only',
    who:           'System admin, super admin only',
  },
]

export default async function CompliancePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const tenantId = user.user_metadata?.tenant_id as string

  // Count records per category for the data register
  const [convCount, staffCount, invoiceCount, docCount, auditCount] = await Promise.all([
    supabaseAdmin.from('conversations').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    supabaseAdmin.from('staff').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    supabaseAdmin.from('invoices').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    supabaseAdmin.from('documents').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    supabaseAdmin.from('audit_log').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
  ])

  const recordCounts = [
    convCount.count    || 0,
    staffCount.count   || 0,
    invoiceCount.count || 0,
    docCount.count     || 0,
    auditCount.count   || 0,
  ]

  return (
    <div>
      <TopBar
        title="POPI Compliance Centre"
        subtitle="Protection of Personal Information Act — data register and rights management"
      />
      <div className="p-6 space-y-6">

        {/* POPI status banner */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 flex items-start gap-4">
          <span className="text-3xl">🛡️</span>
          <div>
            <p className="font-semibold text-emerald-900 mb-1">AdminOS is POPI-compliant by design</p>
            <p className="text-sm text-emerald-700 leading-relaxed">
              All personal data is stored in South Africa (Supabase Cape Town region), encrypted at rest (AES-256),
              isolated per business via Row-Level Security, and access is audited on every operation.
              This compliance centre documents what data you hold, why, and how long you keep it.
            </p>
          </div>
        </div>

        {/* Data register */}
        <Card padding="none">
          <div className="p-5 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Personal Information Register</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              POPI Act Section 18 — information required to be documented
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Records</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Fields Held</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Legal Basis</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Retention</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Access</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {DATA_REGISTER.map((row, i) => (
                  <tr key={row.category} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-gray-900">{row.category}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center justify-center h-6 min-w-6 px-2 rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700">
                        {recordCounts[i].toLocaleString()}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-gray-500 max-w-xs">{row.fields}</td>
                    <td className="px-5 py-3.5 text-xs text-gray-600">{row.legalBasis}</td>
                    <td className="px-5 py-3.5">
                      <Badge variant="blue">{row.retention}</Badge>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-gray-500">{row.who}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Data subject rights */}
          <Card>
            <h3 className="font-semibold text-gray-900 mb-4">Data Subject Rights (POPI §23–25)</h3>
            <div className="space-y-3">
              {[
                { right: 'Right of access', action: 'Export all data for a contact', icon: '📤' },
                { right: 'Right to correction', action: 'Edit contact details in Contacts page', icon: '✏️' },
                { right: 'Right to erasure', action: 'Delete contact data below', icon: '🗑️' },
                { right: 'Right to object', action: 'Contact removed from WhatsApp sequences', icon: '🚫' },
              ].map((item) => (
                <div key={item.right} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <span className="text-lg shrink-0">{item.icon}</span>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{item.right}</p>
                    <p className="text-xs text-gray-500">{item.action}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Compliance checklist */}
          <Card>
            <h3 className="font-semibold text-gray-900 mb-4">Compliance Status</h3>
            <div className="space-y-2">
              {[
                { item: 'Data stored in South Africa (Cape Town)',       done: true  },
                { item: 'Encryption at rest (AES-256)',                  done: true  },
                { item: 'Row-Level Security (per-tenant isolation)',      done: true  },
                { item: 'Audit log on every data access event',          done: true  },
                { item: 'Password authentication with JWT',              done: true  },
                { item: 'WhatsApp message deduplication',                done: true  },
                { item: 'Webhook HMAC-SHA256 verification',              done: true  },
                { item: 'Information Officer registered with ICLG',      done: false },
                { item: 'Privacy Policy published on adminos.co.za',     done: false },
                { item: 'Data breach response plan documented',          done: false },
              ].map((check) => (
                <div key={check.item} className="flex items-center gap-3 text-sm">
                  <span className={check.done ? 'text-emerald-600' : 'text-gray-300'}>
                    {check.done ? '✓' : '○'}
                  </span>
                  <span className={check.done ? 'text-gray-700' : 'text-gray-400'}>
                    {check.item}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right to erasure */}
        <Card>
          <h3 className="font-semibold text-gray-900 mb-2">Right to Erasure — Delete Contact Data</h3>
          <p className="text-sm text-gray-500 mb-4">
            If a contact requests deletion of their data under POPI §24, enter their phone number or identifier below.
            This will remove all conversations, messages, and wellness records associated with them.
            Invoice records are retained for SARS compliance (5-year obligation).
          </p>
          <form action="/api/compliance/delete-contact" method="POST" className="flex gap-3">
            <input
              type="text"
              name="identifier"
              required
              placeholder="Phone number or contact identifier (e.g. 27821234567)"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
              onClick={(e) => {
                // Handled server-side — form submits naturally
                void e
              }}
            >
              Delete data
            </button>
          </form>
          <p className="text-xs text-gray-400 mt-2">
            This action is irreversible and will be logged in the audit trail.
          </p>
        </Card>

      </div>
    </div>
  )
}
