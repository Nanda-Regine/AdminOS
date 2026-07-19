import { PostHog } from 'posthog-node'

/**
 * Server-side PostHog (posthog-node) — for capturing server events and, via
 * instrumentation.ts `onRequestError`, every server error. Singleton; flushes
 * immediately (flushAt:1) because serverless functions freeze after the
 * response, so a buffered event would be lost. No-ops if POSTHOG_TOKEN is unset,
 * so it never breaks a request.
 */
let client: PostHog | null = null

export function getPostHogServer(): PostHog | null {
  const key = process.env.POSTHOG_TOKEN
  if (!key) return null
  if (!client) {
    client = new PostHog(key, {
      host: process.env.POSTHOG_HOST || 'https://us.i.posthog.com',
      flushAt: 1,
      flushInterval: 0,
    })
  }
  return client
}

/** Capture a server-side product event. Best-effort; never throws. */
export async function captureServer(
  event: string,
  distinctId: string,
  properties?: Record<string, unknown>,
): Promise<void> {
  const ph = getPostHogServer()
  if (!ph) return
  try {
    ph.capture({ distinctId, event, properties })
    await ph.flush()
  } catch {
    /* analytics must never break the caller */
  }
}

/** Capture a server-side exception. Best-effort; never throws. */
export async function captureServerException(
  error: unknown,
  distinctId?: string,
  properties?: Record<string, unknown>,
): Promise<void> {
  const ph = getPostHogServer()
  if (!ph) return
  try {
    ph.captureException(error as Error, distinctId ?? 'server', properties)
    await ph.flush()
  } catch {
    /* swallow */
  }
}
