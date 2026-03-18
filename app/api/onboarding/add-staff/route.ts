import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'

const bodySchema = z.object({
  staff: z.array(z.object({
    full_name: z.string().min(1),
    phone: z.string().optional(),
    email: z.string().email().optional().or(z.literal('')),
    role: z.string().optional(),
  })).min(1),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.user_metadata?.tenant_id as string

  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: 'Invalid staff data' }, { status: 400 })
  }

  const rows = body.staff.map((s) => ({
    tenant_id: tenantId,
    full_name: s.full_name,
    phone: s.phone || null,
    email: s.email || null,
    role: s.role || 'staff',
    leave_balance: 15,
    leave_taken: 0,
    wellness_scores: [],
    after_hours_flag: false,
  }))

  const { error } = await supabaseAdmin.from('staff').insert(rows)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ success: true, added: rows.length })
}
