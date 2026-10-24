import { env, SUPABASE_URL } from '../lib/qa.mjs'
const H = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' }
const id = 'c60fd87f-b817-4629-b6b7-8837c73ee915'
const u = await (await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, { headers: H })).json()
console.log('current full_name:', JSON.stringify(u.user_metadata?.full_name), 'keys:', Object.keys(u.user_metadata ?? {}).join(','))
if (process.argv[2]) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, { method: 'PUT', headers: H, body: JSON.stringify({ user_metadata: { ...u.user_metadata, full_name: process.argv[2] } }) })
  console.log('update', r.status)
}
