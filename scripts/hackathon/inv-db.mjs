import { env, SUPABASE_URL } from '../lib/qa.mjs'
const KEY = env.SUPABASE_SERVICE_ROLE_KEY
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` }
const gl = await (await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, { method: 'POST', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'magiclink', email: 'founder@adminos-demo.co.za' }) })).json()
const v = await fetch(SUPABASE_URL+'/auth/v1/verify', { method: 'POST', headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'magiclink', token_hash: gl.hashed_token }) })
const T = (await v.json()).user.app_metadata.tenant_id
const inv = await (await fetch(`${SUPABASE_URL}/rest/v1/invoices?tenant_id=eq.${T}&deleted_at=is.null&select=invoice_number,status,amount,amount_paid,due_date&order=due_date`, { headers: H })).json()
const today = new Date().toISOString().slice(0, 10)
let owed = 0, over = 0
for (const i of inv) {
  const out = Number(i.amount) - Number(i.amount_paid ?? 0)
  const isOwed = ['sent', 'unpaid', 'partial', 'overdue', 'in_collections'].includes(i.status)
  if (isOwed) { owed += out; if (i.due_date < today) over += out }
  console.log(i.invoice_number, i.status.padEnd(14), String(i.amount).padStart(8), String(i.amount_paid ?? 0).padStart(8), i.due_date, isOwed ? 'OWED ' + out.toFixed(2) : '')
}
console.log('owed', owed.toFixed(2), 'overdue by due_date', over.toFixed(2))
