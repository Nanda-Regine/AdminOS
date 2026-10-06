import { z } from 'zod'
import { getWeather } from '@/lib/integrations/weather'
import { withRoute } from '@/lib/api/withRoute'

export const runtime = 'nodejs'

export const GET = withRoute({
  action: 'profile.own',
  query: z.object({ city: z.string().trim().regex(/^[A-Za-z][A-Za-z .'-]{1,39}$/).default('johannesburg') }),
}, async ({ query }) => getWeather(query.city))
