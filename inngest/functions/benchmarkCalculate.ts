import { inngest } from '@/inngest/client'
import { supabaseAdmin } from '@/lib/supabase/admin'

// Calculates the median of a numeric array (returns null if empty)
function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

// Runs every Sunday at 2am — aggregates anonymized benchmark metrics by business type
export const benchmarkCalculateFunction = inngest.createFunction(
  { id: 'benchmark-calculate-weekly', retries: 2, triggers: [{ cron: '0 2 * * 0' }] },
  async ({ step }: any) => {
    // Step 1: Get all active tenants with their business type
    const tenants = await step.run('get-tenants', async () => {
      const { data } = await supabaseAdmin
        .from('tenants')
        .select('id, business_type, plan')
        .eq('status', 'active')
        .not('business_type', 'is', null)

      return (data ?? []) as Array<{ id: string; business_type: string; plan: string }>
    })

    if (tenants.length === 0) return { business_types: 0, metrics_upserted: 0 }

    // Group tenant IDs by business type
    const byType: Record<string, string[]> = {}
    for (const t of tenants) {
      if (!byType[t.business_type]) byType[t.business_type] = []
      byType[t.business_type].push(t.id)
    }

    const businessTypes = Object.keys(byType)
    let metricsUpserted = 0

    // Step 2: For each business type, aggregate and upsert benchmarks
    for (const businessType of businessTypes) {
      const tenantIds = byType[businessType]

      // eslint-disable-next-line no-await-in-loop
      await step.run(`benchmark-${businessType}`, async () => {
        // Fetch last 30 days of invoice totals
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

        const [invoiceData, staffData, payrollData] = await Promise.all([
          supabaseAdmin
            .from('invoices')
            .select('tenant_id, total')
            .in('tenant_id', tenantIds)
            .eq('status', 'paid')
            .gte('created_at', thirtyDaysAgo.toISOString()),
          supabaseAdmin
            .from('staff')
            .select('tenant_id, id')
            .in('tenant_id', tenantIds),
          supabaseAdmin
            .from('payroll_runs')
            .select('tenant_id, total_gross')
            .in('tenant_id', tenantIds)
            .gte('created_at', thirtyDaysAgo.toISOString()),
        ])

        const invoices = invoiceData.data ?? []
        const staffList = staffData.data ?? []
        const payrollRuns = payrollData.data ?? []

        // Monthly revenue per tenant (sum of paid invoices in last 30d)
        const revenueByTenant: Record<string, number> = {}
        for (const inv of invoices) {
          revenueByTenant[inv.tenant_id] = (revenueByTenant[inv.tenant_id] ?? 0) + Number(inv.total ?? 0)
        }

        // Staff count per tenant
        const staffByTenant: Record<string, number> = {}
        for (const s of staffList) {
          staffByTenant[s.tenant_id] = (staffByTenant[s.tenant_id] ?? 0) + 1
        }

        // Payroll per staff (total gross / staff count) per tenant
        const payrollByTenant: Record<string, number> = {}
        for (const run of payrollRuns) {
          payrollByTenant[run.tenant_id] = (payrollByTenant[run.tenant_id] ?? 0) + Number(run.total_gross ?? 0)
        }

        const monthlyRevenues = Object.values(revenueByTenant)
        const staffCounts = tenantIds.map((id) => staffByTenant[id] ?? 0)
        const payrollPerStaff = tenantIds
          .filter((id) => (staffByTenant[id] ?? 0) > 0)
          .map((id) => (payrollByTenant[id] ?? 0) / staffByTenant[id])

        const now = new Date().toISOString()
        const sampleSize = tenantIds.length

        const metrics: Array<{ metric: string; value: number | null }> = [
          { metric: 'monthly_revenue', value: median(monthlyRevenues) },
          { metric: 'staff_count', value: median(staffCounts) },
          { metric: 'payroll_per_staff', value: median(payrollPerStaff) },
        ]

        for (const { metric, value } of metrics) {
          if (value === null) continue

          const { error } = await supabaseAdmin
            .from('industry_benchmarks')
            .upsert(
              {
                business_type: businessType,
                metric,
                value,
                sample_size: sampleSize,
                calculated_at: now,
              },
              { onConflict: 'business_type,metric' }
            )

          if (error) {
            console.error(`Benchmark upsert failed for ${businessType}/${metric}:`, error.message)
          } else {
            metricsUpserted++
          }
        }
      })
    }

    return { business_types: businessTypes.length, metrics_upserted: metricsUpserted }
  }
)
