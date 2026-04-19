import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Routes that don't require authentication
const PUBLIC_PATHS = [
  '/',
  '/login',
  '/signup',
  '/privacy',
  '/terms',
  '/contact',
  '/robots.txt',
  '/sitemap.xml',
  '/manifest.json',
]

const PUBLIC_PREFIXES = [
  '/api/webhook/',    // Meta WhatsApp + email inbound (verified by HMAC)
  '/api/onboarding/', // tenant creation during signup
  '/api/auth/',       // sign in/out
  '/_next/',
  '/icons/',
  '/public/',
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow static assets and public routes without auth check
  if (
    PUBLIC_PATHS.includes(pathname) ||
    PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))
  ) {
    return addSecurityHeaders(NextResponse.next())
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Redirect unauthenticated users
  if (!user) {
    if (pathname.startsWith('/dashboard')) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }
    if (pathname.startsWith('/api/')) {
      return new NextResponse(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }
    return addSecurityHeaders(response)
  }

  // Inject tenant context into headers for downstream API routes
  const tenantId = user.user_metadata?.tenant_id as string | undefined
  const role = user.user_metadata?.role as string | undefined

  if (tenantId) {
    response.headers.set('x-tenant-id', tenantId)
  }
  if (role) {
    response.headers.set('x-user-role', role)
  }
  response.headers.set('x-user-id', user.id)

  // Block suspended tenants from dashboard and API
  const isSuspended = user.user_metadata?.suspended === true
  if (isSuspended) {
    if (pathname.startsWith('/dashboard')) {
      return NextResponse.redirect(new URL('/login?error=suspended', request.url))
    }
    if (pathname.startsWith('/api/')) {
      return new NextResponse(
        JSON.stringify({ error: 'Account suspended' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }

  // Restrict super-admin routes to admin role only
  if (pathname.startsWith('/api/admin/') && role !== 'super_admin') {
    return new NextResponse(
      JSON.stringify({ error: 'Forbidden' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Trial enforcement — allow billing + compliance routes even if trial expired
  const BILLING_EXEMPT = [
    '/dashboard/settings/billing',
    '/dashboard/settings/referrals',
    '/api/billing/',
    '/api/compliance/',
    '/api/auth/',
  ]
  const isExempt = BILLING_EXEMPT.some((p) => pathname.startsWith(p))

  if (!isExempt && (pathname.startsWith('/dashboard') || pathname.startsWith('/api/'))) {
    const trialExpiredAt = user.user_metadata?.trial_expired_at as string | undefined
    const plan           = user.user_metadata?.plan as string | undefined

    // If trial_expired_at is set and in the past, and no paid plan, block
    if (trialExpiredAt && plan === 'trial') {
      const expired = new Date(trialExpiredAt) < new Date()
      if (expired) {
        if (pathname.startsWith('/dashboard')) {
          return NextResponse.redirect(new URL('/dashboard/settings/billing?trial_expired=true', request.url))
        }
        return new NextResponse(
          JSON.stringify({ error: 'Trial expired. Please subscribe to continue.' }),
          { status: 402, headers: { 'Content-Type': 'application/json' } }
        )
      }
    }
  }

  return addSecurityHeaders(response)
}

function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
