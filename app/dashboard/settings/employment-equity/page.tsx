import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { TopBar } from '@/components/dashboard/TopBar'
import { EmploymentEquityClient, type EEData } from './EmploymentEquityClient'

export const metadata = {
  title: 'Employment Equity — AdminOS',
  description: 'Workforce demographics for EEA2/EEA4 reporting to the Department of Employment and Labour.',
}

/**
 * employment_equity_data shipped with a working GET/PATCH API and a full
 * printable EEA2 report generator — and no page to enter the demographics or
 * reach the report. Same "backend ahead of the front door" pattern as
 * Suppliers/Licences/Safety before it.
 */
export default async function EmploymentEquityPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const tenantId = user.app_metadata?.tenant_id as string | undefined
  if (!tenantId) redirect('/dashboard')

  const currentYear = new Date().getFullYear()

  const { data } = await supabaseAdmin
    .from('employment_equity_data')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('reporting_year', currentYear)
    .maybeSingle()

  const initial: EEData = data
    ? (data as EEData)
    : {
        reporting_year:  currentYear,
        total_workforce: null,
        demographics:    {},
        eea2_generated_at: null,
      }

  return (
    <>
      <TopBar
        title="Employment Equity"
        subtitle="Workforce demographics for EEA2/EEA4 reporting"
      />
      <div className="p-4 md:p-6">
        <EmploymentEquityClient initial={initial} currentYear={currentYear} />
      </div>
    </>
  )
}
