import { createServerClient } from '@supabase/ssr'
import { createClient as createBareClient, type SupabaseClient } from '@supabase/supabase-js'
import { cookies, headers } from 'next/headers'

/**
 * The caller's Supabase access token from `Authorization: Bearer …`, or null.
 *
 * The mobile app (expo-app) has no cookie jar shared with adminos.co.za — it
 * authenticates every API call with the access token Supabase issued it. The
 * web app never sends this header, so cookie sessions are unaffected. A bearer
 * token carries no CSRF risk: browsers never attach it on their own.
 */
export async function bearerToken(): Promise<string | null> {
  let auth: string | null = null
  try {
    auth = (await headers()).get('authorization')
  } catch {
    return null // outside a request scope (build, cron) — no caller
  }
  const m = auth?.match(/^Bearer\s+(\S+)$/i)
  return m ? m[1] : null
}

/**
 * A request-scoped client for a bearer-token caller. PostgREST runs as that
 * user (RLS applies), and `auth.getUser()` with no argument validates the
 * bearer token against Supabase Auth — the same call every route already
 * makes for cookie sessions, so all 130 callers work unchanged for mobile.
 */
function createBearerClient(token: string): SupabaseClient {
  const client = createBareClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    },
  )
  // getUser() without a jwt looks for a stored session, which a stateless
  // bearer client never has. Default the argument to the bearer token so it is
  // still verified server-side (signature + revocation), never just decoded.
  const getUser = client.auth.getUser.bind(client.auth)
  client.auth.getUser = (jwt?: string) => getUser(jwt ?? token)
  return client
}

export async function createClient() {
  const token = await bearerToken()
  if (token) return createBearerClient(token)

  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}

export async function createServiceClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}
