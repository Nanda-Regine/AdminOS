import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { notifyTenant } from '@/lib/notifications/notify'
import { z } from 'zod'

const createSchema = z.object({
  staffId:     z.string().uuid(),
  amount:      z.number().positive(),
  category:    z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  receiptUrl:  z.string().url().optional(),
})

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.app_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  const url    = new URL(request.url)
  const status = url.searchParams.get('status')
  const staffId = url.searchParams.get('staffId')

  let query = supabaseAdmin
    .from('expenses')
    .select('*, staff(full_name, job_title)')
    .eq('tenant_id', tenantId)
    .order('submitted_at', { ascending: false })

  if (status)  query = query.eq('status', status)
  if (staffId) query = query.eq('staff_id', staffId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.app_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  let body: z.infer<typeof createSchema>
  try {
    body = createSchema.parse(await request.json())
  } catch (e) {
    return NextResponse.json({ error: 'Invalid request', detail: e }, { status: 400 })
  }

  const { data: staff } = await supabaseAdmin
    .from('staff')
    .select('id')
    .eq('id', body.staffId)
    .eq('tenant_id', tenantId)
    .single()

  if (!staff) return new NextResponse('Staff not found', { status: 404 })

  const { data, error } = await supabaseAdmin
    .from('expenses')
    .insert({
      tenant_id:   tenantId,
      staff_id:    body.staffId,
      amount:      body.amount,
      category:    body.category,
      description: body.description ?? null,
      receipt_url: body.receiptUrl ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Push the owner: an approval is waiting (People cockpit surfaces it too).
  await notifyTenant(tenantId, {
    type: 'approval.needed',
    title: 'Expense to approve',
    body: `A new expense claim for R${Number(body.amount).toLocaleString('en-ZA')}${body.category ? ` (${body.category})` : ''} is waiting for your approval.`,
    actionUrl: '/dashboard/expenses',
    dedupeKey: `expense-${data.id}`,
    whatsapp: true,
  })

  return NextResponse.json(data, { status: 201 })
}
