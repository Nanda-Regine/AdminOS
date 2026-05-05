'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function SequenceToggle({
  sequenceId,
  isActive,
}: {
  sequenceId: string
  isActive: boolean
}) {
  const [active, setActive]   = useState(isActive)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function toggle() {
    if (loading) return
    setLoading(true)
    const next = !active
    setActive(next)

    const res = await fetch(`/api/sequences/${sequenceId}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ is_active: next }),
    })

    if (!res.ok) {
      setActive(!next)
    } else {
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className="relative shrink-0 w-10 h-5 rounded-full transition-colors duration-200"
      style={{
        background:    active ? '#22C55E' : 'var(--border)',
        opacity:       loading ? 0.6 : 1,
        cursor:        loading ? 'not-allowed' : 'pointer',
        border:        'none',
        outline:       'none',
      }}
      aria-label={active ? 'Deactivate sequence' : 'Activate sequence'}
    >
      <span
        className="absolute top-0.5 w-4 h-4 rounded-full transition-transform duration-200"
        style={{
          background: '#fff',
          transform:  active ? 'translateX(22px)' : 'translateX(2px)',
        }}
      />
    </button>
  )
}
