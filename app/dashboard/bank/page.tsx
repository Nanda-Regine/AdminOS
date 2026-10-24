import { redirect, notFound } from 'next/navigation'
import { Landmark } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { checkPermission } from '@/lib/auth/permissions'
import { TopBar } from '@/components/dashboard/TopBar'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/EmptyState'
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

  const tenantId = user.app_metadata?.tenant_id as string | undefined
  if (!tenantId) redirect('/dashboard')

  const { data: first } = await supabaseAdmin
    .from('bank_transactions')
    .select('id')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .limit(1)
  const hasLines = (first?.length ?? 0) > 0

  return (
    <>
      <TopBar title="Bank & Reconciliation" subtitle="Upload a statement — we categorise it and match payments to invoices" />
      {!hasLines && (
        <div className="p-4 md:p-6 pb-0 md:pb-0">
          <Card>
            <EmptyState
              icon={Landmark}
              title="No bank statement yet"
              body="Export a CSV from your banking app and upload it below. Payments from customers are matched to your invoices, and spending is sorted into categories for your accountant."
            />
          </Card>
        </div>
      )}
      <BankClient hasLines={hasLines} />
    </>
  )
}
