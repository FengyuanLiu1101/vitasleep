import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Trash2 } from 'lucide-react'
import Card from '../components/Card'
import Toggle from '../components/Toggle'
import SliderControl from '../components/SliderControl'
import Toast from '../components/Toast'
import { useAppStore } from '../store/useAppStore'

export default function SettingsPage() {
  const navigate = useNavigate()
  const energyThreshold = useAppStore((s) => s.energyThreshold)
  const notificationsEnabled = useAppStore((s) => s.notificationsEnabled)
  const demoMode = useAppStore((s) => s.demoMode)
  const setEnergyThreshold = useAppStore((s) => s.setEnergyThreshold)
  const setNotificationsEnabled = useAppStore((s) => s.setNotificationsEnabled)
  const setDemoMode = useAppStore((s) => s.setDemoMode)
  const appendLog = useAppStore((s) => s.appendLog)

  const [toast, setToast] = useState<{
    msg: string
    variant: 'cyan' | 'green'
  } | null>(null)
  const showToast = (msg: string, variant: 'cyan' | 'green' = 'cyan') =>
    setToast({ msg, variant })

  const handleClear = () => {
    try {
      const lsKeys = [
        'zhipu_api_key',
        'feishu_token',
        'feishu_pushed_keys',
        'vita_settings', // legacy
        'vita_app_state',
        'zhipu_api_key_session_pref',
      ]
      lsKeys.forEach((k) => localStorage.removeItem(k))
      try {
        sessionStorage.removeItem('zhipu_api_key_session')
      } catch {
        // ignore
      }
      appendLog({ level: 'WARN', message: '本地数据已清除（含 API Key 与同步缓存）' })
      showToast('已清除本地数据', 'green')
    } catch {
      showToast('清除失败')
    }
  }

  return (
    <div className="pb-32">
      <div className="px-4 pt-4 pb-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-text-2 hover:text-text-1 transition-colors -ml-1 p-1"
          aria-label="返回"
        >
          <ChevronLeft size={22} />
        </button>
        <h1 className="text-[20px] font-bold text-text-1">设置</h1>
      </div>

      <div className="px-4 space-y-3">
        <Card delay={0}>
          <div className="text-[14px] font-semibold text-text-1 mb-1">
            电量阈值
          </div>
          <p className="text-[12px] text-text-2 mb-4">
            身体电量低于此值时触发 Agent 分析。
          </p>
          <SliderControl
            label="阈值"
            value={energyThreshold}
            min={0}
            max={100}
            displayValue={`${energyThreshold}%`}
            onChange={setEnergyThreshold}
          />
        </Card>

        <Card delay={50}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[14px] font-semibold text-text-1">通知</div>
              <p className="text-[12px] text-text-2 mt-0.5">
                Agent 推送建议时震动并提示。
              </p>
            </div>
            <Toggle
              checked={notificationsEnabled}
              onChange={(v) => {
                setNotificationsEnabled(v)
                showToast(v ? '通知已开启' : '通知已关闭', 'green')
              }}
              ariaLabel="通知开关"
            />
          </div>
        </Card>

        <Card delay={100}>
          <div className="flex items-center justify-between">
            <div className="pr-3">
              <div className="text-[14px] font-semibold text-text-1">演示模式</div>
              <p className="text-[12px] text-text-2 mt-0.5 leading-relaxed">
                开启时使用 Mock 数据；关闭后将尝试从飞书日历读取真实事件。
              </p>
            </div>
            <Toggle
              checked={demoMode}
              onChange={(v) => {
                setDemoMode(v)
                showToast(v ? '已切换到演示模式' : '已切换到真实数据', 'green')
              }}
              ariaLabel="演示模式"
            />
          </div>
        </Card>

        <Card delay={150}>
          <div className="text-[14px] font-semibold text-text-1 mb-1">
            本地数据
          </div>
          <p className="text-[12px] text-text-2 mb-3 leading-relaxed">
            将清除浏览器中保存的智谱 API Key、飞书 token 与偏好设置。
          </p>
          <button
            type="button"
            onClick={handleClear}
            className="flex items-center gap-2 px-3 h-9 rounded-lg bg-bg-2 text-[13px] text-[#FF8888] hover:bg-bg-2/80 transition-colors"
          >
            <Trash2 size={14} />
            清除本地数据
          </button>
        </Card>
      </div>

      <Toast
        message={toast?.msg ?? ''}
        visible={!!toast}
        onHide={() => setToast(null)}
        variant={toast?.variant ?? 'cyan'}
        position="bottom-right"
      />
    </div>
  )
}
