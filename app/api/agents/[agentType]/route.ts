import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callClaudeAgent } from '@/lib/ai/callClaude'
import { AGENT_DEFINITIONS, AgentType, buildAgentContext, storeAdvisorInsights } from '@/lib/ai/agents'
import { checkRateLimit } from '@/lib/security/rateLimit'
import { writeAuditLog, getClientIp } from '@/lib/security/audit'
import { z } from 'zod'

interface AgentRouteParams {
  params: Promise<{ agentType: string }>
}

const bodySchema = z.object({
  context: z.string().min(1).max(10_000),
  contactIdentifier: z.string().optional(),
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

  const agent = AGENT_DEFINITIONS[agentType as AgentType]
  if (!agent) return new NextResponse('Unknown agent type', { status: 400 })

  // Validate request body
  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // Build enriched context (lookup + advisor pull real DB data)
  const enrichedContext = await buildAgentContext(
    agentType as AgentType,
    tenantId,
    body.context,
    body.contactIdentifier
  )

  const systemPrompt = agent.buildPrompt()
  const response = await callClaudeAgent(systemPrompt, enrichedContext, 600)

  // For advisor agent: store extracted insights for future sessions (non-blocking)
  if (agentType === 'advisor' && response) {
    storeAdvisorInsights(tenantId, response).catch(() => {})
  }

  await writeAuditLog({
    tenantId,
    actor: user.id,
    action: `agent.${agentType}.called`,
    ipAddress: getClientIp(request),
    metadata: { contextLength: body.context.length },
  })

  return NextResponse.json({ response })
}
