const REQUIRED_ENV_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ANTHROPIC_API_KEY',
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
  // Skip during `next build` static generation — vars are validated at runtime on Vercel
  if (process.env.NEXT_PHASE === 'phase-production-build') return

  if (process.env.PAYFAST_SANDBOX === 'true' && process.env.NODE_ENV === 'production') {
    throw new Error('🚨 CRITICAL: PAYFAST_SANDBOX is true in production. Set to false immediately.')
  }

  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key])
  if (missing.length > 0) {
    console.error('[AdminOS] Missing environment variables:', missing.join(', '))
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
    }
  }
}
