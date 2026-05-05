import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const { id } = await params
  const tenantId = user.user_metadata?.tenant_id as string

  const body = await request.json() as { contact_identifier: string }
  if (!body.contact_identifier?.trim()) {
    return NextResponse.json({ error: 'contact_identifier required' }, { status: 400 })
  }

  // Verify sequence belongs to tenant and is active
  const { data: sequence } = await supabaseAdmin
    .from('whatsapp_sequences')
    .select('id, steps, is_active')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (!sequence)         return NextResponse.json({ error: 'Sequence not found' },       { status: 404 })
  if (!sequence.is_active) return NextResponse.json({ error: 'Sequence is not active' }, { status: 400 })

  const steps = sequence.steps as Array<{ delay_hours: number }>
  if (!steps?.length)    return NextResponse.json({ error: 'Sequence has no steps' },    { status: 400 })

  // First step fires at: now + step[0].delay_hours
  const firstDelay = steps[0].delay_hours ?? 0
  const nextStepAt = new Date(Date.now() + firstDelay * 60 * 60 * 1000).toISOString()

  // Prevent duplicate enrollment for same contact in same sequence
  const { data: existing } = await supabaseAdmin
    .from('sequence_enrollments')
    .select('id, status')
    .eq('sequence_id', id)
    .eq('contact_identifier', body.contact_identifier.trim())
    .eq('status', 'active')
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'Contact already enrolled in this sequence' }, { status: 409 })
  }

  const { data, error } = await supabaseAdmin
    .from('sequence_enrollments')
    .insert({
      tenant_id:          tenantId,
      sequence_id:        id,
      contact_identifier: body.contact_identifier.trim(),
      current_step:       0,
      next_step_at:       nextStepAt,
      status:             'active',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
