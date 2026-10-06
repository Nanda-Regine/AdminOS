import { notFound } from 'next/navigation'
import { checkPermission } from '@/lib/auth/permissions'

// The setup wizard edits the business profile and adds staff: owner/admin only, like the Settings page.
export default async function Layout({ children }: { children: React.ReactNode }) {
  if (!(await checkPermission('manage_settings'))) notFound()
  return children
}
