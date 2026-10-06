import { notFound } from 'next/navigation'
import { checkPermission } from '@/lib/auth/permissions'

// Reach and its new-campaign builder (a client page) had no page gate — only the API checked. Matches broadcasts.send.
export default async function Layout({ children }: { children: React.ReactNode }) {
  if (!(await checkPermission('send_broadcasts'))) notFound()
  return children
}
