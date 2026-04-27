import { useState } from 'react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  ResponsiveContainer,
  Tooltip,
  Cell,
} from 'recharts'
import { Heart, Zap, BatteryLow, Droplet, Sun } from 'lucide-react'
import AppBar from '../components/AppBar'
import Card from '../components/Card'
import {
  energyTrend7d,
  energyTrend30d,
  sleep7d,
  sleep30d,
  metricsGrid,
} from '../data/mockData'

type Range = '7d' | '30d'

const ICONS = {
  heart: Heart,
  bolt: Zap,
  'battery-low': BatteryLow,
  droplet: Droplet,
} as const

export default function HealthPage() {
  const [range, setRange] = useState<Range>('7d')
  const energyData = range === '7d' ? energyTrend7d : energyTrend30d
  const sleepData = range === '7d' ? sleep7d : sleep30d
  const sleepAvg = (
    sleepData.reduce((a, b) => a + b.hours, 0) / sleepData.length
  ).toFixed(1)
  const avgHours = Math.floor(Number(sleepAvg))
  const avgMinutes = Math.round((Number(sleepAvg) - avgHours) * 60)

  return (
    <div className="pb-32">
      <AppBar title="健康与活力" showEnergy />

      <div className="px-4 space-y-3">
        <div
          className="flex items-center gap-6 border-b border-bg-2 pb-1 animate-fade-up"
          style={{ animationDelay: '0ms' }}
        >
          {(['7d', '30d'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`relative pb-2 text-[14px] transition-colors ${
                range === r ? 'text-cyan-1 font-semibold' : 'text-text-2'
              }`}
            >
              {r === '7d' ? '7天' : '30天'}
              {range === r && (
                <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-cyan-1 rounded-full" />
              )}
            </button>
          ))}
        </div>

        <Card delay={50}>
          <div className="flex items-start justify-between mb-2">
            <div>
              <div className="text-[15px] font-semibold text-text-1">
                身体电量趋势
              </div>
              <div className="text-[12px] text-text-2 mt-0.5">神经能量波动</div>
            </div>
            <div className="text-right">
              <div className="text-[32px] font-bold text-cyan-1 leading-none">
                92
              </div>
              <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded bg-cyan-1/15 text-cyan-1">
                最佳
              </span>
            </div>
          </div>

          <div className="h-32 -mx-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={energyData} margin={{ top: 10, right: 4, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="energyFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00D4FF" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#00D4FF" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#7A8090', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  interval={range === '30d' ? 4 : 0}
                />
                <Tooltip
                  cursor={{ stroke: '#00D4FF', strokeOpacity: 0.4 }}
                  contentStyle={{
                    background: '#1E2128',
                    border: '1px solid #2D4A6B',
                    borderRadius: 8,
                    color: '#E8EAF0',
                    fontSize: 12,
                  }}
                  labelStyle={{ color: '#7A8090' }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#00D4FF"
                  strokeWidth={2}
                  fill="url(#energyFill)"
                  dot={false}
                  activeDot={{ r: 4, fill: '#00D4FF', stroke: '#0D0F14', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card delay={100}>
          <div className="text-[15px] font-semibold text-text-1 mb-3">
            生物节律
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-[36px] font-bold text-text-1 leading-none">
              85%
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded bg-cyan-1/15 text-cyan-1">
              优秀
            </span>
          </div>
          <p className="text-[12px] italic text-text-2 leading-relaxed">
            「持续性是关键，你的昼间习惯正在发挥作用。」
          </p>
        </Card>

        <Card delay={150}>
          <div className="flex items-start justify-between mb-3">
            <div className="text-[15px] font-semibold text-text-1">睡眠时长</div>
            <div className="text-right">
              <div className="text-[14px] font-semibold text-cyan-1">
                {avgHours}h {avgMinutes}m 平均
              </div>
              <div className="text-[11px] text-text-2 mt-0.5">
                Restorative cycles
              </div>
            </div>
          </div>
          <div className="h-32 -mx-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sleepData} margin={{ top: 10, right: 4, left: 4, bottom: 0 }}>
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#7A8090', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  interval={range === '30d' ? 4 : 0}
                />
                <Tooltip
                  cursor={{ fill: '#00D4FF', fillOpacity: 0.08 }}
                  contentStyle={{
                    background: '#1E2128',
                    border: '1px solid #2D4A6B',
                    borderRadius: 8,
                    color: '#E8EAF0',
                    fontSize: 12,
                  }}
                  labelStyle={{ color: '#7A8090' }}
                  formatter={(v) => [`${v}h`, '睡眠时长']}
                />
                <Bar dataKey="hours" radius={[6, 6, 0, 0]} fill="#00D4FF">
                  {sleepData.map((d, i) => (
                    <Cell
                      key={i}
                      fill={d.hours < 6 ? '#F5C842' : '#00D4FF'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          {metricsGrid.map((m, i) => {
            const Icon = ICONS[m.icon]
            return (
              <Card key={m.key} delay={200 + i * 40}>
                <div className="flex items-center gap-2 mb-2">
                  <Icon size={14} className="text-cyan-1" />
                  <span className="text-[12px] text-text-2">{m.label}</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-[24px] font-bold text-text-1 leading-none">
                    {m.value}
                  </span>
                  <span className="text-[11px] text-text-3">{m.unit}</span>
                </div>
              </Card>
            )
          })}
        </div>

        <div
          className="rounded-2xl p-4 flex gap-3 animate-fade-up"
          style={{
            background: 'rgba(245, 200, 66, 0.12)',
            border: '1px solid rgba(245, 200, 66, 0.25)',
            animationDelay: '400ms',
          }}
        >
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-yellow-1/20 flex items-center justify-center">
            <Sun size={16} className="text-yellow-1" />
          </div>
          <div>
            <div className="text-[14px] font-semibold text-yellow-1 mb-1">
              昼夜节律校准
            </div>
            <p className="text-[12px] text-text-2 leading-relaxed">
              检测到日照量低于标准水平，建议进行一次15分钟的户外步行，以帮助重置皮质醇节律。
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
