/**
 * Loading placeholders. Server components on this app are `force-dynamic` and
 * fetch before first paint, so the highest-value use is a Suspense fallback or a
 * `loading.tsx` — the user sees the page's shape instantly instead of a frozen
 * blank during load-shedding-grade latency. Token-styled, theme-aware.
 */

export function Skeleton({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`animate-pulse rounded-lg ${className}`}
      style={{ background: 'var(--surface-2)', ...style }}
      aria-hidden="true"
    />
  )
}

/** A stat-card row placeholder — mirrors the 4-up vital-signs grid the cockpits use. */
export function SkeletonStats({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="glass rounded-2xl p-5">
          <Skeleton className="h-9 w-9 rounded-xl mb-3" />
          <Skeleton className="h-7 w-24 mb-2" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  )
}

/** A table placeholder — a header bar plus N rows. */
export function SkeletonTable({ rows = 6 }: { rows?: number }) {
  return (
    <div className="glass rounded-2xl p-4 space-y-3" aria-hidden="true">
      <Skeleton className="h-8 w-full" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" style={{ opacity: 1 - i * 0.1 }} />
      ))}
    </div>
  )
}

/** Full-page fallback: header strip + stats + table. Drop into a `loading.tsx`. */
export function SkeletonPage() {
  return (
    <div className="p-6 space-y-6">
      <Skeleton className="h-16 w-full rounded-2xl" />
      <SkeletonStats />
      <SkeletonTable />
    </div>
  )
}
