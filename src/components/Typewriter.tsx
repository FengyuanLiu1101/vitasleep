import { useEffect, useState } from 'react'

interface Props {
  text: string
  speedMs?: number
  className?: string
  onDone?: () => void
}

export default function Typewriter({
  text,
  speedMs = 50,
  className = '',
  onDone,
}: Props) {
  const [shown, setShown] = useState('')

  useEffect(() => {
    setShown('')
    if (!text) return
    let i = 0
    const id = setInterval(() => {
      i++
      setShown(text.slice(0, i))
      if (i >= text.length) {
        clearInterval(id)
        onDone?.()
      }
    }, speedMs)
    return () => clearInterval(id)
  }, [text, speedMs, onDone])

  const isDone = shown.length >= text.length

  return (
    <span className={className}>
      {shown}
      {!isDone && (
        <span
          className="inline-block w-1.5 h-4 align-middle ml-0.5 bg-cyan-1"
          style={{ animation: 'blink 0.8s steps(1) infinite' }}
        />
      )}
    </span>
  )
}
