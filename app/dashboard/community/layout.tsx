import { notFound } from 'next/navigation'
import { checkPermission } from '@/lib/auth/permissions'

// The page is a client component, so its gate lives here. It had none: any
// login could open it and meet a screen of failing API calls. The community is the owner network: posts go out under the business's name.
export default async function Layout({ children }: { children: React.ReactNode }) {
  if (!(await checkPermission('view_analytics'))) notFound()
  return children
}
