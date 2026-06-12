import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'
import { checkAchievements } from '@/lib/academy/checkAchievements'
import { fireBusinessEvent } from '@/lib/academy/knowledgeGraph'

const updateSchema = z.object({
  cipcRegistered:        z.boolean().optional(),
  cipcNumber:            z.string().max(50).optional(),
  sarsRegistered:        z.boolean().optional(),
  sarsReference:         z.string().max(50).optional(),
  vatRegistered:         z.boolean().optional(),
  vatNumber:             z.string().max(50).optional(),
  businessAccountOpened: z.boolean().optional(),
  firstContractSigned:   z.boolean().optional(),
  firstInvoiceSent:      z.boolean().optional(),
  firstEmployeeHired:    z.boolean().optional(),
  uifRegistered:         z.boolean().optional(),
})

const MILESTONE_EVENTS: Record<string, string> = {
  cipc_registered:         'formalization.cipc',
  sars_registered:         'formalization.sars',
  vat_registered:          'formalization.vat',
  business_account_opened: 'formalization.bank_account',
  first_contract_signed:   'formalization.first_contract',
  first_invoice_sent:      'formalization.first_invoice',
  first_employee_hired:    'formalization.first_hire',
  uif_registered:          'formalization.uif',
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.user_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('formalization_progress')
    .select('*')
    .eq('tenant_id', tenantId)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Compute completion score
  const boolFields = [
    'cipc_registered','sars_registered','vat_registered',
    'business_account_opened','first_contract_signed',
    'first_invoice_sent','first_employee_hired','uif_registered',
  ]
  const completed = boolFields.filter(f => data[f]).length
  const score     = Math.round((completed / boolFields.length) * 100)

  return NextResponse.json({ ...data, completion_score: score })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.user_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  let body: z.infer<typeof updateSchema>
  try { body = updateSchema.parse(await request.json()) } catch (e) {
    return NextResponse.json({ error: 'Invalid request', detail: e }, { status: 400 })
  }

  // Fetch current state so we can detect newly-completed milestones
  const { data: current } = await supabaseAdmin
    .from('formalization_progress')
    .select('*')
    .eq('tenant_id', tenantId)
    .single()

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.cipcRegistered        !== undefined) { updates.cipc_registered         = body.cipcRegistered }
  if (body.cipcNumber            !== undefined) { updates.cipc_number             = body.cipcNumber }
  if (body.sarsRegistered        !== undefined) { updates.sars_registered         = body.sarsRegistered }
  if (body.sarsReference         !== undefined) { updates.sars_reference          = body.sarsReference }
  if (body.vatRegistered         !== undefined) { updates.vat_registered          = body.vatRegistered }
  if (body.vatNumber             !== undefined) { updates.vat_number              = body.vatNumber }
  if (body.businessAccountOpened !== undefined) { updates.business_account_opened = body.businessAccountOpened }
  if (body.firstContractSigned   !== undefined) { updates.first_contract_signed   = body.firstContractSigned }
  if (body.firstInvoiceSent      !== undefined) { updates.first_invoice_sent      = body.firstInvoiceSent }
  if (body.firstEmployeeHired    !== undefined) { updates.first_employee_hired    = body.firstEmployeeHired }
  if (body.uifRegistered         !== undefined) { updates.uif_registered          = body.uifRegistered }

  const { data, error } = await supabaseAdmin
    .from('formalization_progress')
    .update(updates)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Fire events for newly-completed milestones
  for (const [dbField, eventType] of Object.entries(MILESTONE_EVENTS)) {
    if (data[dbField] && !current?.[dbField]) {
      fireBusinessEvent(eventType, tenantId, user.id)
    }
  }

  // Check if fully formalized (all booleans true)
  const allDone = [
    data.cipc_registered, data.sars_registered, data.business_account_opened,
    data.first_invoice_sent, data.first_employee_hired,
  ].every(Boolean)

  if (allDone && !data.completed_at) {
    await supabaseAdmin
      .from('formalization_progress')
      .update({ completed_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)

    checkAchievements({ tenantId, userId: user.id, event: 'formalization.complete' }).catch(() => null)
  }

  return NextResponse.json(data)
}
