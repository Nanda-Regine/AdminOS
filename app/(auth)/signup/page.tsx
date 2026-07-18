'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function SignupPage() {
  const supabase = createClient()
  const router = useRouter()
  const [form, setForm] = useState({ name: '', email: '', password: '', businessName: '' })
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')
  const [confirmationSent, setConfirmationSent] = useState(false)

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  const handleGoogleSignup = async () => {
    setGoogleLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/dashboard/onboarding`,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    })
    if (error) {
      setError(error.message)
      setGoogleLoading(false)
    }
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        // business_name is carried so /auth/callback can name the tenant
        // correctly on the email-confirmation path, where this page never gets
        // a session and cannot call create-tenant itself. Not a security claim
        // — a user renaming their own business harms nobody.
        data: { full_name: form.name, business_name: form.businessName || '' },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard/onboarding`,
      },
    })

    if (authError) {
      if (authError.message.toLowerCase().includes('already registered')) {
        setError('An account with this email already exists. Sign in instead.')
      } else {
        setError(authError.message)
      }
      setLoading(false)
      return
    }

    if (!data.user) {
      setError('Something went wrong. Please try again.')
      setLoading(false)
      return
    }

    // Provision the tenant only when signUp returned a session (email
    // confirmation disabled). With confirmation enabled there is no session yet,
    // so create-tenant would 401 — /auth/callback provisions the tenant after
    // the user confirms instead, using the business_name carried above.
    //
    // The route derives the user from the session and rejects a second tenant
    // with 409, so userId/email are no longer sent — they were the mechanism
    // that let an unauthenticated caller provision tenants against any account.
    const alreadyHasTenant = !!data.user.app_metadata?.tenant_id
    if (data.session && !alreadyHasTenant) {
      const res = await fetch('/api/onboarding/create-tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: form.businessName || 'My Business',
        }),
      })
      if (!res.ok && res.status !== 409) {
        setError('Account created but business setup failed. Please contact support.')
        setLoading(false)
        return
      }
    }

    // If session exists, email confirmation is disabled — go straight to dashboard
    if (data.session) {
      router.push('/dashboard/onboarding')
      return
    }

    // No session = email confirmation required
    setConfirmationSent(true)
    setLoading(false)
  }

  if (confirmationSent) {
    return (
      <div className="min-h-screen auth-shell-paper flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Check your email</h1>
          <p className="text-gray-500 mb-2">
            We sent a confirmation link to <strong className="text-gray-900">{form.email}</strong>
          </p>
          <p className="text-gray-400 text-sm mb-8">
            Click the link in the email to activate your account, then come back to sign in.
          </p>
          <Link
            href="/login"
            className="inline-block bg-[#0A0F2C] text-white font-semibold px-6 py-3 rounded-xl hover:bg-[#0f1840] transition-colors"
          >
            Go to sign in
          </Link>
          <p className="text-xs text-gray-400 mt-4">
            Didn&apos;t get the email? Check your spam folder or{' '}
            <button
              className="text-emerald-600 underline"
              onClick={async () => {
                await supabase.auth.resend({ type: 'signup', email: form.email })
                alert('Confirmation email resent!')
              }}
            >
              resend it
            </button>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen auth-shell-paper flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-[#0A0F2C] rounded-xl flex items-center justify-center mx-auto mb-3">
            <span className="font-bold text-[#C9A84C] text-lg">AO</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Start your free trial</h1>
          <p className="text-sm text-gray-500 mt-1">Set up AdminOS for your business in 15 minutes</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
          {/* Google OAuth */}
          <button
            type="button"
            onClick={handleGoogleSignup}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 border border-gray-300 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-60 mb-5"
          >
            {googleLoading ? (
              <span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            Sign up with Google
          </button>

          <div className="relative mb-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs text-gray-400 bg-white px-3">
              or sign up with email
            </div>
          </div>

          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Your name</label>
              <input
                required
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Jane Smith"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Business name</label>
              <input
                required
                value={form.businessName}
                onChange={(e) => update('businessName', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Sunshine Hardware"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="you@business.co.za"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                required
                minLength={8}
                value={form.password}
                onChange={(e) => update('password', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Min. 8 characters"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                {error}{' '}
                {error.includes('already exists') && (
                  <Link href="/login" className="font-semibold underline">Sign in →</Link>
                )}
              </div>
            )}

            <Button type="submit" loading={loading} className="w-full">
              Create account
            </Button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-4">
            Free 14-day trial · No credit card required
          </p>

          <p className="text-center text-sm text-gray-500 mt-4">
            Already have an account?{' '}
            <Link href="/login" className="text-emerald-600 font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
