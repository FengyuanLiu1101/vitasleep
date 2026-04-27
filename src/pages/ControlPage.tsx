import { useState } from 'react'
import { SlidersHorizontal, Zap, Terminal } from 'lucide-react'
import AppBar from '../components/AppBar'
import Card from '../components/Card'
import SliderControl from '../components/SliderControl'
import LogOutput from '../components/LogOutput'
import Toast from '../components/Toast'
import { useAppStore, type StressLevel } from '../store/useAppStore'
import { scenarios, scenarioLogs, scenarioSchedules } from '../data/mockData'

const STRESS_LABELS: StressLevel[] = ['low', 'mid', 'high']
const STRESS_DISPLAY: Record<StressLevel, string> = {
  low: '低',
  mid: '中',
  high: '高',
}

export default function ControlPage() {
  const energyLevel = useAppStore((s) => s.energyLevel)
  const heartRate = useAppStore((s) => s.heartRate)
  const stressLevel = useAppStore((s) => s.stressLevel)
  const activeScenario = useAppStore((s) => s.activeScenario)
  const logs = useAppStore((s) => s.logs)

  const setEnergyLevel = useAppStore((s) => s.setEnergyLevel)
  const setHeartRate = useAppStore((s) => s.setHeartRate)
  const setStressLevel = useAppStore((s) => s.setStressLevel)
  const setActiveScenario = useAppStore((s) => s.setActiveScenario)
  const resetScheduleForScenario = useAppStore(
    (s) => s.resetScheduleForScenario,
  )
  const appendLogs = useAppStore((s) => s.appendLogs)

  const [toastVisible, setToastVisible] = useState(false)

  const stressIndex = STRESS_LABELS.indexOf(stressLevel)

  const handleScenario = (id: 1 | 2 | 3) => {
    setActiveScenario(id)

    if (id === 1) {
      setEnergyLevel(75)
      setHeartRate(72)
      setStressLevel('low')
    } else if (id === 2) {
      setEnergyLevel(15)
      setHeartRate(88)
      setStressLevel('high')
    } else if (id === 3) {
      setStressLevel('mid')
      setHeartRate(76)
    }

    // Hard-reset the schedule subtree so a previous scenario's analysis
    // results, accept/ignore decisions, banner state, etc. never leak into
    // the new scenario. SchedulePage's effect then re-runs analysis.
    resetScheduleForScenario(scenarioSchedules[id].map((e) => ({ ...e })))

    appendLogs(scenarioLogs[id].map((l) => ({ ...l, animate: true })))
    setToastVisible(true)
  }

  return (
    <div className="pb-32">
      <AppBar title="控制与模拟" />

      <div className="px-4 space-y-3">
        <div
          className="flex items-center gap-2 text-[12px] text-text-2 animate-fade-up"
          style={{ animationDelay: '0ms' }}
        >
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ background: '#6DBF6D', boxShadow: '0 0 8px #6DBF6D' }}
          />
          状态：已启用（模拟模式）
        </div>

        <Card delay={50}>
          <div className="flex items-center gap-2 mb-4">
            <SlidersHorizontal size={15} className="text-cyan-1" />
            <span className="text-[15px] font-semibold text-text-1">参数调节区</span>
          </div>
          <div className="space-y-5">
            <SliderControl
              label="身体电量"
              value={energyLevel}
              min={0}
              max={100}
              displayValue={`${energyLevel}%`}
              onChange={(v) => setEnergyLevel(v)}
            />
            <SliderControl
              label="心率（BPM）"
              value={heartRate}
              min={40}
              max={120}
              axisLeft="心动过缓"
              axisRight="心动过速"
              onChange={(v) => setHeartRate(v)}
            />
            <SliderControl
              label="压力水平（皮质醇）"
              value={stressIndex}
              min={0}
              max={2}
              displayValue={STRESS_DISPLAY[stressLevel]}
              axisLeft="稳态"
              axisRight="压力"
              onChange={(v) => setStressLevel(STRESS_LABELS[v])}
            />
          </div>
        </Card>

        <Card delay={100}>
          <div className="flex items-center gap-2 mb-3">
            <Zap size={15} className="text-yellow-1" fill="#F5C842" />
            <span className="text-[15px] font-semibold text-text-1">一键触发区</span>
          </div>
          <div className="space-y-2.5">
            {scenarios.map((s) => {
              const active = activeScenario === s.id
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleScenario(s.id)}
                  className="w-full text-left rounded-xl p-3 transition-all"
                  style={{
                    background: '#1E2128',
                    border: active
                      ? '1px solid #00D4FF'
                      : '1px solid transparent',
                    boxShadow: active ? '0 0 0 3px rgba(0,212,255,0.12)' : 'none',
                  }}
                >
                  <div className="text-[14px] font-semibold text-text-1 mb-0.5">
                    {s.title}
                  </div>
                  <div className="text-[12px] text-text-2">{s.subtitle}</div>
                </button>
              )
            })}
          </div>
        </Card>

        <Card delay={150}>
          <div className="flex items-center gap-2 mb-3">
            <Terminal size={15} className="text-cyan-1" />
            <span className="text-[15px] font-semibold text-text-1">决策日志</span>
          </div>
          <LogOutput logs={logs} />
        </Card>
      </div>

      <Toast
        message="✓ 场景已触发，Agent 决策中..."
        visible={toastVisible}
        onHide={() => setToastVisible(false)}
        variant="cyan"
        position="bottom-right"
      />
    </div>
  )
}
