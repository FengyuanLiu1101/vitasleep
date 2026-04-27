import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  /** Render at the bottom-sheet style instead of centered. */
  sheet?: boolean
}

export default function Modal({ open, onClose, title, children, sheet = true }: Props) {
  const [render, setRender] = useState(open)
  const [enter, setEnter] = useState(false)

  useEffect(() => {
    if (open) {
      setRender(true)
      requestAnimationFrame(() => setEnter(true))
    } else {
      setEnter(false)
      const t = setTimeout(() => setRender(false), 220)
      return () => clearTimeout(t)
    }
  }, [open])

  if (!render) return null

  return (
    <div className="absolute inset-0 z-40 flex" onClick={onClose}>
      <div
        className={`absolute inset-0 transition-opacity duration-200 ${
          enter ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ background: 'rgba(0,0,0,0.55)' }}
      />
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full ${
          sheet ? 'self-end rounded-t-3xl' : 'self-center mx-4 rounded-3xl'
        } bg-bg-1 border-t border-bg-2 transition-all duration-200`}
        style={{
          transform: enter
            ? 'translateY(0)'
            : sheet
            ? 'translateY(100%)'
            : 'translateY(20px)',
          opacity: enter ? 1 : 0,
        }}
      >
        {sheet && (
          <div className="flex justify-center pt-3">
            <span className="block w-10 h-1 rounded-full bg-bg-2" />
          </div>
        )}
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <span className="text-[16px] font-semibold text-text-1">{title}</span>
          <button
            type="button"
            onClick={onClose}
            className="text-text-2 hover:text-text-1 transition-colors p-1 -mr-1"
            aria-label="close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-5 pb-6 max-h-[70vh] overflow-y-auto scrollbar-thin">
          {children}
        </div>
      </div>
    </div>
  )
}
