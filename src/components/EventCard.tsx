import { AlertTriangle, Check, Pencil, Zap } from 'lucide-react'
import type { DisplayItem, Issue } from '../data/mockData'

interface Props {
  item: DisplayItem
  delay?: number
  issue?: Issue
  accepted?: boolean
  ignored?: boolean
  onAccept?: () => void
  onIgnore?: () => void
  onEdit?: () => void
  /** Mark this card as the AI-inserted break block. */
  inserted?: boolean
  /** Light skeleton shimmer on the content area. */
  analyzing?: boolean
}

const TYPE_LABEL: Record<DisplayItem['type'], string> = {
  fixed: '固定事件',
  flexible: '弹性事件',
  rest: '建议新增',
}

const TAG: Record<DisplayItem['type'], { bg: string; fg: string }> = {
  fixed: { bg: '#2D4A6B', fg: '#4A9EDB' },
  flexible: { bg: '#2D3A2D', fg: '#6DBF6D' },
  rest: { bg: '#3D3A1A', fg: '#F5C842' },
}

export default function EventCard({
  item,
  delay = 0,
  issue,
  accepted,
  ignored,
  onAccept,
  onIgnore,
  onEdit,
  inserted,
  analyzing,
}: Props) {
  const { type, startTime, title } = item
  const subtitle = 'subtitle' in item ? item.subtitle : undefined
  const endTime = 'endTime' in item ? item.endTime : undefined
  const tagStyle = TAG[type]

  const showIssue = !!issue && !ignored && !accepted
  const isRest = type === 'rest'

  const cardBg = isRest
    ? 'bg-[#3D3A1A]/40 border border-[#F5C842]/30'
    : showIssue
    ? 'bg-bg-2 border border-[#FF4444]/40'
    : accepted
    ? 'bg-bg-2/60 border border-[#6DBF6D]/30'
    : 'bg-bg-2 border border-transparent hover:bg-[#23262e] transition-colors duration-150'

  const titleColor = isRest
    ? 'text-yellow-1'
    : accepted
    ? 'text-text-2'
    : 'text-text-1'

  return (
    <div
      className="flex gap-3 animate-fade-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex flex-col items-center pt-1.5 min-w-[44px]">
        <div className="text-[13px] text-text-2 font-medium">{startTime}</div>
        <div className="flex-1 w-px bg-bg-2 mt-2" />
      </div>
      <div className={`relative flex-1 rounded-2xl p-3.5 mb-2.5 ${cardBg}`}>
        {showIssue && (
          <span
            className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full"
            style={{ background: '#FF4444' }}
          />
        )}

        <div className={analyzing ? 'opacity-60 animate-pulse' : ''}>
          <div className="flex items-center justify-between mb-1.5">
            <span
              className="text-[11px] px-2 py-0.5 rounded-md inline-flex items-center gap-1"
              style={{ background: tagStyle.bg, color: tagStyle.fg }}
            >
              {(isRest || inserted) && <Zap size={11} fill={tagStyle.fg} />}
              {TYPE_LABEL[type]}
            </span>

            <div className="flex items-center gap-1.5">
              {showIssue && (
                <span
                  className="w-5 h-5 rounded-full inline-flex items-center justify-center"
                  style={{ background: 'rgba(255,68,68,0.18)' }}
                  aria-label="存在风险"
                >
                  <AlertTriangle size={12} color="#FF4444" />
                </span>
              )}
              {accepted && (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded inline-flex items-center gap-1"
                  style={{
                    background: 'rgba(109,191,109,0.18)',
                    color: '#6DBF6D',
                  }}
                >
                  <Check size={11} /> 已采纳
                </span>
              )}
              {!isRest && onEdit && (
                <button
                  type="button"
                  onClick={onEdit}
                  className="text-text-2 hover:text-cyan-1 transition-colors p-1 -mr-1 -my-1"
                  aria-label="编辑"
                >
                  <Pencil size={13} />
                </button>
              )}
            </div>
          </div>

          <div className={`text-[15px] font-semibold ${titleColor}`}>{title}</div>
          <div className="flex items-center gap-2 mt-0.5">
            {endTime && (
              <span className="text-[11px] text-text-3">
                {startTime} – {endTime}
              </span>
            )}
            {subtitle && (
              <span className="text-[12px] text-text-2">{subtitle}</span>
            )}
          </div>
        </div>

        {showIssue && issue && (
          <div
            className="mt-3 pt-3 border-t border-[#FF4444]/15 space-y-2"
            style={{ animation: 'fadeUp 300ms cubic-bezier(0.16, 1, 0.3, 1) both' }}
          >
            <p className="text-[12px] leading-relaxed" style={{ color: '#FF8888' }}>
              {issue.reason}
            </p>
            <p className="text-[12px] text-text-2 leading-relaxed">
              建议：{issue.suggestion}
            </p>
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={onAccept}
                className="text-[13px] font-semibold text-cyan-1 hover:opacity-80 transition-opacity"
              >
                接受建议
              </button>
              <button
                type="button"
                onClick={onIgnore}
                className="text-[13px] text-text-2 hover:text-text-1 transition-colors"
              >
                忽略
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
