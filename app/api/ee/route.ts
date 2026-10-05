import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'
import { withRoute, unwrap } from '@/lib/api/withRoute'

// Employment Equity — data collection for EEA2/EEA4 reporting.
// Designated employers (50+ employees) report annually to the DEL.

const count = z.number().int().nonnegative().max(1_000_000).default(0)
const demographicsSchema = z.object({
  african_male:    count,
  african_female:  count,
  coloured_male:   count,
  coloured_female: count,
  indian_male:     count,
  indian_female:   count,
  white_male:      count,
  white_female:    count,
  foreign_male:    count,
  foreign_female:  count,
  disabled:        count,   // a subset of the people above, not an extra group
})

const POPULATION_KEYS = [
  'african_male', 'african_female', 'coloured_male', 'coloured_female', 'indian_male',
  'indian_female', 'white_male', 'white_female', 'foreign_male', 'foreign_female',
] as const

const updateSchema = z.object({
  reportingYear:      z.number().int().min(2020).max(2099),
  totalWorkforce:     z.number().int().nonnegative().max(1_000_000).optional(),
  demographics:       demographicsSchema.optional(),
  occupationalLevels: z.record(z.string().max(100), z.unknown()).optional(),
}).superRefine((b, issue) => {
  // The EEA2 form rejects a report whose breakdown doesn't add up to the
  // workforce total — catch it here, not at the DEL.
  if (!b.demographics) return
  const sum = POPULATION_KEYS.reduce((s, k) => s + b.demographics![k], 0)
  if (b.totalWorkforce !== undefined && sum > 0 && sum !== b.totalWorkforce) {
    issue.addIssue({ code: 'custom', path: ['demographics'], message: `The breakdown adds up to ${sum}, but total workforce is ${b.totalWorkforce}.` })
  }
  if (b.demographics.disabled > sum && sum > 0) {
    issue.addIssue({ code: 'custom', path: ['demographics', 'disabled'], message: 'People with disabilities are counted inside the groups above, so this can’t exceed their total.' })
  }
})

const yearQuery = z.object({ year: z.coerce.number().int().min(2020).max(2099).optional() })

export const GET = withRoute({ action: 'hr.records', query: yearQuery }, async ({ ctx, query }) => {
  const year = query.year ?? new Date().getFullYear()
  const data = unwrap(await supabaseAdmin
    .from('employment_equity_data')
    .select('id, reporting_year, total_workforce, demographics, occupational_levels, eea2_generated_at, report_url')
    .eq('tenant_id', ctx.tenantId)
    .eq('reporting_year', year)
    .maybeSingle())

  // No record yet → an empty template for the form.
  return data ?? {
    reporting_year:      year,
    total_workforce:     null,
    demographics:        {},
    occupational_levels: {},
    eea2_generated_at:   null,
  }
})

// PATCH — upsert EE data for a reporting year.
export const PATCH = withRoute({
  action: 'hr.records',
  body: updateSchema,
  audit: 'ee.data_updated',
  resourceType: 'employment_equity_data',
}, async ({ ctx, body }) => {
  const row: Record<string, unknown> = { tenant_id: ctx.tenantId, reporting_year: body.reportingYear }
  if (body.totalWorkforce     !== undefined) row.total_workforce     = body.totalWorkforce
  if (body.demographics       !== undefined) row.demographics        = body.demographics
  if (body.occupationalLevels !== undefined) row.occupational_levels = body.occupationalLevels

  return unwrap(await supabaseAdmin
    .from('employment_equity_data')
    .upsert(row, { onConflict: 'tenant_id,reporting_year' })
    .select('id, reporting_year, total_workforce, demographics, occupational_levels, eea2_generated_at, report_url')
    .single(), { required: true })
})
