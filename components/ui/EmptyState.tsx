import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'

/**
 * The one empty state for the whole app. A new tenant hits every page with zero
 * rows — this turns that blank into an invitation: what the page is for, and the
 * single first action that fills it. Token-styled (dark/light aware), so it reads
 * the same as the cockpits. Slots straight into DataTable's `emptyState` prop, or
 * stands alone in a card.
 *
 *   <EmptyState icon={Package} title="No products yet"
 *     body="Track stock so a stockout never surprises you."
 *     action={{ label: 'Add your first product', href: '/dashboard/inventory?new=1' }} />
 */
export interface EmptyStateAction {
  label: string
  href?: string
  onClick?: () => void
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  secondaryAction,
  compact = false,
}: {
  icon?: LucideIcon
  title: string
  body?: string
  action?: EmptyStateAction
  secondaryAction?: EmptyStateAction
  /** Tighter padding for use inside a table cell. */
  compact?: boolean
}) {
  return (
    <div
      className={`flex flex-col items-center text-center ${compact ? 'py-8' : 'py-16'}`}
      role="status"
    >
      {Icon && (
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: 'var(--indigo-muted)' }}
        >
          <Icon className="w-6 h-6" style={{ color: 'var(--indigo-light)' }} />
        </div>
      )}
      <p className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>
        {title}
      </p>
      {body && (
        <p className="text-sm mt-1.5 max-w-sm" style={{ color: 'var(--text-muted)' }}>
          {body}
        </p>
      )}
      {(action || secondaryAction) && (
        <div className="flex flex-wrap items-center justify-center gap-3 mt-5">
          {action && <EmptyStateButton action={action} primary />}
          {secondaryAction && <EmptyStateButton action={secondaryAction} />}
        </div>
      )}
    </div>
  )
}

function EmptyStateButton({ action, primary }: { action: EmptyStateAction; primary?: boolean }) {
  const cls = primary
    ? 'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity'
    : 'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[var(--surface-hover)] transition-colors border'
  const style = primary
    ? { background: 'var(--indigo)', color: '#fff' }
    : { color: 'var(--text-secondary)', borderColor: 'var(--border)' }

  if (action.href) {
    return (
      <Link href={action.href} className={cls} style={style}>
        {action.label}
      </Link>
    )
  }
  return (
    <button type="button" onClick={action.onClick} className={cls} style={style}>
      {action.label}
    </button>
  )
}
