export const dynamic = 'force-dynamic'

import { getCurrentUser } from '@/lib/auth/currentUser'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { Sidebar } from '@/components/dashboard/Sidebar'
import { RealtimeNotificationBar } from '@/components/dashboard/RealtimeNotificationBar'
import { TrialBanner } from '@/components/dashboard/TrialBanner'
import { DomainGround } from '@/components/dashboard/DomainGround'
import type { BusinessType } from '@/lib/nav/features'
import { getContext } from '@/lib/auth/context'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // The tenant's industry scopes the sidebar, so a construction firm no longer
  // sees Stokvel and a law firm no longer sees Creative Assets. Read here rather
  // than in the Sidebar because it is a client component, and this is the one
  // place every dashboard page already passes through.
  const user = await getCurrentUser()
  const tenantId = user?.app_metadata?.tenant_id as string | undefined

  // The caller's permissions scope the sidebar to pages they can actually open.
  // No role record → only member pages (fail closed); super-admins see all.
  // Independent of the tenant read, so the two run together.
  const [tenantRow, ctx] = await Promise.all([
    tenantId
      ? supabaseAdmin.from('tenants').select('business_type').eq('id', tenantId).maybeSingle()
      : Promise.resolve({ data: null }),
    user ? getContext() : Promise.resolve(null),
  ])
  const businessType = (tenantRow.data?.business_type as BusinessType | null) ?? null
  const permissions = ctx?.isSuperAdmin ? null : (ctx?.permissions ?? [])

  return (
    <div className="flex min-h-screen app-shell">
      <DomainGround />
      <Sidebar businessType={businessType} permissions={permissions} />
      <main className="flex-1 min-w-0 md:ml-60 flex flex-col min-h-screen">
        <TrialBanner />
        <RealtimeNotificationBar />
        {children}
      </main>
    </div>
  )
}
