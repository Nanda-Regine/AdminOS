import { z } from 'zod'

// Shared by POST /api/sequences and PATCH /api/sequences/[id].
export const SEQUENCE_TRIGGERS = ['manual', 'new_contact', 'new_client'] as const

export const stepSchema = z.object({
  id:          z.string().max(64).optional(),
  name:        z.string().trim().max(100).optional(),
  // Up to 90 days between steps.
  delay_hours: z.number().int().min(0).max(24 * 90),
  // WhatsApp limit is 4096; room for the POPIA footer.
  message:     z.string().trim().min(1, 'Every step needs a message').max(3900),
})

export const stepsSchema = z.array(stepSchema).min(1, 'Add at least one step').max(20)

export function normaliseSteps(steps: z.infer<typeof stepsSchema>) {
  return steps.map((s, i) => ({
    id:          s.id ?? crypto.randomUUID(),
    name:        s.name || `Step ${i + 1}`,
    delay_hours: s.delay_hours,
    message:     s.message,
  }))
}

export const createSequenceSchema = z.object({
  name:         z.string().trim().min(1, 'Give the sequence a name').max(200),
  trigger_type: z.enum(SEQUENCE_TRIGGERS),
  steps:        stepsSchema,
  is_active:    z.boolean().default(true),
})

export const patchSequenceSchema = z.object({
  name:         z.string().trim().min(1).max(200).optional(),
  trigger_type: z.enum(SEQUENCE_TRIGGERS).optional(),
  steps:        stepsSchema.optional(),
  is_active:    z.boolean().optional(),
}).strict()
