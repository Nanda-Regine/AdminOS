export const dynamic = 'force-dynamic'

import { Sidebar } from '@/components/dashboard/Sidebar'
import { RealtimeNotificationBar } from '@/components/dashboard/RealtimeNotificationBar'
import { DomainGround } from '@/components/dashboard/DomainGround'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen app-shell">
      <DomainGround />
      <Sidebar />
      <main className="flex-1 md:ml-60 flex flex-col min-h-screen">
        <RealtimeNotificationBar />
        {children}
      </main>
    </div>
  )
}
