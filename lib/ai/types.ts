export type AgentName = 'alex' | 'chase' | 'care' | 'doc' | 'insight' | 'pen'

export interface AgentConfig {
  name: AgentName
  displayName: string
  description: string
  model: string
  maxTokens: number
  systemPrompt: string
  streaming?: boolean
}

export interface OrchestratorRequest {
  agentName: AgentName
  userMessage: string
  tenantId: string
  conversationId?: string
  contactIdentifier?: string
  documentId?: string
  metadata?: Record<string, unknown>
}

export interface OrchestratorResponse {
  agentName: AgentName
  response: string
  model: string
  inputTokens: number
  outputTokens: number
  cached: boolean
  latencyMs: number
}

export interface EnrichedContext {
  systemPrompt: string
  contextBlock: string
}
