export default function Loading() {
  return (
    <div
      style={{
        background: '#050B1A',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 24,
        color: '#fff',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <style>{`
        @keyframes ao-spin {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes ao-pulse {
          0%, 100% { opacity: .4; transform: scale(1); }
          50%       { opacity: 1;  transform: scale(1.15); }
        }
      `}</style>

      {/* Logo mark */}
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          background: '#F97316',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 900,
          fontSize: 18,
          letterSpacing: '-.5px',
          animation: 'ao-pulse 2s ease-in-out infinite',
        }}
      >
        AO
      </div>

      {/* Spinner ring */}
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          border: '3px solid rgba(249,115,22,.15)',
          borderTopColor: '#F97316',
          animation: 'ao-spin .8s linear infinite',
        }}
      />

      <p style={{ fontSize: 14, color: 'rgba(255,255,255,.3)', letterSpacing: '.04em' }}>
        Loading…
      </p>
    </div>
  )
}
