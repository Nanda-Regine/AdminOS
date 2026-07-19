import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/dashboard/TopBar'
import { redirect } from 'next/navigation'
import { ReportsPanel } from './ReportsPanel'
import { FileSpreadsheet } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function ReportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div>
      <TopBar title="Accountant Reports" subtitle="A perfectly categorised monthly pack" />
      <div className="p-6 space-y-6">
        <div className="rounded-2xl px-6 py-5 relative overflow-hidden border on-dark"
          style={{ background: 'linear-gradient(135deg, #101a3e 0%, #16224a 100%)', borderColor: 'var(--border)' }}>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(99,102,241,0.2)' }}>
              <FileSpreadsheet className="w-5 h-5" style={{ color: 'var(--indigo-light)' }} />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Hand your accountant a perfect pack</p>
              <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Pick a month and download clean, categorised working papers — income statement, VAT201, journal, expenses, and more. No accounting-software sync to set up or maintain.
              </p>
            </div>
          </div>
        </div>

        <ReportsPanel />
      </div>
    </div>
  )
}
