import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'
import { checkPermission } from '@/lib/auth/permissions'

// Employment Equity — data collection for EEA2/EEA4 reporting
// SA businesses with 50+ employees must submit annual EE reports to the DoEL

const demographicsSchema = z.object({
  african_male:    z.number().int().nonneg().default(0),
  african_female:  z.number().int().nonneg().default(0),
  coloured_male:   z.number().int().nonneg().default(0),
  coloured_female: z.number().int().nonneg().default(0),
  indian_male:     z.number().int().nonneg().default(0),
  indian_female:   z.number().int().nonneg().default(0),
  white_male:      z.number().int().nonneg().default(0),
  white_female:    z.number().int().nonneg().default(0),
  foreign_male:    z.number().int().nonneg().default(0),
  foreign_female:  z.number().int().nonneg().default(0),
  disabled:        z.number().int().nonneg().default(0),
})

const updateSchema = z.object({
  reportingYear:      z.number().int().min(2020).max(2099),
  totalWorkforce:     z.number().int().nonneg().optional(),
  demographics:       demographicsSchema.optional(),
  occupationalLevels: z.record(z.unknown()).optional(),
})

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.user_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  if (!(await checkPermission('manage_staff'))) return new NextResponse('Forbidden', { status: 403 })

  const url  = new URL(request.url)
  const year = url.searchParams.get('year') ?? new Date().getFullYear().toString()

  const { data, error } = await supabaseAdmin
    .from('employment_equity_data')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('reporting_year', parseInt(year))
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // If no record yet, return empty template
  if (!data) {
    return NextResponse.json({
      reporting_year:     parseInt(year),
      total_workforce:    null,
      demographics:       {},
      occupational_levels: {},
      eea2_generated_at:  null,
      message:            'No EE data for this year yet. Use PATCH to populate.',
    })
  }

  return NextResponse.json(data)
}

// PATCH — upsert EE data for a reporting year
export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.user_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  if (!(await checkPermission('manage_staff'))) return new NextResponse('Forbidden', { status: 403 })

  let body: z.infer<typeof updateSchema>
  try { body = updateSchema.parse(await request.json()) } catch (e) {
    return NextResponse.json({ error: 'Invalid request', detail: e }, { status: 400 })
  }

  const upsertData: Record<string, unknown> = {
    tenant_id:      tenantId,
    reporting_year: body.reportingYear,
  }
  if (body.totalWorkforce     !== undefined) upsertData.total_workforce     = body.totalWorkforce
  if (body.demographics       !== undefined) upsertData.demographics        = body.demographics
  if (body.occupationalLevels !== undefined) upsertData.occupational_levels = body.occupationalLevels

  const { data, error } = await supabaseAdmin
    .from('employment_equity_data')
    .upsert(upsertData, { onConflict: 'tenant_id,reporting_year' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
