interface BadgeProps {
  variant?: 'green' | 'yellow' | 'red' | 'blue' | 'gray' | 'purple'
  children: React.ReactNode
  className?: string
}

const variantClasses = {
  green:  'bg-[var(--chip-green-bg)] text-[var(--chip-green-fg)]',
  yellow: 'bg-[var(--chip-amber-bg)] text-[var(--chip-amber-fg)]',
  red:    'bg-[var(--chip-red-bg)] text-[var(--chip-red-fg)]',
  blue:   'bg-[var(--chip-blue-bg)] text-[var(--chip-blue-fg)]',
  gray:   'bg-[var(--chip-gray-bg)] text-[var(--chip-gray-fg)]',
  purple: 'bg-[var(--chip-purple-bg)] text-[var(--chip-purple-fg)]',
}

export function Badge({ variant = 'gray', children, className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  )
}
