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
import { fanOutBriefCron }                                 from '@/inngest/functions/fanOutBrief'
import { fanOutWellnessCron }                              from '@/inngest/functions/fanOutWellness'
import { fanOutHealthScoreCron }                           from '@/inngest/functions/fanOutHealthScore'
import { fanOutDebtRecoveryCron }                          from '@/inngest/functions/fanOutDebtRecovery'
import { sequencesCronFunction }                           from '@/inngest/functions/sequencesCron'
import { licenseRemindersCronFunction }                    from '@/inngest/functions/licenseRemindersCron'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    // Event-driven functions
    debtRecoveryEngine,
    docIntelligencePipeline,
    wellnessFanOut,
    dailyBriefEngine,
    onboardingSequence,
    trialNudgeSequence,
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
    // Scheduled crons (all managed by Inngest — no Vercel crons needed)
    processQueueCron,
    escalateConversationsCron,
    benchmarkCalculateFunction,
    fanOutBriefCron,
    fanOutWellnessCron,
    fanOutHealthScoreCron,
    fanOutDebtRecoveryCron,
    sequencesCronFunction,
    licenseRemindersCronFunction,
  ],
})
