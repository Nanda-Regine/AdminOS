import { z } from 'zod'
import { validatePhone } from '@/lib/integrations/phone'
import { withRoute } from '@/lib/api/withRoute'

export const runtime = 'nodejs'

// The Phone Checker on the Integrations page.
export const POST = withRoute({
  action: 'profile.own',
  body: z.object({ phone: z.string().trim().min(1, 'Enter a phone number').max(30) }),
}, async ({ body }) => validatePhone(body.phone))
