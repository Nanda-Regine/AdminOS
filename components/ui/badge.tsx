interface BadgeProps {
  variant?: 'green' | 'yellow' | 'red' | 'blue' | 'gray' | 'purple'
  children: React.ReactNode
  className?: string
}

const variantClasses = {
  green:  'bg-[rgba(34,197,94,0.15)] text-[#4ADE80]',
  yellow: 'bg-[rgba(245,158,11,0.15)] text-[#FBBF24]',
  red:    'bg-[rgba(239,68,68,0.15)] text-[#F87171]',
  blue:   'bg-[rgba(99,102,241,0.15)] text-[var(--indigo-light)]',
  gray:   'bg-[var(--surface-2)] text-[var(--text-muted)]',
  purple: 'bg-[rgba(168,85,247,0.15)] text-[#C084FC]',
}

export function Badge({ variant = 'gray', children, className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  )
}
