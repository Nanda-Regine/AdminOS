'use client'

import { useEffect, Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import posthog from 'posthog-js'
import { createClient } from '@/lib/supabase/client'
import { CONSENT_EVENT, CONSENT_STORAGE_KEY } from '@/components/CookieConsent'

/**
 * Client-side PostHog. Renders nothing — it's three side effects:
 *   1. init posthog-js against our same-origin /ingest proxy (CSP-safe),
 *   2. capture $pageview on every App Router navigation (autocapture can't see
 *      client-side route changes on its own),
 *   3. identify the signed-in user by id + tenant so events are attributable.
 *
 * Session recording is DISABLED on purpose — recording SME financial/POPIA
 * screens is a privacy risk we don't take. The phc_ key is a public ingestion
 * key, safe to pass from the server layout as a prop.
 */
let initialized = false

function consentGiven(): boolean {
  try { return localStorage.getItem(CONSENT_STORAGE_KEY) === 'accepted' } catch { return false }
}

/**
 * POPIA: analytics is optional processing (and a cross-border transfer, s72),
 * so it starts only after the visitor clicks "Accept all" on the cookie banner,
 * and stops if they later choose "Necessary only". Until Session 20 it ran for
 * everyone regardless of the banner, and sent users' email addresses.
 *
 * Key: Vercel holds NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN, not POSTHOG_TOKEN — the
 * old prop-only lookup meant analytics never started in production.
 */
export function PostHogAnalytics({ apiKey: apiKeyProp }: { apiKey?: string }) {
  const apiKey = apiKeyProp || process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
  useEffect(() => {
    if (!apiKey) return
    const apply = () => {
      if (!consentGiven()) {
        if (initialized) posthog.opt_out_capturing()
        return
      }
      if (initialized) { posthog.opt_in_capturing(); return }
      start(apiKey)
    }
    apply()
    window.addEventListener(CONSENT_EVENT, apply)
    return () => window.removeEventListener(CONSENT_EVENT, apply)
  }, [apiKey])

  return (
    <>
      <Suspense fallback={null}><PageView /></Suspense>
      <Identify />
    </>
  )
}

function start(apiKey: string) {
    posthog.init(apiKey, {
      api_host: '/ingest',
      ui_host: 'https://us.posthog.com',
      capture_pageview: false,       // captured manually below (App Router)
      capture_pageleave: true,
      person_profiles: 'identified_only',
      disable_session_recording: true,
      autocapture: true,
      persistence: 'localStorage+cookie',
    })
    initialized = true
}

function PageView() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  useEffect(() => {
    if (!initialized || !pathname) return
    let url = window.origin + pathname
    const qs = searchParams?.toString()
    if (qs) url += `?${qs}`
    posthog.capture('$pageview', { $current_url: url })
  }, [pathname, searchParams])
  return null
}

function Identify() {
  useEffect(() => {
    if (!initialized) return
    let active = true
    createClient().auth.getUser()
      .then(({ data }) => {
        if (!active) return
        const u = data.user
        if (u) {
          // id + tenant only — no email (POPIA s10 minimality).
          posthog.identify(u.id, {
            tenant_id: (u.app_metadata as { tenant_id?: string } | undefined)?.tenant_id,
          })
        }
      })
      .catch(() => { /* no session / offline — stay anonymous */ })
    return () => { active = false }
  }, [])
  return null
}
