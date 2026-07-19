import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { TopBar } from '@/components/dashboard/TopBar'
import { redirect } from 'next/navigation'
import { OnboardingTraining } from './OnboardingTraining'
import { toLang } from '@/lib/onboarding/training'

export const dynamic = 'force-dynamic'

export default async function GettingStartedPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const tenantId = user.app_metadata?.tenant_id as string

  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('language_primary')
    .eq('id', tenantId)
    .maybeSingle()

  return (
    <div>
      <TopBar title="Getting Started" subtitle="Your step-by-step setup guide" />
      <div className="p-6">
        <OnboardingTraining defaultLang={toLang(tenant?.language_primary)} />
      </div>
    </div>
  )
}
