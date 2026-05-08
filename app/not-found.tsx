import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '404 — Page Not Found | AdminOS',
  description: 'This page does not exist. Return to AdminOS.',
}

export default function NotFound() {
  return (
    <div
      style={{
        background: '#050B1A',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        textAlign: 'center',
        color: '#fff',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Orb */}
      <div
        style={{
          position: 'absolute',
          top: '20%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 400,
          height: 400,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(249,115,22,.08) 0%, transparent 65%)',
          filter: 'blur(60px)',
          pointerEvents: 'none',
        }}
      />

      {/* Logo */}
      <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 48, textDecoration: 'none' }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: '#F97316', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 14, color: '#fff' }}>AO</div>
        <span style={{ fontWeight: 800, fontSize: 20, letterSpacing: '-.5px', color: '#fff' }}>AdminOS</span>
      </Link>

      {/* 404 number */}
      <div
        style={{
          fontSize: 'clamp(96px, 18vw, 180px)',
          fontWeight: 900,
          lineHeight: 1,
          letterSpacing: '-8px',
          color: 'rgba(255,255,255,.04)',
          marginBottom: -24,
          userSelect: 'none',
        }}
      >
        404
      </div>

      <h1
        style={{
          fontSize: 'clamp(24px, 4vw, 40px)',
          fontWeight: 800,
          letterSpacing: '-1px',
          marginBottom: 16,
          position: 'relative',
        }}
      >
        Page not found
      </h1>

      <p style={{ fontSize: 16, color: 'rgba(255,255,255,.5)', marginBottom: 40, maxWidth: 380, lineHeight: 1.6 }}>
        This page doesn&apos;t exist or has been moved. Let&apos;s get you back on track.
      </p>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '13px 28px',
            borderRadius: 12,
            background: '#F97316',
            color: '#fff',
            fontWeight: 700,
            fontSize: 15,
            textDecoration: 'none',
            boxShadow: '0 4px 24px rgba(249,115,22,.3)',
          }}
        >
          ← Back to home
        </Link>
        <Link
          href="/dashboard"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '13px 28px',
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,.15)',
            background: 'rgba(255,255,255,.04)',
            color: 'rgba(255,255,255,.7)',
            fontWeight: 600,
            fontSize: 15,
            textDecoration: 'none',
          }}
        >
          Go to dashboard
        </Link>
      </div>

      <p style={{ marginTop: 48, fontSize: 13, color: 'rgba(255,255,255,.2)' }}>
        AdminOS · Built by Mirembe Muse (Pty) Ltd · South Africa
      </p>
    </div>
  )
}
