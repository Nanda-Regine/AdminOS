import { defineCloudflareConfig } from '@opennextjs/cloudflare'
import r2IncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache'
import doQueue from '@opennextjs/cloudflare/overrides/queue/do-queue'
import doShardedTagCache from '@opennextjs/cloudflare/overrides/tag-cache/do-sharded-tag-cache'

// ISR / data cache lives in R2. Time-based revalidate (3600 on blog + feeds + sitemap) goes through a
// Durable Object queue. revalidatePath (admin actions) uses the sharded Durable Object tag cache.
export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
  queue: doQueue,
  tagCache: doShardedTagCache({ baseShardSize: 4 }),
})
