import { SkeletonPage } from '@/components/ui/Skeleton'

// Shown in the children slot while any dashboard page fetches (every page is
// force-dynamic, so navigation blocks on Supabase). The Sidebar/TopBar in the
// layout stay put; only the content area shows the skeleton — no frozen blank,
// which matters on load-shedding-grade connections.
export default function DashboardLoading() {
  return <SkeletonPage />
}
