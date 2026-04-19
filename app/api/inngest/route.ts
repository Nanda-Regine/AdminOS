import { serve } from 'inngest/next'
import { inngest } from '@/inngest/client'
import { debtRecoveryEngine } from '@/inngest/functions/debtRecovery'
import { docIntelligencePipeline } from '@/inngest/functions/docIntelligence'
import { wellnessFanOut } from '@/inngest/functions/wellnessFanOut'
import { dailyBriefEngine } from '@/inngest/functions/dailyBrief'
import { onboardingSequence } from '@/inngest/functions/onboardingSequence'
import { trialNudgeSequence } from '@/inngest/functions/trialNudge'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    debtRecoveryEngine,
    docIntelligencePipeline,
    wellnessFanOut,
    dailyBriefEngine,
    onboardingSequence,
    trialNudgeSequence,
  ],
})
