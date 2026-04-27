import { useEffect, useRef, useState } from 'react'
import type { LogEntry } from '../store/useAppStore'

const COLOR: Record<LogEntry['level'], string> = {
  INFO: '#00D4FF',
  WARN: '#F5C842',
  DONE: '#E8EAF0',
  ERROR: '#FF6B6B',
}

interface Props {
  logs: LogEntry[]
}

interface RowState {
  log: LogEntry
  text: string
  done: boolean
}

export default function LogOutput({ logs }: Props) {
  const [rows, setRows] = useState<RowState[]>(() =>
    logs.map((l) => ({ log: l, text: l.message, done: true })),
  )
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setRows((prev) => {
      const prevById = new Map(prev.map((r) => [r.log.id, r]))
      return logs.map((l) => {
        const existing = prevById.get(l.id)
        if (existing) return existing
        if (l.animate === false) {
          return { log: l, text: l.message, done: true }
        }
        return { log: l, text: '', done: false }
      })
    })
  }, [logs])

  useEffect(() => {
    const pending = rows.find((r) => !r.done)
    if (!pending) return
    const target = pending.log.message
    const currentLen = pending.text.length
    if (currentLen >= target.length) {
      setRows((rs) =>
        rs.map((r) => (r.log.id === pending.log.id ? { ...r, done: true } : r)),
      )
      return
    }
    const t = setTimeout(() => {
      setRows((rs) =>
        rs.map((r) =>
          r.log.id === pending.log.id
            ? { ...r, text: target.slice(0, currentLen + 1) }
            : r,
        ),
      )
    }, 22)
    return () => clearTimeout(t)
  }, [rows])

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [rows])

  return (
    <div
      ref={containerRef}
      className="bg-[#08090D] rounded-xl p-3 h-56 overflow-y-auto scrollbar-thin font-mono text-[12px] leading-[1.55]"
    >
      {rows.map((r) => (
        <div key={r.log.id} className="whitespace-pre-wrap break-words">
          <span className="text-text-3">[{r.log.time}]</span>{' '}
          <span style={{ color: COLOR[r.log.level] }}>[{r.log.level}]</span>{' '}
          <span style={{ color: r.log.level === 'DONE' ? COLOR.DONE : COLOR[r.log.level] }}>
            {r.text}
          </span>
          {!r.done && (
            <span
              className="inline-block w-1.5 h-3 align-middle ml-0.5"
              style={{
                background: COLOR[r.log.level],
                animation: 'blink 0.8s steps(1) infinite',
              }}
            />
          )}
        </div>
      ))}
    </div>
  )
}
