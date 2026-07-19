export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateEnv } = await import('./lib/config/validate')
    validateEnv()
  }
}

/**
 * Next.js central server-error hook — fires for every uncaught error in a
 * Server Component, route handler, or server action. Ships it to PostHog so
 * production failures are visible instead of silent. Best-effort; guarded.
 */
export async function onRequestError(
  err: unknown,
  request: { path?: string; method?: string; headers?: Record<string, string> },
  context: { routerKind?: string; routePath?: string; routeType?: string; renderSource?: string },
): Promise<void> {
  try {
    const { getPostHogServer } = await import('./lib/posthog/server')
    const ph = getPostHogServer()
    if (!ph) return
    ph.captureException(err as Error, undefined, {
      path: request?.path,
      method: request?.method,
      route: context?.routePath,
      route_type: context?.routeType,
      render_source: context?.renderSource,
    })
    await ph.flush()
  } catch {
    /* never let error reporting throw inside the error hook */
  }
}
