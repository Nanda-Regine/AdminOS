/**
 * Client-safe agent definitions — no server imports.
 * Import this in 'use client' components.
 * Import lib/ai/agents.ts (which re-exports this) in server/API code.
 */

export const AGENT_DEFINITIONS = {
  draft: {
    name: 'Draft reply',
    description: 'Draft the ideal reply to this conversation',
    buildPrompt: () =>
      'You are a professional communications assistant. Draft the ideal reply to this conversation. Be concise for WhatsApp (under 250 chars). Match the business tone. Be warm but efficient.',
  },
  summarise: {
    name: 'Summarise',
    description: 'Summarise this thread in 3 bullet points',
    buildPrompt: () =>
      'Summarise this conversation in exactly 3 bullet points: (1) what the person wants, (2) what has happened so far, (3) what action is needed now. Maximum 80 words total.',
  },
  lookup: {
    name: 'Lookup record',
    description: 'Find this contact in the business database',
    buildPrompt: () =>
      'You are a database assistant. Based on the contact information and database records provided, surface the most relevant details for the manager right now. Be direct and factual.',
  },
  escalation: {
    name: 'Escalation guide',
    description: 'Guide for handling this situation personally',
    buildPrompt: () =>
      'This conversation needs human handling. Tell the manager: (1) what happened, (2) what the person needs emotionally and practically, (3) exactly what to say, (4) what to avoid saying, (5) what the ideal outcome looks like. Be direct and practical.',
  },
  advisor: {
    name: 'Business advisor',
    description: 'AI insight connected to your business goals',
    buildPrompt: () =>
      "You are a world-class business advisor with deep knowledge of African SME operations. Review the business data and give ONE sharp, actionable insight connected to the company's specific goals. Reference a real framework when relevant. Max 150 words.",
  },
} as const

export type AgentType = keyof typeof AGENT_DEFINITIONS
