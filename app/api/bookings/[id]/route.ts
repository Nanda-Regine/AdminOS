import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'

const updateSchema = z.object({
  status:           z.enum(['pending','confirmed','cancelled','completed','no_show']).optional(),
  cancelledReason:  z.string().max(500).optional(),
  notes:            z.string().max(2000).optional(),
  reminderSentAt:   z.string().datetime().optional(),
})

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.user_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  const { id } = await params

  let body: z.infer<typeof updateSchema>
  try { body = updateSchema.parse(await request.json()) } catch (e) {
    return NextResponse.json({ error: 'Invalid request', detail: e }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  if (body.status !== undefined)         updates.status = body.status
  if (body.cancelledReason !== undefined) updates.cancelled_reason = body.cancelledReason
  if (body.notes !== undefined)          updates.notes = body.notes
  if (body.reminderSentAt !== undefined) updates.reminder_sent_at = body.reminderSentAt

  const { data, error } = await supabaseAdmin
    .from('bookings')
    .update(updates)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
