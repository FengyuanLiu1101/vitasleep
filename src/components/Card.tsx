import type { ReactNode, CSSProperties } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  style?: CSSProperties
  delay?: number
  onClick?: () => void
}

export default function Card({ children, className = '', style, delay = 0, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`bg-bg-1 rounded-2xl p-4 animate-fade-up ${onClick ? 'cursor-pointer' : ''} ${className}`}
      style={{ animationDelay: `${delay}ms`, ...style }}
    >
      {children}
    </div>
  )
}
