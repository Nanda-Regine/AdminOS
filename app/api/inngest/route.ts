import { serve } from 'inngest/next'
import { inngest } from '@/inngest/client'
import { debtRecoveryEngine }           from '@/inngest/functions/debtRecovery'
import { docIntelligencePipeline }      from '@/inngest/functions/docIntelligence'
import { wellnessFanOut }               from '@/inngest/functions/wellnessFanOut'
import { dailyBriefEngine }             from '@/inngest/functions/dailyBrief'
import { onboardingSequence }           from '@/inngest/functions/onboardingSequence'
import { trialNudgeSequence }           from '@/inngest/functions/trialNudge'
import { processQueueCron }             from '@/inngest/functions/processQueue'
import { escalateConversationsCron }    from '@/inngest/functions/escalateConversations'
import { healthScoreFunction }          from '@/inngest/functions/healthScore'
import { payrollReminderCron }          from '@/inngest/functions/payrollReminder'
import { impactSnapshotFunction }       from '@/inngest/functions/impactSnapshot'
import { streakCheckerFunction, onLessonCompleted } from '@/inngest/functions/streakChecker'
import { valuationSnapshotFunction, onValuationRequested } from '@/inngest/functions/valuationSnapshot'
import { npsReminderFunction, onNPSSurveySent }           from '@/inngest/functions/npsReminder'
import { onBoardPackRequested, boardPackMonthlyCron }      from '@/inngest/functions/boardPack'
import { payslipDistributionFunction }                     from '@/inngest/functions/payslipDistribution'
import { contextualTriggerFunction }                       from '@/inngest/functions/contextualTrigger'
import { formalizationNudgeFunction }                      from '@/inngest/functions/formalizationNudge'
import { achievementCheckerFunction }                      from '@/inngest/functions/achievementChecker'
import { cashflowForecastFunction }                        from '@/inngest/functions/cashflowForecast'
import { loyaltyExpiryFunction }                           from '@/inngest/functions/loyaltyExpiry'
import { bookingReminderFunction }                         from '@/inngest/functions/bookingReminder'
import { sopAcknowledgementFunction }                      from '@/inngest/functions/sopAcknowledgement'
import { socialSyncFunction }                              from '@/inngest/functions/socialSync'
import { benchmarkCalculateFunction }                      from '@/inngest/functions/benchmarkCalculate'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    debtRecoveryEngine,
    docIntelligencePipeline,
    wellnessFanOut,
    dailyBriefEngine,
    onboardingSequence,
    trialNudgeSequence,
    processQueueCron,
    escalateConversationsCron,
    healthScoreFunction,
    payrollReminderCron,
    impactSnapshotFunction,
    streakCheckerFunction,
    onLessonCompleted,
    valuationSnapshotFunction,
    onValuationRequested,
    npsReminderFunction,
    onNPSSurveySent,
    onBoardPackRequested,
    boardPackMonthlyCron,
    payslipDistributionFunction,
    contextualTriggerFunction,
    formalizationNudgeFunction,
    achievementCheckerFunction,
    cashflowForecastFunction,
    loyaltyExpiryFunction,
    bookingReminderFunction,
    sopAcknowledgementFunction,
    socialSyncFunction,
    benchmarkCalculateFunction,
  ],
})
