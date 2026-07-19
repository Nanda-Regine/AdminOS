'use client'

import { useEffect, Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import posthog from 'posthog-js'
import { createClient } from '@/lib/supabase/client'

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

export function PostHogAnalytics({ apiKey }: { apiKey?: string }) {
  useEffect(() => {
    if (!apiKey || initialized) return
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
  }, [apiKey])

  return (
    <>
      <Suspense fallback={null}><PageView /></Suspense>
      <Identify />
    </>
  )
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
          posthog.identify(u.id, {
            tenant_id: (u.app_metadata as { tenant_id?: string } | undefined)?.tenant_id,
            email: u.email,
          })
        }
      })
      .catch(() => { /* no session / offline — stay anonymous */ })
    return () => { active = false }
  }, [])
  return null
}
