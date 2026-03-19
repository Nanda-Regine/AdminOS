import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Service role client — server-side only, bypasses RLS
// NEVER expose this to the client
// Lazy initialization to avoid failures during build when env vars are not set

let _client: SupabaseClient | null = null

export const supabaseAdmin: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    if (!_client) {
      _client = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        }
      )
    }
    return (_client as unknown as Record<string | symbol, unknown>)[prop]
  },
})
