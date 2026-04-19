import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { orchestrator, AGENT_CONFIGS } from '@/lib/ai/orchestrator'
import { checkRateLimit } from '@/lib/security/rateLimit'
import { getClientIp } from '@/lib/security/audit'
import type { AgentName } from '@/lib/ai/types'
import { z } from 'zod'

interface AgentRouteParams {
  params: Promise<{ agentType: string }>
}

const bodySchema = z.object({
  userMessage: z.string().min(1).max(10_000),
  contactIdentifier: z.string().optional(),
  conversationId: z.string().optional(),
  documentId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export async function POST(request: Request, { params }: AgentRouteParams) {
  const { agentType } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.user_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('Tenant not found', { status: 403 })

  const { success } = await checkRateLimit('agents', tenantId)
  if (!success) return new NextResponse('Too Many Requests', { status: 429 })

  const agentName = agentType as AgentName
  if (!AGENT_CONFIGS[agentName]) return new NextResponse('Unknown agent', { status: 400 })

  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const config = AGENT_CONFIGS[agentName]

  if (config.streaming) {
    const stream = await orchestrator.stream({
      agentName,
      userMessage: body.userMessage,
      tenantId,
      conversationId: body.conversationId,
      contactIdentifier: body.contactIdentifier,
      documentId: body.documentId,
      metadata: { ...body.metadata, callerIp: getClientIp(request) },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  }

  const result = await orchestrator.run({
    agentName,
    userMessage: body.userMessage,
    tenantId,
    conversationId: body.conversationId,
    contactIdentifier: body.contactIdentifier,
    documentId: body.documentId,
    metadata: { ...body.metadata, callerIp: getClientIp(request) },
  })

  return NextResponse.json(result)
}
