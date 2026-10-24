// Copies AdminOS secrets from .env.local into GitHub Actions secrets (values never printed).
// CI then uploads the runtime ones to the Worker with `wrangler secret bulk`.
// Usage: node scripts/ops/push-secrets-to-gh.mjs "<path to .env.local>"
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const NAMES = ["AI_GLOBAL_DAILY_TOKEN_CAP","ANTHROPIC_API_KEY","CLOUDINARY_API_KEY","CLOUDINARY_SECRET","GEMINI_API_KEY","GEMINI_MODEL","GROQ_API_KEY","GROQ_MODEL","HUB_INTERNAL_SECRET","INNGEST_EVENT_KEY","INNGEST_SIGNING_KEY","META_APP_SECRET","META_PHONE_NUMBER_ID","META_WEBHOOK_SECRET","META_WEBHOOK_VERIFY_TOKEN","META_WHATSAPP_ACCESS_TOKEN","N8N_WEBHOOK_SECRET","NEXT_PUBLIC_APP_DOWNLOAD_URL","NEXT_PUBLIC_APP_URL","NEXT_PUBLIC_APPGALLERY_URL","NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME","NEXT_PUBLIC_PLAY_STORE_URL","NEXT_PUBLIC_POSTHOG_HOST","NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN","NEXT_PUBLIC_SUPABASE_ANON_KEY","NEXT_PUBLIC_SUPABASE_URL","PAYFAST_HUB_NOTIFY_URL","PAYFAST_MERCHANT_ID","PAYFAST_MERCHANT_KEY","PAYFAST_PASSPHRASE","PAYFAST_SANDBOX","PAYSTACK_HUB_URL","POSTHOG_ASSETS_HOST","POSTHOG_HOST","POSTHOG_TOKEN","RESEND_API_KEY","RESEND_FROM_EMAIL","SOCIAL_SYNC_ENABLED","SUPABASE_SERVICE_ROLE_KEY","TWILIO_AUTH_TOKEN","UPSTASH_REDIS_REST_TOKEN","UPSTASH_REDIS_REST_URL","USD_ZAR_RATE","CRON_SECRET"]
const env = {}
for (const line of readFileSync(process.argv[2], 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m) env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2')
}
const missing = []
for (const n of NAMES) {
  if (!env[n]) { missing.push(n); continue }
  const r = spawnSync('gh', ['secret', 'set', n, '-R', 'Nanda-Regine/AdminOS'], { input: env[n], stdio: ['pipe', 'ignore', 'inherit'] })
  console.log(`${n}: ${r.status === 0 ? 'set' : 'FAILED'}`)
}
if (missing.length) console.log(`Not in .env.local (set by hand if needed): ${missing.join(', ')}`)
