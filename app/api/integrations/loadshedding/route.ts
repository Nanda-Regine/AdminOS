import { getLoadSheddingStatus } from '@/lib/integrations/loadshedding'
import { withRoute } from '@/lib/api/withRoute'

export const runtime = 'nodejs'

export const GET = withRoute({ action: 'profile.own' }, async () => getLoadSheddingStatus())
