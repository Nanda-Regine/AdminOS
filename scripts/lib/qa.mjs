// Shared plumbing for the QA persona scripts (qa-personas.mjs, authz-matrix.mjs).
//
// Plain fetch only: importing @supabase/supabase-js hangs in this machine's
// sandboxed shell (see seed-demo-tenant.mjs). Keys come from .env.local, which
// is read and never written or printed (Rule Zero).
import fs from 'fs'
import crypto from 'crypto'

export const env = Object.fromEntries(
  fs.readFileSync(new URL('../../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/).filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }),
)

export const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
export const PROJECT_REF = new URL(SUPABASE_URL).hostname.split('.')[0]
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const ADMIN_HEADERS = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' }

/**
 * Persona passwords are derived from the service-role key, so they are
 * reproducible by every QA script yet never committed or written to disk.
 * Print one for a manual sign-in with: node scripts/qa-personas.mjs --password <key>
 */
export function personaPassword(email) {
  const h = crypto.createHmac('sha256', SERVICE).update(`qa-persona:${email}`).digest('base64url').slice(0, 18)
  return `Qa-${h}!9`
}

// ── PostgREST (service role) ────────────────────────────────────────────────
const REST = `${SUPABASE_URL}/rest/v1`

export async function select(table, query) {
  const r = await fetch(`${REST}/${table}?${query}`, { headers: ADMIN_HEADERS })
  if (!r.ok) throw new Error(`select ${table}: ${r.status} ${await r.text()}`)
  return r.json()
}

export async function insert(table, rows) {
  if (Array.isArray(rows) && !rows.length) return []
  const r = await fetch(`${REST}/${table}`, {
    method: 'POST', headers: { ...ADMIN_HEADERS, Prefer: 'return=representation' }, body: JSON.stringify(rows),
  })
  if (!r.ok) throw new Error(`insert ${table}: ${r.status} ${await r.text()}`)
  return r.json()
}

export async function update(table, query, patch) {
  const r = await fetch(`${REST}/${table}?${query}`, {
    method: 'PATCH', headers: { ...ADMIN_HEADERS, Prefer: 'return=representation' }, body: JSON.stringify(patch),
  })
  if (!r.ok) throw new Error(`update ${table}: ${r.status} ${await r.text()}`)
  return r.json()
}

export async function rpc(fn, args) {
  const r = await fetch(`${REST}/rpc/${fn}`, { method: 'POST', headers: ADMIN_HEADERS, body: JSON.stringify(args) })
  if (!r.ok) throw new Error(`rpc ${fn}: ${r.status} ${await r.text()}`)
  return r.status === 204 ? null : r.json()
}

/** Read-only SQL through the Management API (same as scripts/sql.mjs). */
export async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const t = await r.text()
  if (!r.ok) throw new Error(`sql: ${r.status} ${t.slice(0, 300)}`)
  return JSON.parse(t)
}

// ── GoTrue ──────────────────────────────────────────────────────────────────
/** Create a confirmed user (no email is sent), or return the existing one. */
export async function ensureUser(email, fullName, appMetadata) {
  const password = personaPassword(email)
  const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST', headers: ADMIN_HEADERS,
    body: JSON.stringify({ email, password, email_confirm: true, app_metadata: appMetadata, user_metadata: { full_name: fullName, onboarding_completed: true } }),
  })
  if (r.ok) return (await r.json()).id
  const body = await r.text()
  if (!/already|registered|exists/i.test(body)) throw new Error(`createUser ${email}: ${r.status} ${body}`)
  const [row] = await sql(`select id from auth.users where email = '${email.replace(/'/g, "''")}'`)
  if (!row) throw new Error(`createUser ${email}: exists but not found`)
  // Re-assert password + claims so a re-run repairs drift.
  const u = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${row.id}`, {
    method: 'PUT', headers: ADMIN_HEADERS,
    body: JSON.stringify({ password, app_metadata: appMetadata, user_metadata: { full_name: fullName, onboarding_completed: true } }),
  })
  if (!u.ok) throw new Error(`updateUser ${email}: ${u.status} ${await u.text()}`)
  return row.id
}

/** Password sign-in → the session object @supabase/ssr stores in its cookie. */
export async function signIn(email) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: personaPassword(email) }),
  })
  if (!r.ok) throw new Error(`signIn ${email}: ${r.status} ${await r.text()}`)
  const s = await r.json()
  return { ...s, expires_at: s.expires_at ?? Math.floor(Date.now() / 1000) + s.expires_in }
}

/**
 * Build the auth cookies @supabase/ssr 0.9 reads: `sb-<ref>-auth-token`,
 * value "base64-" + base64url(JSON session), split into `.0`, `.1`… chunks
 * when the URI-encoded value is over 3180 chars.
 */
export function sessionCookies(session) {
  const name = `sb-${PROJECT_REF}-auth-token`
  const value = 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64url')
  const MAX = 3180
  if (value.length <= MAX) return [{ name, value }]
  const chunks = []
  for (let i = 0, n = 0; i < value.length; i += MAX, n++) chunks.push({ name: `${name}.${n}`, value: value.slice(i, i + MAX) })
  return chunks
}

export function cookieHeader(session) {
  return sessionCookies(session).map(c => `${c.name}=${c.value}`).join('; ')
}
