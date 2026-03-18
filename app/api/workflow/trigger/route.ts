import { NextResponse } from 'next/server'
import { workflowEngine } from '@/lib/workflow/engine'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  const authHeader = request.headers.get('x-n8n-secret')
  if (authHeader !== process.env.N8N_WEBHOOK_SECRET) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const body = await request.json()
  const { flow, tenantId, ...ctx } = body

  if (!flow || !tenantId) {
    return new NextResponse('Missing flow or tenantId', { status: 400 })
  }

  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('*')
    .eq('id', tenantId)
    .eq('active', true)
    .single()

  if (!tenant) {
    return new NextResponse('Tenant not found', { status: 404 })
  }

  const result = await workflowEngine.run(flow, { tenant, ...ctx })

  return NextResponse.json(result)
}
