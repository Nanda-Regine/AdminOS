import { HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg'
  /** 'glass' (default) — frosted, blurred surface for top-level page cards.
   *  'flat' — plain surface, no blur; for dense nested contexts (a stat
   *  tile inside a card) where another layer of blur would look muddy. */
  variant?: 'glass' | 'flat'
}

const paddingClasses = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
}

const variantClasses = {
  glass: 'glass',
  flat: 'bg-[var(--surface-1)] border border-[var(--border)] shadow-sm',
}

export function Card({ padding = 'md', variant = 'glass', children, className = '', ...props }: CardProps) {
  return (
    <div
      className={`${variantClasses[variant]} rounded-xl ${paddingClasses[padding]} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex items-center justify-between mb-4 ${className}`}>
      {children}
    </div>
  )
}

export function CardTitle({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <h3 className={`text-base font-semibold text-[var(--text-primary)] ${className}`}>
      {children}
    </h3>
  )
}
