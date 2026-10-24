// Custom Worker entry (wrangler.jsonc "main"). Re-uses the OpenNext fetch handler and adds
// scheduled() for the Cron Trigger that replaced the Vercel cron.
// Docs: https://opennext.js.org/cloudflare/howtos/custom-worker
import { default as handler } from './.open-next/worker.js'

const CRON_ROUTES: Record<string, string> = {
  '0 3 * * *': '/api/health',
}

export default {
  fetch: handler.fetch,

  async scheduled(controller: { cron: string }, env: any, ctx: any) {
    const path = CRON_ROUTES[controller.cron]
    if (!path) return
    const req = new Request(`https://adminos.co.za${path}`, {
      headers: { authorization: `Bearer ${env.CRON_SECRET}` },
    })
    const res = await handler.fetch(req, env, ctx)
    if (!res.ok) console.error(`cron ${path} -> ${res.status}`)
  },
}

export { DOQueueHandler, DOShardedTagCache } from './.open-next/worker.js'
