import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { checkPermission } from '@/lib/auth/permissions'
import { TopBar } from '@/components/dashboard/TopBar'
import { BankClient } from './BankClient'

export const metadata = {
  title: 'Bank & Reconciliation — AdminOS',
  description: 'Upload a bank statement, categorise every line and match payments to invoices.',
}
export const dynamic = 'force-dynamic'

/**
 * Bank statements → books. The owner uploads a CSV from FNB, Capitec, ABSA, Standard Bank,
 * Nedbank or TymeBank; AdminOS categorises each line, matches money received to the invoices
 * it paid, and records those payments once a person confirms. Same view_financials boundary
 * as the Cash Cockpit; notFound() not a redirect, per the page-denial convention in lib/auth/context.ts.
 */
export default async function BankPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (!(await checkPermission('view_financials'))) notFound()

  return (
    <>
      <TopBar title="Bank & Reconciliation" subtitle="Upload a statement — we categorise it and match payments to invoices" />
      <BankClient />
    </>
  )
}
