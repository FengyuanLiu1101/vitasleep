import { useEffect, useState } from 'react'

interface Props {
  message: string
  visible: boolean
  onHide: () => void
  duration?: number
  variant?: 'cyan' | 'green'
  position?: 'bottom-right' | 'top'
}

export default function Toast({
  message,
  visible,
  onHide,
  duration = 2000,
  variant = 'cyan',
  position = 'bottom-right',
}: Props) {
  const [render, setRender] = useState(visible)

  useEffect(() => {
    if (visible) {
      setRender(true)
      const t = setTimeout(() => onHide(), duration)
      return () => clearTimeout(t)
    } else {
      const t = setTimeout(() => setRender(false), 200)
      return () => clearTimeout(t)
    }
  }, [visible, duration, onHide])

  if (!render) return null

  const borderColor =
    variant === 'cyan' ? 'border-cyan-1' : 'border-[#6DBF6D]'
  const textColor = variant === 'cyan' ? 'text-cyan-1' : 'text-[#6DBF6D]'

  const positionCls =
    position === 'top'
      ? 'top-4 left-1/2 -translate-x-1/2'
      : 'bottom-24 right-4'

  return (
    <div
      className={`absolute ${positionCls} z-50 transition-all duration-200 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'
      }`}
    >
      <div
        className={`bg-bg-1 border ${borderColor} ${textColor} text-[13px] px-3.5 py-2.5 rounded-xl shadow-lg`}
      >
        {message}
      </div>
    </div>
  )
}
