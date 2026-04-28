// These must be set or the app cannot function at all
const CRITICAL_ENV_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ANTHROPIC_API_KEY',
]

// These enable optional features — missing ones warn but don't crash
const RECOMMENDED_ENV_VARS = [
  'RESEND_API_KEY',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'CRON_SECRET',
  'PAYFAST_MERCHANT_ID',
  'PAYFAST_MERCHANT_KEY',
  'META_WHATSAPP_ACCESS_TOKEN',
  'META_PHONE_NUMBER_ID',
  'META_WEBHOOK_SECRET',
]

export function validateEnv(): void {
  if (process.env.NEXT_PHASE === 'phase-production-build') return

  if (process.env.PAYFAST_SANDBOX === 'true' && process.env.NODE_ENV === 'production') {
    throw new Error('🚨 CRITICAL: PAYFAST_SANDBOX is true in production. Set to false immediately.')
  }

  const missingCritical = CRITICAL_ENV_VARS.filter((key) => !process.env[key])
  if (missingCritical.length > 0) {
    const msg = `[AdminOS] Missing critical environment variables: ${missingCritical.join(', ')}`
    console.error(msg)
    throw new Error(msg)
  }

  const missingRecommended = RECOMMENDED_ENV_VARS.filter((key) => !process.env[key])
  if (missingRecommended.length > 0) {
    console.warn('[AdminOS] Missing recommended env vars (some features disabled):', missingRecommended.join(', '))
  }
}
