import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { TopBar } from '@/components/dashboard/TopBar'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { BotTrainingForm } from './BotTrainingForm'
import { LogoUpload } from './LogoUpload'
import { BusinessDocumentsForm } from './BusinessDocumentsForm'
import { BusinessDetailsForm } from './BusinessDetailsForm'
import { checkPermission } from '@/lib/auth/permissions'

const integrations = [
  { id: 'gmail', label: 'Gmail', icon: '✉️', description: 'Sync inbound emails' },
  { id: 'google_calendar', label: 'Google Calendar', icon: '📅', description: 'Leave and appointment sync' },
  { id: 'google_drive', label: 'Google Drive', icon: '📁', description: 'Document storage' },
  { id: 'xero', label: 'Xero', icon: '📊', description: 'Invoice sync' },
  { id: 'payfast', label: 'PayFast', icon: '💳', description: 'SA payment processing' },
]

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Business profile, integrations and bot training — tenant configuration.
  if (!(await checkPermission('manage_settings'))) notFound()

  const tenantId = user.app_metadata?.tenant_id as string

  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('id, name, plan, business_type, whatsapp_number, country, timezone, settings')
    .eq('id', tenantId)
    .single()

  if (!tenant) redirect('/login')

  const activeIntegrations = tenant.settings?.integrations || []
  const s = (tenant.settings ?? {}) as Record<string, unknown>
  const str = (x: unknown) => (typeof x === 'string' ? x : '')

  return (
    <div>
      <TopBar
        title="Settings"
        actions={
          <Link href="/dashboard/settings/onboarding" className="text-sm text-emerald-600 hover:underline">
            Setup wizard →
          </Link>
        }
      />
      <div className="p-4 md:p-6 space-y-6">

        {/* Business details — identity, registrations, tax year */}
        <Card>
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h3 className="font-semibold text-[var(--text-primary)]">Business Details</h3>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">Your registrations and tax year. These set your compliance deadlines and print on your documents.</p>
            </div>
            <Badge variant="blue">{tenant.plan}</Badge>
          </div>
          <BusinessDetailsForm initial={{
            name: tenant.name ?? '',
            tradingName: str(s.trading_name),
            businessType: tenant.business_type ?? '',
            contactEmail: str(s.contact_email),
            contactPhone: str(s.contact_phone),
            registrationNumber: str(s.registration_number),
            incorporationDate: str(s.incorporation_date),
            financialYearEndMonth: Number(s.financial_year_end_month) || 2,
            incomeTaxNumber: str(s.income_tax_number),
            payeReference: str(s.paye_reference),
            sdlReference: str(s.sdl_reference),
            uifReference: str(s.uif_number),
            payrollDay: Number(s.payroll_day) || 25,
          }} />
          <p className="text-xs text-[var(--text-dim)] mt-4">
            WhatsApp number: {tenant.whatsapp_number || 'not connected'} · Country: {tenant.country} · Time zone: {tenant.timezone}
          </p>
        </Card>

        {/* Business logo */}
        <Card>
          <h3 className="font-semibold text-[var(--text-primary)] mb-1">Business Logo</h3>
          <p className="text-xs text-[var(--text-muted)] mb-4">Appears on payslips, board packs and other documents you export.</p>
          <LogoUpload initialLogo={typeof tenant.settings?.logo_url === 'string' ? tenant.settings.logo_url : null} />
        </Card>

        {/* Invoice/receipt details */}
        <Card>
          <h3 className="font-semibold text-[var(--text-primary)] mb-1">Invoice &amp; Receipt Details</h3>
          <p className="text-xs text-[var(--text-muted)] mb-4">
            Shown on generated invoices, receipts and payslips.
          </p>
          <BusinessDocumentsForm initial={{
            address: tenant.settings?.address || '',
            vatNumber: tenant.settings?.vat_number || '',
            bankName: tenant.settings?.bank_name || '',
            bankAccountHolder: tenant.settings?.bank_account_holder || '',
            bankAccountNumber: tenant.settings?.bank_account_number || '',
            bankBranchCode: tenant.settings?.bank_branch_code || '',
          }} />
        </Card>

        {/* Bot training */}
        <Card>
          <h3 className="font-semibold text-[var(--text-primary)] mb-4">Bot Training</h3>
          <BotTrainingForm initial={{
            policies: tenant.settings?.policies || '',
            faqs: tenant.settings?.faqs || '',
            tone: tenant.settings?.tone || 'warm',
          }} />
        </Card>

        {/* Integrations */}
        <Card>
          <h3 className="font-semibold text-[var(--text-primary)] mb-4">Integrations</h3>
          <div className="space-y-3">
            {integrations.map((integration) => {
              const isConnected = activeIntegrations.includes(integration.id)
              return (
                <div key={integration.id} className="flex items-center justify-between p-3 border border-[var(--border)] rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{integration.icon}</span>
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">{integration.label}</p>
                      <p className="text-xs text-[var(--text-dim)]">{integration.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isConnected ? (
                      <Badge variant="green">Connected</Badge>
                    ) : (
                      <span
                        title="This integration is on our roadmap and not yet available to connect."
                        className="text-sm text-[var(--text-dim)] border border-[var(--border)] px-3 py-1 rounded-lg cursor-default"
                      >
                        Coming soon
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        {/* Account links */}
        <Card>
          <h3 className="font-semibold text-[var(--text-primary)] mb-4">Account & Compliance</h3>
          <div className="space-y-2">
            {[
              { href: '/dashboard/settings/billing',    icon: '💳', label: 'Billing & Plans',         desc: 'Manage your subscription, view usage, upgrade plan' },
              { href: '/dashboard/settings/referrals',  icon: '🎁', label: 'Referral Program',        desc: 'Earn a free month for every business you refer' },
              { href: '/dashboard/settings/compliance', icon: '🛡️', label: 'POPI Compliance Centre', desc: 'Data register, rights management, deletion requests' },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center justify-between p-3 border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{item.icon}</span>
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">{item.label}</p>
                    <p className="text-xs text-[var(--text-dim)]">{item.desc}</p>
                  </div>
                </div>
                <span className="text-[var(--text-dim)] text-sm">→</span>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
