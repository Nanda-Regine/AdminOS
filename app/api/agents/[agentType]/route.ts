import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { orchestrator, AGENT_CONFIGS } from '@/lib/ai/orchestrator'
import { AGENT_DEFINITIONS, type AgentType } from '@/lib/ai/agents.config'
import { buildAgentContext, storeAdvisorInsights } from '@/lib/ai/agents'
import { callClaudeAgent } from '@/lib/ai/callClaude'
import { checkRateLimit } from '@/lib/security/rateLimit'
import { getClientIp, writeAuditLog } from '@/lib/security/audit'
import { checkBudget } from '@/lib/ai/costControls'
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

  const tenantId = user.app_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('Tenant not found', { status: 403 })

  const { success } = await checkRateLimit('agents', tenantId)
  if (!success) return new NextResponse('Too Many Requests', { status: 429 })

  // Two agent registries exist: AGENT_CONFIGS (orchestrator personas — alex/chase/
  // care/doc/insight/pen) and AGENT_DEFINITIONS (the Inbox panel's agents — draft/
  // summarise/lookup/escalation/advisor). Both are valid targets of this route.
  const isOrchestratorAgent = agentType in AGENT_CONFIGS
  const isInboxAgent = agentType in AGENT_DEFINITIONS
  if (!isOrchestratorAgent && !isInboxAgent) return new NextResponse('Unknown agent', { status: 400 })

  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // Budget check before calling Claude
  const { data: tenant } = await supabaseAdmin
    .from('tenants').select('plan').eq('id', tenantId).single()
  const plan = tenant?.plan ?? 'solo'
  const budget = await checkBudget(tenantId, plan, 1500)
  if (!budget.allowed) {
    return NextResponse.json({ error: 'Daily AI budget exceeded. Upgrade your plan or try again tomorrow.' }, { status: 429 })
  }

  if (isOrchestratorAgent) {
    const agentName = agentType as AgentName
    const config = AGENT_CONFIGS[agentName]

    if (config.streaming) {
      try {
        const stream = await orchestrator.stream({
          agentName,
          userMessage: body.userMessage,
          tenantId,
          plan,
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
      } catch {
        return NextResponse.json({ error: 'Stream failed. Please try again.' }, { status: 500 })
      }
    }

    try {
      const result = await orchestrator.run({
        agentName,
        userMessage: body.userMessage,
        tenantId,
        plan,
        conversationId: body.conversationId,
        contactIdentifier: body.contactIdentifier,
        documentId: body.documentId,
        metadata: { ...body.metadata, callerIp: getClientIp(request) },
      })
      return NextResponse.json(result)
    } catch {
      return NextResponse.json({ error: 'Agent failed. Please try again.' }, { status: 500 })
    }
  }

  // Inbox panel agents (System B) — draft/summarise/lookup/escalation/advisor.
  // These have a real, DB-backed implementation in lib/ai/agents.ts that was never
  // wired to this route; the Inbox UI has always called these names (see
  // app/dashboard/inbox/page.tsx), not the orchestrator's.
  const inboxAgentType = agentType as AgentType
  const agentDef = AGENT_DEFINITIONS[inboxAgentType]
  const feature = inboxAgentType === 'advisor' ? 'advisor_agent' : `agent_${inboxAgentType}`

  try {
    const contextBlock = await buildAgentContext(inboxAgentType, tenantId, body.userMessage, body.contactIdentifier)
    const text = await callClaudeAgent(agentDef.buildPrompt(), contextBlock, 500, {
      tenantId, plan, feature,
    })

    if (inboxAgentType === 'advisor' && text) {
      void storeAdvisorInsights(tenantId, text)
    }

    await writeAuditLog({
      tenantId,
      actor: inboxAgentType,
      action: `agent.${inboxAgentType}.called`,
      resourceType: body.conversationId ? 'conversation' : undefined,
      resourceId: body.conversationId,
      metadata: { feature, callerIp: getClientIp(request) },
    })

    return NextResponse.json({ response: text })
  } catch {
    return NextResponse.json({ error: 'Agent failed. Please try again.' }, { status: 500 })
  }
}
