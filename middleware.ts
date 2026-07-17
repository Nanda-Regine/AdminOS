import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PATHS = [
  '/',
  '/login',
  '/signup',
  '/privacy',
  '/terms',
  '/contact',
  '/demo',
  '/robots.txt',
  '/sitemap.xml',
  '/manifest.json',
]

const PUBLIC_PREFIXES = [
  '/api/webhook/',
  '/api/webhooks/',
  '/api/onboarding/',
  '/api/auth/',
  '/api/health',
  '/api/billing/payfast-webhook',
  '/api/billing/payfast-itn',
  '/api/voice/',
  '/api/cron/',
  '/portal/',
  '/_next/',
  '/icons/',
  '/public/',
]

const BILLING_EXEMPT = [
  '/dashboard/settings/billing',
  '/dashboard/settings/referrals',
  '/dashboard/onboarding',
  '/api/billing/',
  '/api/compliance/',
  '/api/auth/',
  '/api/onboarding/',
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (
    PUBLIC_PATHS.includes(pathname) ||
    PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))
  ) {
    return addSecurityHeaders(NextResponse.next())
  }

  const response = NextResponse.next({ request })

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

  // Redirect authenticated users away from auth pages
  if (pathname === '/login' || pathname === '/signup') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Security claims come from app_metadata (service-role writable only), never
  // user_metadata — the user owns user_metadata and can rewrite it via
  // supabase.auth.updateUser(). Reading tenant_id, role, suspended, plan or
  // trial_expired_at from there lets the caller pick their own answers to every
  // check below. See migrations/20260717_phase0_tenant_isolation.sql.
  const tenantId = user.app_metadata?.tenant_id as string | undefined
  const role     = user.app_metadata?.role as string | undefined

  if (tenantId) response.headers.set('x-tenant-id', tenantId)
  if (role)     response.headers.set('x-user-role', role)
  response.headers.set('x-user-id', user.id)

  const isSuspended = user.app_metadata?.suspended === true
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

  if (pathname.startsWith('/api/admin/') && role !== 'super_admin') {
    return new NextResponse(
      JSON.stringify({ error: 'Forbidden' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const onboardingCompleted = user.user_metadata?.onboarding_completed
  if (
    onboardingCompleted === false &&
    pathname.startsWith('/dashboard') &&
    !pathname.startsWith('/dashboard/onboarding')
  ) {
    return NextResponse.redirect(new URL('/dashboard/onboarding', request.url))
  }

  const isExempt = BILLING_EXEMPT.some((p) => pathname.startsWith(p))
  if (!isExempt && (pathname.startsWith('/dashboard') || pathname.startsWith('/api/'))) {
    const trialExpiredAt = user.app_metadata?.trial_expired_at as string | undefined
    const plan           = user.app_metadata?.plan as string | undefined

    if (trialExpiredAt && plan === 'trial') {
      const expired = new Date(trialExpiredAt) < new Date()
      if (expired) {
        if (pathname.startsWith('/dashboard')) {
          return NextResponse.redirect(
            new URL('/dashboard/settings/billing?trial_expired=true', request.url)
          )
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
    '/((?!_next/static|_next/image|favicon.ico|icons|manifest.json).*)',
  ],
}
