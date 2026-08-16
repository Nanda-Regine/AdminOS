'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'

export default function MobileNav() {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  // Close on Escape — the panel covers the whole screen, so a keyboard user
  // needs a way out that isn't hunting for the X.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const panel = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        // Fully opaque. The previous 0.97 alpha let the page ghost through,
        // and the panel's own backdrop-filter was doing nothing useful over it.
        background: '#050B1A',
        display: 'flex', flexDirection: 'column',
        padding: '20px 24px 36px',
        overflowY: 'auto',
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10, background: '#F97316',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 900, fontSize: 13, letterSpacing: '-.5px', color: '#fff',
            flexShrink: 0,
          }}>AO</div>
          <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-.5px', color: '#fff' }}>AdminOS</span>
        </div>
        <button
          onClick={() => setOpen(false)}
          aria-label="Close menu"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.55)', padding: 6 }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Nav links */}
      <nav style={{ flex: 1 }}>
        {[
          ['#agents', 'Agents'],
          ['#addons', 'Add-ons'],
          ['#pricing', 'Pricing'],
          ['#faq', 'FAQ'],
          ['/contact', 'Contact'],
        ].map(([href, label]) => (
          <a
            key={label}
            href={href}
            onClick={() => setOpen(false)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              fontSize: 22, fontWeight: 700, color: 'rgba(255,255,255,.8)',
              textDecoration: 'none', padding: '16px 0',
              borderBottom: '1px solid rgba(255,255,255,.06)',
            }}
          >
            {label}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.3 }}>
              <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </a>
        ))}
      </nav>

      {/* CTA buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 32 }}>
        <Link
          href="/demo"
          onClick={() => setOpen(false)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '15px', borderRadius: 12, fontWeight: 700, fontSize: 16,
            color: 'white', textDecoration: 'none',
            background: 'linear-gradient(135deg, #06B6D4, #0891b2)',
            boxShadow: '0 4px 24px rgba(6,182,212,.3)',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><polygon points="5,3 19,12 5,21" fill="white"/></svg>
          Try interactive demo
        </Link>
        <Link
          href="/signup"
          onClick={() => setOpen(false)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '15px', borderRadius: 12, fontWeight: 800, fontSize: 16,
            color: 'white', textDecoration: 'none', background: '#F97316',
            boxShadow: '0 4px 24px rgba(249,115,22,.35)',
          }}
        >Start free trial →</Link>
        <Link
          href="/login"
          onClick={() => setOpen(false)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '12px', borderRadius: 12, fontWeight: 600, fontSize: 14,
            color: 'rgba(255,255,255,.45)', textDecoration: 'none',
            border: '1px solid rgba(255,255,255,.1)',
          }}
        >Sign in</Link>
      </div>
    </div>
  )

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        className="md:hidden"
        style={{
          background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 8, cursor: 'pointer',
          color: 'rgba(255,255,255,.85)', padding: '7px 8px', marginLeft: 4,
          display: 'flex', alignItems: 'center',
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M3 7h18M3 12h18M3 17h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </button>

      {/*
        Portalled to <body> rather than rendered in place. The parent is
        <header class="glass-nav">, which sets backdrop-filter — and any value
        other than `none` makes that element the containing block for
        fixed-position descendants. Left inline, `position: fixed; inset: 0`
        resolved against the ~60px nav bar instead of the viewport, so the menu
        was clipped to a strip with the page showing through underneath.
      */}
      {mounted && open && createPortal(panel, document.body)}
    </>
  )
}
