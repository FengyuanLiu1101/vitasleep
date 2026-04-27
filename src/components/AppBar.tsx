import { Settings } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'

interface AppBarProps {
  title: string
  showEnergy?: boolean
  onAvatarClick?: () => void
  onSettingsClick?: () => void
}

export default function AppBar({
  title,
  showEnergy = false,
  onAvatarClick,
  onSettingsClick,
}: AppBarProps) {
  const energyLevel = useAppStore((s) => s.energyLevel)
  const userName = useAppStore((s) => s.userName)
  const setUserDrawerOpen = useAppStore((s) => s.setUserDrawerOpen)
  const isLow = energyLevel < 30
  const barColor = isLow ? 'var(--color-yellow-1)' : 'var(--color-cyan-1)'
  const navigate = useNavigate()

  return (
    <div className="px-4 pt-4 pb-3">
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={onAvatarClick ?? (() => setUserDrawerOpen(true))}
          className="flex items-center gap-2 group hover:opacity-90 transition-opacity"
          aria-label="用户与连接"
        >
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold"
            style={{
              background: 'linear-gradient(135deg, #00D4FF 0%, #4A9EDB 100%)',
              color: '#0D0F14',
            }}
          >
            VS
          </div>
          <span className="text-text-1 text-[13px] tracking-[0.18em] font-semibold">
            VITA-SLEEP
          </span>
          <span className="text-text-3 text-[11px] hidden xs:inline">
            · {userName}
          </span>
        </button>
        <button
          type="button"
          onClick={onSettingsClick ?? (() => navigate('/settings'))}
          className="text-text-2 hover:text-text-1 transition-colors p-1 -mr-1"
          aria-label="设置"
        >
          <Settings size={18} />
        </button>
      </div>

      <div className="flex items-end justify-between">
        <h1 className="text-[28px] font-bold text-text-1 leading-none">{title}</h1>
        {showEnergy && (
          <div className="flex flex-col items-end gap-1.5 min-w-[140px]">
            <div className="text-[12px] text-text-2">
              身体电量{' '}
              <span style={{ color: barColor }} className="font-semibold">
                {energyLevel}%
              </span>
            </div>
            <div className="w-[140px] h-1.5 rounded-full bg-bg-2 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${energyLevel}%`,
                  background: barColor,
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
