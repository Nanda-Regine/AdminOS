import { inngest } from '@/inngest/client'
import { supabaseAdmin } from '@/lib/supabase/admin'

// Runs weekly on Monday at 2am — calculates platform-wide impact metrics
export const impactSnapshotFunction = inngest.createFunction(
  { id: 'impact-snapshot-weekly' },
  { cron: '0 2 * * 1' },
  async () => {
    const today = new Date().toISOString().split('T')[0]

    const [
      totalBusinesses,
      activeBusinesses,
      staffCount,
      formalized,
      womenOwned,
      stokvels,
      certificates,
      mentorships,
      debtRecovered,
    ] = await Promise.all([
      supabaseAdmin.from('tenants').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('tenants').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabaseAdmin.from('staff').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabaseAdmin.from('formalization_progress').select('id', { count: 'exact', head: true }).not('completed_at', 'is', null),
      supabaseAdmin.from('tenants').select('id', { count: 'exact', head: true }).eq('women_owned', true),
      supabaseAdmin.from('stokvel_groups').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabaseAdmin.from('academy_certificates').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('mentor_connections').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabaseAdmin.from('invoices').select('total').eq('status', 'paid'),
    ])

    const totalDebt = (debtRecovered.data ?? []).reduce((s, inv) => s + (inv.total ?? 0), 0)

    await supabaseAdmin.from('impact_snapshots').upsert({
      snapshot_date:               today,
      total_businesses:            totalBusinesses.count ?? 0,
      active_businesses:           activeBusinesses.count ?? 0,
      total_staff_on_platform:     staffCount.count ?? 0,
      jobs_protected_estimate:     (staffCount.count ?? 0) + (activeBusinesses.count ?? 0),
      businesses_formalised:       formalized.count ?? 0,
      women_owned_businesses:      womenOwned.count ?? 0,
      stokvel_groups_count:        stokvels.count ?? 0,
      informal_pathway_completions: formalized.count ?? 0,
      academy_certificates_issued: certificates.count ?? 0,
      mentorship_connections:      mentorships.count ?? 0,
      total_debt_recovered_zar:    totalDebt,
    })

    return {
      snapshot_date:   today,
      total_businesses: totalBusinesses.count,
      jobs_protected:   (staffCount.count ?? 0) + (activeBusinesses.count ?? 0),
    }
  }
)
