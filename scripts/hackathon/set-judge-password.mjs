// Sets a fresh password on the demo founder account (owner of the sample
// "Mzansi Test Traders" tenant only; not a super-admin) and proves a real
// password sign-in works. The password is written to a gitignored local file
// and printed once; it is never read back from the database.
//   node scripts/hackathon/set-judge-password.mjs
import fs from 'fs'
import crypto from 'crypto'
import { env, SUPABASE_URL } from '../lib/qa.mjs'

const EMAIL = 'founder@adminos-demo.co.za'
const USER_ID = 'c60fd87f-b817-4629-b6b7-8837c73ee915'
const H = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' }

// Readable on a slide: no 0/O/1/l/I, 3 blocks of 4.
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
const block = () => Array.from(crypto.randomBytes(4), b => alphabet[b % alphabet.length]).join('')
const password = `${block()}-${block()}-${block()}`

const put = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${USER_ID}`, { method: 'PUT', headers: H, body: JSON.stringify({ password }) })
if (!put.ok) { console.error('set password failed', put.status, (await put.text()).slice(0, 200)); process.exit(1) }

const login = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: 'POST', headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: EMAIL, password }),
})
if (!login.ok) { console.error('password sign-in FAILED', login.status); process.exit(1) }

fs.writeFileSync(new URL('./.judge-login.json', import.meta.url), JSON.stringify({ email: EMAIL, password }, null, 2))
console.log(`Password sign-in verified.\nemail:    ${EMAIL}\npassword: ${password}`)
