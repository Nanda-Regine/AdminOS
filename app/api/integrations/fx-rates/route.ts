import { z } from 'zod'
import { getFxRates } from '@/lib/integrations/fx-rates'
import { withRoute } from '@/lib/api/withRoute'

export const runtime = 'nodejs'

// Signed-in members only: the free upstream allows 1,500 calls a month, and
// `base` went straight into its URL path unchecked.
export const GET = withRoute({
  action: 'profile.own',
  query: z.object({ base: z.string().regex(/^[A-Za-z]{3}$/).default('ZAR') }),
}, async ({ query }) => getFxRates(query.base.toUpperCase()))
