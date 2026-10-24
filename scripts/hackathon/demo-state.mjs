// Read-only: row counts for the demo tenant + proves a session can be minted
// for the demo owner via a magic-link token (no email sent, password untouched).
import { env, SUPABASE_URL, select } from '../lib/qa.mjs'
const T = 'c1336f9c-0617-46f2-978f-605da9ad2ebc'
const tenant = await select('tenants', `id=eq.${T}&select=name,slug,plan,business_type,created_at`)
console.log('tenant', JSON.stringify(tenant))
const tables = ['contacts','invoices','bookings','tasks','staff','goals','compliance_items','contracts','expenses','suppliers','products','conversations','messages','mentorship','projects','licenses']
for (const t of tables) {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${t}?tenant_id=eq.${T}&select=id`, { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, Prefer: 'count=exact', Range: '0-0' } })
    console.log(t.padEnd(18), r.ok ? r.headers.get('content-range') : `ERR ${r.status}`)
  } catch (e) { console.log(t, 'ERR', e.message) }
}
const gl = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, { method: 'POST', headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'magiclink', email: 'founder@adminos-demo.co.za' }) })
console.log('generate_link', gl.status, gl.ok ? 'ok (token withheld)' : (await gl.text()).slice(0, 200))
