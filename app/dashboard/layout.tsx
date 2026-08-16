export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { Sidebar } from '@/components/dashboard/Sidebar'
import { RealtimeNotificationBar } from '@/components/dashboard/RealtimeNotificationBar'
import { TrialBanner } from '@/components/dashboard/TrialBanner'
import { DomainGround } from '@/components/dashboard/DomainGround'
import type { BusinessType } from '@/lib/nav/features'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // The tenant's industry scopes the sidebar, so a construction firm no longer
  // sees Stokvel and a law firm no longer sees Creative Assets. Read here rather
  // than in the Sidebar because it is a client component, and this is the one
  // place every dashboard page already passes through.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const tenantId = user?.app_metadata?.tenant_id as string | undefined

  let businessType: BusinessType | null = null
  if (tenantId) {
    const { data } = await supabaseAdmin
      .from('tenants')
      .select('business_type')
      .eq('id', tenantId)
      .maybeSingle()
    businessType = (data?.business_type as BusinessType | null) ?? null
  }

  return (
    <div className="flex min-h-screen app-shell">
      <DomainGround />
      <Sidebar businessType={businessType} />
      <main className="flex-1 md:ml-60 flex flex-col min-h-screen">
        <TrialBanner />
        <RealtimeNotificationBar />
        {children}
      </main>
    </div>
  )
}
