'use client'

import Link from 'next/link'
import { Lock, Zap } from 'lucide-react'
import type { Addon, Plan } from '@/lib/billing/gates'

const ADDON_LABELS: Record<Addon, { name: string; price: string }> = {
  ring:          { name: 'Ring',          price: 'R999/mo' },
  reach:         { name: 'Reach',         price: 'R499/mo' },
  sage:          { name: 'Sage Sync',     price: 'R299/mo' },
  languages:     { name: 'Languages',     price: 'R199/mo' },
  client_portal: { name: 'Client Portal', price: 'R599/mo' },
}

const PLAN_LABELS: Record<Plan, string> = {
  trial:       'Trial',
  starter:     'Starter — R2,500/mo',
  growth:      'Growth — R4,500/mo',
  enterprise:  'Enterprise — R8,500/mo',
  white_label: 'White Label — R14,999/mo',
}

interface BillingGateOverlayProps {
  requiredAddon?: Addon
  requiredPlan?: Plan
  children?: React.ReactNode
}

export function BillingGateOverlay({ requiredAddon, requiredPlan, children }: BillingGateOverlayProps) {
  const title = requiredAddon
    ? `${ADDON_LABELS[requiredAddon].name} add-on required`
    : `${PLAN_LABELS[requiredPlan!]} required`

  const description = requiredAddon
    ? `Unlock this feature for ${ADDON_LABELS[requiredAddon].price}.`
    : `Upgrade your plan to access this feature.`

  return (
    <div className="relative">
      {children && (
        <div className="pointer-events-none select-none blur-sm opacity-40 saturate-0">
          {children}
        </div>
      )}
      <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl"
        style={{ background: 'rgba(10,15,44,0.85)', backdropFilter: 'blur(8px)' }}>
        <div className="text-center px-6 max-w-sm">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
            style={{ background: 'var(--indigo-muted)' }}>
            <Lock className="w-5 h-5" style={{ color: 'var(--indigo-light)' }} />
          </div>
          <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{title}</h3>
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>{description}</p>
          <Link
            href="/dashboard/settings/billing"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{ background: 'var(--indigo)', color: '#fff' }}
          >
            <Zap className="w-3.5 h-3.5" />
            Upgrade Now
          </Link>
        </div>
      </div>
    </div>
  )
}
