import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'AdminOS — The OS That Runs Your Business'
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
            fontSize: '32px',
            fontWeight: 500,
            textAlign: 'center',
            margin: '0 0 48px 0',
          }}
        >
          The OS that runs your business while you sleep
        </p>

        {/* Feature pills */}
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
          {[
            '💬 WhatsApp AI',
            '💰 Debt Recovery',
            '👥 Staff Wellness',
            '📊 Daily AI Brief',
          ].map((feature) => (
            <div
              key={feature}
              style={{
                background: 'rgba(5, 150, 105, 0.2)',
                border: '1px solid rgba(5, 150, 105, 0.5)',
                borderRadius: '999px',
                padding: '10px 24px',
                color: '#a7f3d0',
                fontSize: '22px',
              }}
            >
              {feature}
            </div>
          ))}
        </div>

        {/* Footer */}
        <p
          style={{
            position: 'absolute',
            bottom: '40px',
            color: '#4b5563',
            fontSize: '20px',
          }}
        >
          adminos.co.za · Built for Africa
        </p>
      </div>
    ),
    { ...size }
  )
}
