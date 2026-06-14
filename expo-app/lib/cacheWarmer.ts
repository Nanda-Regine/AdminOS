import { QueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'

// Per-entity stale times (ms). Longer = cached longer before background refetch.
export const STALE = {
  payslips:      1000 * 60 * 60 * 24 * 7, // 7 days — payslips don't change once issued
  team:          1000 * 60 * 60,           // 1 hour — team changes rarely
  announcements: 1000 * 60 * 30,           // 30 min
  tasks:         1000 * 60 * 15,           // 15 min
  invoices:      1000 * 60 * 5,            // 5 min — financial data
  healthScore:   1000 * 60 * 10,           // 10 min
} as const

export async function warmCache(queryClient: QueryClient, tenantId: string) {
  const prefetch = async <T>(
    key: unknown[],
    fn: () => Promise<T>,
    staleTime: number,
  ) => {
    // Only warm if not already fresh in cache
    const cached = queryClient.getQueryState(key)
    const isStale = !cached?.dataUpdatedAt || Date.now() - cached.dataUpdatedAt > staleTime
    if (!isStale) return

    await queryClient.prefetchQuery({ queryKey: key, queryFn: fn, staleTime })
  }

  await Promise.allSettled([
    prefetch(
      ['invoices', tenantId],
      async () => {
        const { data } = await supabase
          .from('invoices')
          .select('id, invoice_number, status, total_amount, due_date, contact_id')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(50)
        return data ?? []
      },
      STALE.invoices,
    ),

    prefetch(
      ['team', tenantId],
      async () => {
        const { data } = await supabase
          .from('staff')
          .select('id, full_name, role, department, status, avatar_url')
          .eq('tenant_id', tenantId)
          .eq('status', 'active')
        return data ?? []
      },
      STALE.team,
    ),

    prefetch(
      ['announcements', tenantId],
      async () => {
        const { data } = await supabase
          .from('announcements')
          .select('id, title, body, created_at, pinned')
          .eq('tenant_id', tenantId)
          .order('pinned', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(20)
        return data ?? []
      },
      STALE.announcements,
    ),

    prefetch(
      ['tasks', tenantId],
      async () => {
        const { data } = await supabase
          .from('tasks')
          .select('id, title, status, priority, due_date, assigned_to')
          .eq('tenant_id', tenantId)
          .neq('status', 'done')
          .order('priority', { ascending: true })
          .limit(40)
        return data ?? []
      },
      STALE.tasks,
    ),

    prefetch(
      ['health-score', tenantId],
      async () => {
        const { data } = await supabase
          .from('health_scores')
          .select('score, dimensions')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()
        return data
      },
      STALE.healthScore,
    ),
  ])
}
