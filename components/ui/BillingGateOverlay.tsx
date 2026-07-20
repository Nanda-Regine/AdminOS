'use client'

import Link from 'next/link'
import { Lock, Zap, Check } from 'lucide-react'
import type { Addon, Plan } from '@/lib/billing/gates'

// Prices/benefits mirror the live addon_catalogue + plan_catalogue. Kept here
// only for the pitch copy; entitlement itself is decided server-side and passed
// in via `locked` — never inferred in this client component.
const ADDON_INFO: Record<Addon, { name: string; price: string; benefits: string[]; includedFrom: string }> = {
  ring:          { name: 'Ring',          price: 'R349/mo', includedFrom: 'Partner',
    benefits: ['AI voice agent answers every call', 'Takes messages & transfers to staff', 'Full call log + recordings'] },
  reach:         { name: 'Reach',         price: 'R199/mo', includedFrom: 'Operate',
    benefits: ['Broadcast to all contacts on WhatsApp', 'Audience filters & delivery tracking', 'Campaign performance analytics'] },
  languages:     { name: 'Languages',     price: 'R99/mo',  includedFrom: 'Grow',
    benefits: ['AI replies in all 11 SA languages', 'Auto-detected per contact', 'Meet customers in their language'] },
  client_portal: { name: 'Client Portal', price: 'R299/mo', includedFrom: 'Scale',
    benefits: ['Magic-link self-service portal', 'Clients view & pay invoices online', 'Submit documents securely'] },
}

const PLAN_LABELS: Record<Plan, string> = {
  trial:       'Trial',
  starter:     'Starter',
  growth:      'Growth',
  enterprise:  'Enterprise',
  white_label: 'White Label',
}

interface BillingGateOverlayProps {
  requiredAddon?: Addon
  requiredPlan?: Plan
  /** Decided server-side. When false, the feature is owned and children render freely. */
  locked?: boolean
  children?: React.ReactNode
}

export function BillingGateOverlay({ requiredAddon, requiredPlan, locked = true, children }: BillingGateOverlayProps) {
  // Entitled: render the real feature with no obstruction.
  if (!locked) return <>{children}</>

  const info = requiredAddon ? ADDON_INFO[requiredAddon] : null
  const title = info ? info.name : `${PLAN_LABELS[requiredPlan!]} plan`
  const price = info ? info.price : ''
  const benefits = info?.benefits ?? []

  return (
    <div className="relative">
      {children && (
        <div className="pointer-events-none select-none blur-sm opacity-30 saturate-50" aria-hidden="true">
          {children}
        </div>
      )}
      <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl p-6"
        style={{ background: 'rgba(10,15,44,0.82)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}>
        <div className="text-center max-w-sm w-full rounded-2xl p-6 tex-premium on-dark"
          style={{ border: '1px solid var(--border-hover)' }}>
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center mx-auto mb-3"
            style={{ background: 'var(--indigo-muted)' }}>
            <Lock className="w-5 h-5" style={{ color: 'var(--indigo-light)' }} />
          </div>
          <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Unlock {title}</h3>
          <p className="text-sm mt-1 mb-4" style={{ color: 'var(--text-muted)' }}>
            {info ? `From ${price}` : 'Upgrade your plan'} · included free on {info?.includedFrom ?? 'higher'} plans
          </p>

          {benefits.length > 0 && (
            <ul className="text-left space-y-2 mb-5 mx-auto inline-block">
              {benefits.map((b) => (
                <li key={b} className="flex items-start gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <Check className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--success)' }} />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}

          <Link
            href="/dashboard/settings/billing"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all w-full hover:opacity-90"
            style={{ background: 'var(--indigo)', color: '#fff' }}
          >
            <Zap className="w-4 h-4" />
            {info ? `Add ${info.name}` : 'Upgrade'}
          </Link>
        </div>
      </div>
    </div>
  )
}
