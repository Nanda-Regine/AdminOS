export default function PortalNotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-center">
      <div className="text-center">
        <p className="text-6xl font-bold text-white/20 mb-4">404</p>
        <h1 className="text-xl font-semibold mb-2">Portal link not found</h1>
        <p className="text-white/40 text-sm">This link may have expired or been revoked. Contact your account manager for a new link.</p>
      </div>
    </div>
  )
}
