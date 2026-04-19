export const dynamic = 'force-dynamic'

import { Sidebar } from '@/components/dashboard/Sidebar'
import { RealtimeNotificationBar } from '@/components/dashboard/RealtimeNotificationBar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#F8F9FB]">
      <Sidebar />
      <main className="flex-1 ml-60 flex flex-col min-h-screen">
        <RealtimeNotificationBar />
        {children}
      </main>
    </div>
  )
}
