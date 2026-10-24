import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

/**
 * The verified Supabase user, once per request.
 *
 * `getUser()` is a network round trip that re-validates the JWT. The dashboard
 * layout, the page and `getContext()` each called it, so a first load paid for
 * it three times. React `cache` is scoped to a single server render, so this is
 * never shared across requests (and outside a render, e.g. in a route handler,
 * it simply isn't memoised, which is the safe direction).
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
})
