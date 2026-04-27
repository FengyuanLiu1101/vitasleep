import { RefreshCw, Undo2, Upload } from 'lucide-react'

interface Props {
  lastSyncTime: string
  pulling: boolean
  pushing: boolean
  onPull: () => void
  onPush: () => void
  /** When provided, renders an "撤销上次同步" button. */
  onUndo?: () => void
  undoing?: boolean
}

export default function SyncBar({
  lastSyncTime,
  pulling,
  pushing,
  onPull,
  onPush,
  onUndo,
  undoing = false,
}: Props) {
  return (
    <div className="flex items-center justify-between px-3 h-9 rounded-lg bg-bg-1 text-[12px]">
      <span className="text-text-2">
        上次同步 <span className="text-text-1 font-medium">{lastSyncTime || '—'}</span>
      </span>
      <div className="flex items-center gap-2">
        {onUndo && (
          <button
            type="button"
            onClick={onUndo}
            disabled={undoing}
            aria-label="撤销上次同步"
            title="撤销上次同步"
            className="flex items-center gap-1 px-1.5 h-6 rounded-md text-text-2 hover:text-yellow-1 hover:bg-bg-2 transition-colors disabled:opacity-50"
          >
            <Undo2 size={13} className={undoing ? 'animate-pulse' : ''} />
            <span className="text-[11px] font-medium">撤销同步</span>
          </button>
        )}
        <button
          type="button"
          onClick={onPull}
          disabled={pulling}
          aria-label="从飞书拉取"
          className="p-1.5 rounded-md text-text-2 hover:text-cyan-1 hover:bg-bg-2 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={pulling ? 'animate-spin' : ''} />
        </button>
        <button
          type="button"
          onClick={onPush}
          disabled={pushing}
          aria-label="推送到飞书"
          className="p-1.5 rounded-md text-text-2 hover:text-cyan-1 hover:bg-bg-2 transition-colors disabled:opacity-50"
        >
          <Upload
            size={14}
            className={pushing ? 'animate-pulse' : ''}
          />
        </button>
      </div>
    </div>
  )
}
