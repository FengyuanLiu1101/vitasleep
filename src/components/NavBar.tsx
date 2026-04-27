import { NavLink } from 'react-router-dom'
import { CalendarDays, Activity, SlidersHorizontal } from 'lucide-react'

const items = [
  { to: '/', label: '日程', icon: CalendarDays, end: true },
  { to: '/health', label: '健康', icon: Activity, end: false },
  { to: '/control', label: '控制', icon: SlidersHorizontal, end: false },
]

export default function NavBar() {
  return (
    <nav
      className="absolute bottom-0 left-0 right-0 bg-bg-1/95 backdrop-blur border-t border-bg-2"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 8px)' }}
    >
      <div className="flex items-stretch justify-around h-16">
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-1 transition-colors ${
                isActive ? 'text-cyan-1' : 'text-text-2 hover:text-text-1'
              }`
            }
          >
            <Icon size={20} />
            <span className="text-[11px]">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
