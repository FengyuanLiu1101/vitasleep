import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { Event, EventType } from '../data/mockData'

export interface EventDraft {
  title: string
  startTime: string
  endTime: string
  type: EventType
}

interface Props {
  /** When provided, form starts populated and shows a delete button. */
  initial?: Event
  /** Override default draft for "new event" mode. */
  defaultDraft?: EventDraft
  onSave: (draft: EventDraft) => void
  onCancel: () => void
  onDelete?: () => void
  delay?: number
}

const isValidHHmm = (s: string) => /^\d{2}:\d{2}$/.test(s)

export default function EventEditForm({
  initial,
  defaultDraft,
  onSave,
  onCancel,
  onDelete,
  delay = 0,
}: Props) {
  const [draft, setDraft] = useState<EventDraft>(() =>
    initial
      ? {
          title: initial.title,
          startTime: initial.startTime,
          endTime: initial.endTime,
          type: initial.type,
        }
      : defaultDraft ?? {
          title: '',
          startTime: '12:00',
          endTime: '13:00',
          type: 'flexible',
        },
  )
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setError(null)
  }, [draft])

  const handleSave = () => {
    const t = draft.title.trim()
    if (!t) return setError('请输入事件名称')
    if (!isValidHHmm(draft.startTime) || !isValidHHmm(draft.endTime))
      return setError('时间格式应为 HH:mm')
    if (draft.startTime >= draft.endTime) return setError('结束时间需晚于开始时间')
    onSave({ ...draft, title: t })
  }

  return (
    <div
      className="flex gap-3 animate-fade-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex flex-col items-center pt-1.5 min-w-[44px]">
        <div className="text-[13px] text-text-2 font-medium">
          {draft.startTime}
        </div>
        <div className="flex-1 w-px bg-bg-2 mt-2" />
      </div>
      <div className="flex-1 bg-bg-2 rounded-2xl p-3.5 mb-2.5 border border-cyan-1/40 space-y-3">
        <div>
          <label className="block text-[11px] text-text-2 mb-1">事件名称</label>
          <input
            type="text"
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            placeholder="请输入事件名称"
            className="w-full bg-bg-1 rounded-lg px-3 h-9 text-[14px] text-text-1 outline-none focus:ring-1 focus:ring-cyan-1"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] text-text-2 mb-1">开始时间</label>
            <input
              type="time"
              value={draft.startTime}
              onChange={(e) =>
                setDraft((d) => ({ ...d, startTime: e.target.value }))
              }
              className="w-full bg-bg-1 rounded-lg px-3 h-9 text-[13px] text-text-1 outline-none focus:ring-1 focus:ring-cyan-1 [color-scheme:dark]"
            />
          </div>
          <div>
            <label className="block text-[11px] text-text-2 mb-1">结束时间</label>
            <input
              type="time"
              value={draft.endTime}
              onChange={(e) =>
                setDraft((d) => ({ ...d, endTime: e.target.value }))
              }
              className="w-full bg-bg-1 rounded-lg px-3 h-9 text-[13px] text-text-1 outline-none focus:ring-1 focus:ring-cyan-1 [color-scheme:dark]"
            />
          </div>
        </div>
        <div>
          <label className="block text-[11px] text-text-2 mb-1">事件类型</label>
          <select
            value={draft.type}
            onChange={(e) =>
              setDraft((d) => ({ ...d, type: e.target.value as EventType }))
            }
            className="w-full bg-bg-1 rounded-lg px-3 h-9 text-[13px] text-text-1 outline-none focus:ring-1 focus:ring-cyan-1"
          >
            <option value="fixed">固定事件</option>
            <option value="flexible">弹性事件</option>
          </select>
        </div>

        {error && (
          <p className="text-[11px]" style={{ color: '#FF8888' }}>
            {error}
          </p>
        )}

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              className="text-[13px] font-semibold text-cyan-1 hover:opacity-80 transition-opacity"
            >
              保存
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="text-[13px] text-text-2 hover:text-text-1 transition-colors"
            >
              取消
            </button>
          </div>
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="text-[13px] flex items-center gap-1 hover:opacity-80 transition-opacity"
              style={{ color: '#FF4444' }}
            >
              <Trash2 size={12} />
              删除
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
