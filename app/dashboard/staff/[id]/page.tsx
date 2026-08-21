import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { TopBar } from '@/components/dashboard/TopBar'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Phone, Mail, MapPin, IdCard, Calendar,
  CreditCard, Users2, ShieldAlert,
} from 'lucide-react'
import { formatZAR } from '@/lib/format'
import { StaffDocuments } from './StaffDocuments'
import { avatarColor } from '@/lib/ui/avatarColor'
import { checkPermission } from '@/lib/auth/permissions'

type Staff = {
  id:                      string
  full_name:               string
  email:                   string | null
  phone:                   string | null
  job_title:               string | null
  department:              string | null
  role:                    string | null
  employment_type:         string | null
  start_date:              string | null
  salary:                  number | null
  id_number:               string | null
  address:                 string | null
  emergency_contact_name:  string | null
  emergency_contact_phone: string | null
  leave_balance:           number | null
  leave_taken:             number | null
  wellness_scores:         Array<{ score: number; date: string }> | null
  after_hours_flag:        boolean | null
  created_at:              string
}

type Document = {
  id:         string
  title:      string
  file_url:   string
  file_type:  string | null
  expires_at: string | null
  created_at: string
}

type Payslip = {
  id:         string
  gross:      number
  deductions: number
  net:        number
  pdf_url:    string | null
  created_at: string
}

type LeaveRequest = {
  id:         string
  start_date: string
  end_date:   string
  days:       number
  reason:     string | null
  status:     string
  created_at: string
}

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  admin:       { bg: 'rgba(239,68,68,0.15)',  text: '#F87171' },
  manager:     { bg: 'rgba(99,102,241,0.15)', text: '#818CF8' },
  staff:       { bg: 'rgba(34,197,94,0.15)',  text: '#22C55E' },
  field_agent: { bg: 'rgba(245,158,11,0.15)', text: '#F59E0B' },
}

const LEAVE_STATUS: Record<string, { bg: string; text: string }> = {
  approved: { bg: 'rgba(34,197,94,0.15)',  text: '#22C55E' },
  pending:  { bg: 'rgba(245,158,11,0.15)', text: '#F59E0B' },
  declined: { bg: 'rgba(239,68,68,0.15)',  text: '#F87171' },
}

export default async function StaffDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Same gate as the staff list page — see the comment there.
  if (!(await checkPermission('manage_staff'))) notFound()

  const tenantId = user.app_metadata?.tenant_id as string

  const [staffRes, docsRes, payslipsRes, leaveRes] = await Promise.all([
    supabaseAdmin
      .from('staff')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single(),
    supabaseAdmin
      .from('staff_documents')
      .select('id, title, file_url, file_type, expires_at, created_at')
      .eq('tenant_id', tenantId)
      .eq('staff_id', id)
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('payslips')
      .select('id, gross:gross_salary, deductions:other_deductions_total, net:net_pay, pdf_url, created_at')
      .eq('tenant_id', tenantId)
      .eq('staff_id', id)
      .order('created_at', { ascending: false })
      .limit(12),
    supabaseAdmin
      .from('leave_requests')
      .select('id, start_date, end_date, days, reason, status, created_at')
      .eq('tenant_id', tenantId)
      .eq('staff_id', id)
      .order('start_date', { ascending: false })
      .limit(10),
  ])

  if (!staffRes.data) notFound()

  const staff     = staffRes.data as Staff
  const documents = (docsRes.data ?? []) as Document[]
  const payslips  = (payslipsRes.data ?? []) as Payslip[]
  const leave     = (leaveRes.data ?? []) as LeaveRequest[]

  const color    = avatarColor(staff.id)
  const roleC    = ROLE_COLORS[staff.role ?? 'staff'] ?? ROLE_COLORS.staff
  const scores   = staff.wellness_scores ?? []
  const last8    = scores.slice(-8)
  const wellAvg  = last8.length > 0 ? last8.reduce((a, b) => a + b.score, 0) / last8.length : null
  const leaveLeft = (staff.leave_balance ?? 0) - (staff.leave_taken ?? 0)

  return (
    <div>
      <TopBar title={staff.full_name} subtitle="Staff profile & records" />
      <div className="p-4 md:p-6 space-y-6">

        <Link href="/dashboard/staff"
          className="inline-flex items-center gap-2 text-sm transition-colors"
          style={{ color: 'var(--text-muted)' }}>
          <ArrowLeft className="w-4 h-4" />
          Back to Staff
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left: profile */}
          <div className="space-y-4">
            <div className="glass rounded-2xl p-6">
              <div className="flex flex-col items-center text-center mb-6">
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-bold text-white mb-4"
                  style={{ background: color }}>
                  {staff.full_name.charAt(0)}
                </div>
                <h2 className="text-lg font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                  {staff.full_name}
                </h2>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  {staff.job_title || 'Staff'}{staff.department ? ` · ${staff.department}` : ''}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                    style={{ background: roleC.bg, color: roleC.text }}>
                    {(staff.role ?? 'staff').replace(/_/g, ' ')}
                  </span>
                  {staff.employment_type && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                      style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                      {staff.employment_type.replace(/_/g, ' ')}
                    </span>
                  )}
                  {staff.after_hours_flag && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium"
                      style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B' }}>
                      <ShieldAlert className="w-3 h-3" /> After hours
                    </span>
                  )}
                </div>
              </div>

              {contactRow(<Phone className="w-4 h-4 flex-shrink-0" />, staff.phone)}
              {contactRow(<Mail className="w-4 h-4 flex-shrink-0" />, staff.email)}
              {contactRow(<MapPin className="w-4 h-4 flex-shrink-0" />, staff.address)}
              {contactRow(<IdCard className="w-4 h-4 flex-shrink-0" />, staff.id_number ? `ID ${staff.id_number}` : null)}
              {contactRow(<Calendar className="w-4 h-4 flex-shrink-0" />,
                staff.start_date ? `Started ${new Date(staff.start_date).toLocaleDateString('en-ZA')}` : null)}

              {(staff.emergency_contact_name || staff.emergency_contact_phone) && (
                <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
                  <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>EMERGENCY CONTACT</p>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {staff.emergency_contact_name || '—'}
                    {staff.emergency_contact_phone ? ` · ${staff.emergency_contact_phone}` : ''}
                  </p>
                </div>
              )}
            </div>

            {/* Leave + wellness */}
            <div className="glass rounded-2xl p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide mb-4" style={{ color: 'var(--text-muted)' }}>
                Leave &amp; Wellness
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Leave balance</span>
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {leaveLeft} day{leaveLeft === 1 ? '' : 's'} left
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Wellness (8-check avg)</span>
                  <span className="text-sm font-semibold" style={{ color: wellAvg !== null && wellAvg <= 2.5 ? '#EF4444' : '#22C55E' }}>
                    {wellAvg !== null ? `${wellAvg.toFixed(1)} / 5` : 'No data'}
                  </span>
                </div>
                {last8.length > 0 && (
                  <div className="flex gap-1 pt-1">
                    {last8.map((entry, i) => {
                      const c =
                        entry.score >= 5 ? 'bg-emerald-500' :
                        entry.score >= 4 ? 'bg-emerald-300' :
                        entry.score >= 3 ? 'bg-yellow-400' :
                        entry.score >= 2 ? 'bg-orange-400' : 'bg-red-500'
                      return <div key={i} title={`${entry.date}: ${entry.score}/5`} className={`w-6 h-6 rounded-sm ${c} cursor-default`} />
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: activity columns */}
          <div className="lg:col-span-2 space-y-6">

            {/* Documents */}
            <StaffDocuments staffId={staff.id} documents={documents} />

            {/* Payslips */}
            <div className="glass rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4" style={{ color: 'var(--indigo-light)' }} />
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    Payslips ({payslips.length})
                  </h3>
                </div>
                <Link href="/dashboard/payroll" className="text-xs font-medium" style={{ color: 'var(--indigo-light)' }}>
                  Run payroll →
                </Link>
              </div>
              {payslips.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No payslips yet</p>
                </div>
              ) : (
                <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {payslips.map(p => (
                    <div key={p.id} className="px-5 py-3.5 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                          {new Date(p.created_at).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          Gross {formatZAR(p.gross)} · Deductions {formatZAR(p.deductions)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold" style={{ color: '#22C55E' }}>{formatZAR(p.net)}</span>
                        {p.pdf_url && (
                          <a href={p.pdf_url} target="_blank" rel="noopener noreferrer"
                            className="text-xs" style={{ color: 'var(--indigo-light)' }}>
                            PDF
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Leave history */}
            <div className="glass rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="flex items-center gap-2">
                  <Users2 className="w-4 h-4" style={{ color: 'var(--indigo-light)' }} />
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    Leave History ({leave.length})
                  </h3>
                </div>
              </div>
              {leave.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No leave requests yet</p>
                </div>
              ) : (
                <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {leave.map(req => {
                    const sc = LEAVE_STATUS[req.status] ?? LEAVE_STATUS.pending
                    return (
                      <div key={req.id} className="px-5 py-3.5 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                            {req.start_date} → {req.end_date} ({req.days} day{req.days === 1 ? '' : 's'})
                          </p>
                          {req.reason && (
                            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{req.reason}</p>
                          )}
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: sc.bg, color: sc.text }}>
                          {req.status}
                        </span>
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

function contactRow(icon: React.ReactNode, value: string | null | undefined) {
  if (!value) return null
  return (
    <div className="flex items-center gap-3 mb-3">
      <span style={{ color: 'var(--text-dim)' }}>{icon}</span>
      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{value}</span>
    </div>
  )
}
