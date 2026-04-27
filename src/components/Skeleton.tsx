interface Props {
  className?: string
  height?: number
}

export default function Skeleton({ className = '', height = 16 }: Props) {
  return (
    <div
      className={`rounded-md animate-pulse ${className}`}
      style={{
        height,
        background:
          'linear-gradient(90deg, #1E2128 0%, #2a2e38 50%, #1E2128 100%)',
        backgroundSize: '200% 100%',
        animation: 'pulse 1.4s ease-in-out infinite',
      }}
    />
  )
}
