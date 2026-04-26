import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { Redis } from '@upstash/redis'

export const runtime = 'nodejs'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pkg = require('../../../package.json') as { version: string }

export async function GET() {
  const checks: Record<string, string> = {}
  let degraded = false

  // Database check — SELECT 1 equivalent
  try {
    const { error } = await supabaseAdmin
      .from('tenants')
      .select('id')
      .limit(1)
    if (error) throw error
    checks.database = 'ok'
  } catch {
    checks.database = 'error'
    degraded = true
  }

  // Redis check — Upstash ping
  try {
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
    await redis.ping()
    checks.redis = 'ok'
  } catch {
    checks.redis = 'error'
    degraded = true
  }

  // AI check — verify key is configured (no API call)
  checks.ai = process.env.ANTHROPIC_API_KEY ? 'configured' : 'missing_key'
  if (checks.ai === 'missing_key') degraded = true

  // Inngest check — verify both keys are configured
  const inngestReady =
    !!process.env.INNGEST_EVENT_KEY && !!process.env.INNGEST_SIGNING_KEY
  checks.inngest = inngestReady ? 'configured' : 'missing_key'
  if (!inngestReady) degraded = true

  const body = {
    status: degraded ? 'degraded' : 'ok',
    timestamp: new Date().toISOString(),
    version: pkg.version,
    environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    checks,
  }

  return NextResponse.json(body, { status: degraded ? 503 : 200 })
}
