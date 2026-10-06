import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Payslip } from '@/lib/types'

/** The caller's paid payslips (memory-only cache — see lib/queryClient). */
export function usePayslips(staffId: string | undefined) {
  return useQuery({
    queryKey: ['payslips', staffId],
    queryFn: () => api.get<Payslip[]>(`/api/staff/${staffId}/payslips`),
    enabled: Boolean(staffId),
    staleTime: 5 * 60_000,
  })
}
