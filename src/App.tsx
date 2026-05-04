import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import NavBar from './components/NavBar'
import SchedulePage from './pages/SchedulePage'
import HealthPage from './pages/HealthPage'
import ControlPage from './pages/ControlPage'
import SettingsPage from './pages/SettingsPage'
import UserDrawer from './components/UserDrawer'
import Toast from './components/Toast'
import { useAppStore } from './store/useAppStore'
import { getFeishuAccessToken } from './services/feishuCalendar'

type ToastVariant = 'cyan' | 'green'

function FeishuCallbackHandler({
  onToast,
}: {
  onToast: (msg: string, variant?: ToastVariant) => void
}) {
  const location = useLocation()
  const setFeishuAccessToken = useAppStore((s) => s.setFeishuAccessToken)
  const appendLog = useAppStore((s) => s.appendLog)
  const setErrorMessage = useAppStore((s) => s.setErrorMessage)

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const code = params.get('code')
    if (!code) return

    let cancelled = false
    ;(async () => {
      try {
        const token = await getFeishuAccessToken(code)
        if (cancelled) return
        setFeishuAccessToken(token)
        appendLog({ level: 'DONE', message: '飞书授权成功（token 已保存）' })
        onToast('已连接飞书', 'green')
      } catch (e) {
        if (cancelled) return
        const msg = e instanceof Error ? e.message : String(e)
        setErrorMessage(msg)
        appendLog({
          level: 'ERROR',
          message: '飞书授权失败：' + msg,
        })
        onToast('飞书授权失败（演示模式下可使用 Mock token）')
      } finally {
        if (!cancelled) window.history.replaceState({}, '', location.pathname)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [location, appendLog, onToast, setFeishuAccessToken, setErrorMessage])

  return null
}

function App() {
  const userDrawerOpen = useAppStore((s) => s.userDrawerOpen)
  const setUserDrawerOpen = useAppStore((s) => s.setUserDrawerOpen)
  const [toast, setToast] = useState<{ msg: string; variant: ToastVariant } | null>(null)
  const showToast = (msg: string, variant: ToastVariant = 'cyan') =>
    setToast({ msg, variant })

  return (
    <BrowserRouter>
      <div className="bg-[#0D0F14] min-h-screen w-full flex justify-center">
        <div
          className="relative w-full max-w-[390px] mx-auto min-h-screen overflow-hidden bg-[#0D0F14]"
          style={{
            boxShadow:
              '0 0 0 1px rgba(255,255,255,0.04), 0 24px 60px rgba(0,0,0,0.6)',
          }}
        >
          <FeishuCallbackHandler onToast={showToast} />
          <div className="h-full overflow-y-auto scrollbar-thin">
            <Routes>
              <Route path="/" element={<SchedulePage />} />
              <Route path="/schedule" element={<SchedulePage />} />
              <Route path="/health" element={<HealthPage />} />
              <Route path="/control" element={<ControlPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
          <NavBar />

          <UserDrawer
            open={userDrawerOpen}
            onClose={() => setUserDrawerOpen(false)}
            onToast={showToast}
          />

          <Toast
            message={toast?.msg ?? ''}
            visible={!!toast}
            onHide={() => setToast(null)}
            variant={toast?.variant ?? 'cyan'}
            position="bottom-right"
          />
        </div>
      </div>
    </BrowserRouter>
  )
}

export default App
