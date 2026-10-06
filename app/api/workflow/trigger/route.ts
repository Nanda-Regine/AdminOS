import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { workflowEngine } from '@/lib/workflow/engine'
import { supabaseAdmin } from '@/lib/supabase/admin'

// POST /api/workflow/trigger — @public n8n hook (shared secret), runs a named
// engine flow for a tenant. Session 20: the secret was compared with `!==`
// (timing leak), and any JSON keys were spread into the flow context
// unvalidated. The engine has one flow; its inputs are now checked.

const schema = z.object({
  flow:     z.literal('whatsapp.inbound'),
  tenantId: z.string().uuid(),
  from:     z.string().regex(/^\+?\d{7,15}$/),
  text:     z.string().min(1).max(4000),
  contactName: z.string().max(200).optional(),
})

function secretOk(given: string | null): boolean {
  const expected = process.env.N8N_WEBHOOK_SECRET
  if (!expected || !given) return false
  const a = Buffer.from(given), b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(request: Request) {
  if (!secretOk(request.headers.get('x-n8n-secret'))) return new NextResponse('Unauthorized', { status: 401 })

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  const { flow, tenantId, from, text, contactName } = parsed.data

  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('*')
    .eq('id', tenantId)
    .eq('active', true)
    .maybeSingle()
  if (!tenant) return new NextResponse('Tenant not found', { status: 404 })

  const result = await workflowEngine.run(flow, { tenant, from, text, contactName })
  return NextResponse.json(result)
}
