import { type ReactNode } from 'react'

interface GlassCardProps {
  children: ReactNode
  className?: string
  style?: React.CSSProperties
  onClick?: () => void
  as?: 'div' | 'section' | 'article'
}

export function GlassCard({
  children, className = '', style, onClick, as: Tag = 'div',
}: GlassCardProps) {
  return (
    <Tag
      className={`glass rounded-2xl p-5 ${onClick ? 'cursor-pointer hover:border-white/10 transition-all' : ''} ${className}`}
      style={style}
      onClick={onClick}
    >
      {children}
    </Tag>
  )
}
