import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'AdminOS — One AI system that runs your business. WhatsApp. Invoicing. Staff. Clients.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #111827 0%, #064e3b 100%)',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          padding: '80px',
        }}
      >
        {/* Logo mark */}
        <div
          style={{
            width: '80px',
            height: '80px',
            background: '#059669',
            borderRadius: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '32px',
          }}
        >
          <span style={{ color: 'white', fontSize: '48px', fontWeight: 700 }}>A</span>
        </div>

        {/* Headline */}
        <h1
          style={{
            color: 'white',
            fontSize: '72px',
            fontWeight: 800,
            textAlign: 'center',
            margin: '0 0 16px 0',
            lineHeight: 1.1,
            letterSpacing: '-2px',
          }}
        >
          AdminOS
        </h1>

        {/* Tagline */}
        <p
          style={{
            color: '#6ee7b7',
            fontSize: '30px',
            fontWeight: 500,
            textAlign: 'center',
            margin: '0 0 16px 0',
          }}
        >
          One AI system that runs your business.
        </p>
        <p
          style={{
            color: '#9ca3af',
            fontSize: '22px',
            fontWeight: 400,
            textAlign: 'center',
            margin: '0 0 44px 0',
          }}
        >
          WhatsApp · Debt Recovery · Staff Wellness · Daily AI Brief
        </p>

        {/* ROI pill */}
        <div
          style={{
            background: 'rgba(217, 119, 6, 0.15)',
            border: '1px solid rgba(217, 119, 6, 0.4)',
            borderRadius: '999px',
            padding: '12px 32px',
            color: '#fbbf24',
            fontSize: '22px',
            fontWeight: 600,
            marginBottom: '36px',
          }}
        >
          Replaces R11,200/mo in tools · Costs R4,500/mo
        </div>

        {/* Agent pills */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
          {[
            '📥 Alex — Inbox',
            '💰 Chase — Debt',
            '🌿 Care — Wellness',
            '📄 Doc — Documents',
            '📊 Insight — Analytics',
          ].map((feature) => (
            <div
              key={feature}
              style={{
                background: 'rgba(5, 150, 105, 0.15)',
                border: '1px solid rgba(5, 150, 105, 0.4)',
                borderRadius: '999px',
                padding: '8px 20px',
                color: '#a7f3d0',
                fontSize: '18px',
              }}
            >
              {feature}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          style={{
            position: 'absolute',
            bottom: '36px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          <p style={{ color: '#4b5563', fontSize: '18px', margin: 0 }}>
            adminos.co.za
          </p>
          <span style={{ color: '#1f2937', fontSize: '18px' }}>·</span>
          <p style={{ color: '#4b5563', fontSize: '18px', margin: 0 }}>
            🇿🇦 Built for Africa
          </p>
          <span style={{ color: '#1f2937', fontSize: '18px' }}>·</span>
          <p style={{ color: '#4b5563', fontSize: '18px', margin: 0 }}>
            POPIA Compliant
          </p>
        </div>
      </div>
    ),
    { ...size }
  )
}
