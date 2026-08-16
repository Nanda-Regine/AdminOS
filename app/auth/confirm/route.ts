import { NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

/**
 * Token-hash callback for email links (invite, magic link, recovery, signup).
 *
 * Distinct from /auth/callback, which handles the PKCE `?code=` exchange used by
 * OAuth and by client-initiated sign-ins. Links minted server-side via the admin
 * `generate_link` API carry no PKCE verifier, so they cannot use that route — by
 * default they land on `redirect_to` with the tokens in the URL *fragment*, which
 * a server route can never read and which middleware bounces before client JS
 * runs. Verifying the `token_hash` here instead establishes the session in
 * cookies server-side, so middleware sees an authenticated user on first paint.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/dashboard'

  if (!tokenHash || !type) {
    return NextResponse.redirect(`${origin}/login?error=invalid_link`)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })

  if (error) {
    // Expired and already-consumed links both land here; the login page copy
    // should tell the user to request a fresh one rather than retry this URL.
    return NextResponse.redirect(`${origin}/login?error=link_expired`)
  }

  // Keep the redirect same-origin — `next` comes straight off the query string.
  const dest = next.startsWith('/') ? next : '/dashboard'
  return NextResponse.redirect(`${origin}${dest}`)
}
