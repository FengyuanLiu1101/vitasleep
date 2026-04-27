import { useEffect, useMemo, useState } from 'react'
import { Apple, Copy, Link2, LogOut, User as UserIcon } from 'lucide-react'
import Modal from './Modal'
import Toggle from './Toggle'
import { useAppStore } from '../store/useAppStore'
import {
  buildAuthorizeUrl,
  getFeishuToken,
  setFeishuToken,
} from '../lib/feishuClient'

interface Props {
  open: boolean
  onClose: () => void
  onToast: (msg: string, variant?: 'cyan' | 'green') => void
}

const SESSION_KEY = 'zhipu_api_key_session'
const PERSIST_KEY = 'zhipu_api_key'
const SESSION_PREF_KEY = 'zhipu_api_key_session_pref'

const isLocalhostHost = (hostname: string): boolean =>
  hostname === 'localhost' ||
  hostname === '127.0.0.1' ||
  hostname === '0.0.0.0' ||
  hostname.endsWith('.local')

/** Render-only mask: keep last 4 chars, replace the rest with bullets. */
const maskKey = (key: string): string => {
  if (!key) return ''
  if (key.length <= 4) return '••••' + key
  return '••••••••' + key.slice(-4)
}

const readStoredKey = (): { key: string; session: boolean } => {
  try {
    const sess = sessionStorage.getItem(SESSION_KEY)
    if (sess) return { key: sess, session: true }
  } catch {
    // ignore
  }
  try {
    const persisted = localStorage.getItem(PERSIST_KEY)
    if (persisted) return { key: persisted, session: false }
  } catch {
    // ignore
  }
  return { key: '', session: false }
}

const readSessionPref = (): boolean => {
  try {
    const v = localStorage.getItem(SESSION_PREF_KEY)
    if (v == null) return true // default: store in sessionStorage
    return v === '1'
  } catch {
    return true
  }
}

const writeSessionPref = (v: boolean) => {
  try {
    localStorage.setItem(SESSION_PREF_KEY, v ? '1' : '0')
  } catch {
    // ignore
  }
}

export default function UserDrawer({ open, onClose, onToast }: Props) {
  const userName = useAppStore((s) => s.userName)
  const userEmail = useAppStore((s) => s.userEmail)
  const feishuConnected = useAppStore((s) => s.feishuConnected)
  const setUserName = useAppStore((s) => s.setUserName)
  const setUserEmail = useAppStore((s) => s.setUserEmail)
  const setFeishuConnected = useAppStore((s) => s.setFeishuConnected)
  const setDemoMode = useAppStore((s) => s.setDemoMode)
  const appendLog = useAppStore((s) => s.appendLog)

  const [draftName, setDraftName] = useState(userName)
  /** Empty string = no key currently entered. The mask is *display-only*; we
   *  never let the masked placeholder be saved back as the key. */
  const [draftKey, setDraftKey] = useState('')
  const [keyDirty, setKeyDirty] = useState(false)
  const [storedKey, setStoredKey] = useState('')
  const [sessionOnly, setSessionOnly] = useState(true)
  const [appleCode, setAppleCode] = useState<string | null>(null)
  const [showKey, setShowKey] = useState(false)

  useEffect(() => {
    if (open) {
      setDraftName(userName)
      const { key, session } = readStoredKey()
      setStoredKey(key)
      setSessionOnly(session ? true : readSessionPref())
      setDraftKey('')
      setKeyDirty(false)
      setShowKey(false)
      setAppleCode(null)
    }
  }, [open, userName])

  const displayedKey = useMemo(() => {
    if (keyDirty) return draftKey
    if (!storedKey) return ''
    return showKey ? storedKey : maskKey(storedKey)
  }, [keyDirty, draftKey, storedKey, showKey])

  const handleKeyChange = (v: string) => {
    setKeyDirty(true)
    setDraftKey(v)
  }

  const handleConnectFeishu = () => {
    if (isLocalhostHost(window.location.hostname)) {
      onToast(
        '本地环境无法完成飞书 OAuth 回调，已自动切换至演示模式',
        'green',
      )
      setDemoMode(true)
      appendLog({
        level: 'WARN',
        message:
          '检测到 localhost 环境，飞书 OAuth 需要公网 https 重定向；已切换至演示模式',
      })
      return
    }
    const appId = import.meta.env.VITE_FEISHU_APP_ID
    if (!appId || appId.startsWith('请填入')) {
      onToast('请先在 .env.local 中配置飞书 AppID')
      return
    }
    window.location.href = buildAuthorizeUrl()
  }

  const handleDisconnectFeishu = () => {
    setFeishuToken(null)
    setFeishuConnected(false)
    setUserEmail('')
    appendLog({ level: 'INFO', message: '已断开飞书连接' })
    onToast('已断开飞书连接', 'green')
  }

  const handleGenerateAppleCode = async () => {
    const code = String(Math.floor(100000 + Math.random() * 900000))
    setAppleCode(code)
    try {
      await navigator.clipboard.writeText(code)
      onToast('配置码已复制：' + code, 'green')
    } catch {
      onToast('配置码：' + code + '（请手动复制）')
    }
  }

  const handleSave = () => {
    setUserName(draftName.trim() || '用户')

    // Decide what to write based on whether the user actually typed a new key.
    const finalKey = keyDirty ? draftKey.trim() : storedKey

    writeSessionPref(sessionOnly)

    try {
      if (!finalKey) {
        sessionStorage.removeItem(SESSION_KEY)
        localStorage.removeItem(PERSIST_KEY)
      } else if (sessionOnly) {
        sessionStorage.setItem(SESSION_KEY, finalKey)
        localStorage.removeItem(PERSIST_KEY)
      } else {
        localStorage.setItem(PERSIST_KEY, finalKey)
        sessionStorage.removeItem(SESSION_KEY)
      }
    } catch {
      // storage may be full / disabled — fail soft
    }

    appendLog({ level: 'DONE', message: '用户配置已保存' })
    onToast('已保存', 'green')
    onClose()
  }

  // Live-sync feishuConnected from token in case of redirect callback
  useEffect(() => {
    if (open) {
      const has = !!getFeishuToken()
      if (has !== feishuConnected) setFeishuConnected(has)
    }
  }, [open, feishuConnected, setFeishuConnected])

  return (
    <Modal open={open} onClose={onClose} title="用户与连接" sheet>
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onToast('上传头像功能开发中')}
            className="w-14 h-14 rounded-full bg-bg-2 flex items-center justify-center text-text-2 hover:bg-bg-2/80 transition-colors"
            aria-label="上传头像"
          >
            <UserIcon size={22} />
          </button>
          <div className="flex-1">
            <label className="block text-[11px] text-text-2 mb-1">用户名</label>
            <input
              type="text"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              className="w-full bg-bg-2 rounded-lg px-3 h-9 text-[14px] text-text-1 outline-none focus:ring-1 focus:ring-cyan-1"
            />
          </div>
        </div>

        <div className="bg-bg-2 rounded-xl p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link2 size={14} className="text-cyan-1" />
              <span className="text-[14px] font-medium text-text-1">飞书</span>
              <span
                className="inline-block w-1.5 h-1.5 rounded-full"
                style={{
                  background: feishuConnected ? '#6DBF6D' : '#7A8090',
                }}
              />
              <span className="text-[11px] text-text-2">
                {feishuConnected ? '已连接' : '未连接'}
              </span>
            </div>
            {feishuConnected ? (
              <button
                type="button"
                onClick={handleDisconnectFeishu}
                className="flex items-center gap-1 text-[12px] text-text-2 hover:text-text-1"
              >
                <LogOut size={12} />
                断开
              </button>
            ) : (
              <button
                type="button"
                onClick={handleConnectFeishu}
                className="text-[12px] font-medium text-cyan-1 hover:opacity-80"
              >
                连接飞书
              </button>
            )}
          </div>
          <div className="text-[12px] text-text-3">
            邮箱：{userEmail || '未授权'}
          </div>
        </div>

        <div className="bg-bg-2 rounded-xl p-3.5 space-y-2.5">
          <div className="flex items-center gap-2">
            <Apple size={14} className="text-text-1" />
            <span className="text-[14px] font-medium text-text-1">
              苹果日历（iOS）
            </span>
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-text-3" />
            <span className="text-[11px] text-text-2">待连接</span>
          </div>
          <p className="text-[12px] text-text-2 leading-relaxed">
            请在 iPhone 上安装 VitaSleep App 后授权日历权限，同步数据将自动推送至此页面。
          </p>
          <div className="flex items-center justify-between">
            <span className="font-mono text-[14px] text-text-1 tracking-[0.25em]">
              {appleCode ?? '— — — — — —'}
            </span>
            <button
              type="button"
              onClick={handleGenerateAppleCode}
              className="flex items-center gap-1 text-[12px] text-cyan-1 hover:opacity-80"
            >
              <Copy size={12} />
              复制配置码
            </button>
          </div>
          <p className="text-[11px] text-text-3">需 iOS App 授权</p>
        </div>

        <div>
          <label className="block text-[12px] text-text-2 mb-1.5">
            智谱 API Key
          </label>
          <div className="flex gap-2">
            <input
              type={showKey ? 'text' : 'password'}
              value={displayedKey}
              onChange={(e) => handleKeyChange(e.target.value)}
              placeholder={
                storedKey
                  ? '已保存，留空则保持不变'
                  : '保存至浏览器本地，不会上传'
              }
              className="flex-1 bg-bg-2 rounded-lg px-3 h-9 text-[13px] text-text-1 outline-none focus:ring-1 focus:ring-cyan-1 font-mono"
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="px-3 text-[12px] text-text-2 hover:text-text-1 bg-bg-2 rounded-lg"
            >
              {showKey ? '隐藏' : '显示'}
            </button>
          </div>
          <div className="flex items-center justify-between mt-2">
            <div className="pr-3">
              <div className="text-[12px] text-text-1">仅本会话保存</div>
              <p className="text-[11px] text-text-3 mt-0.5 leading-relaxed">
                开启时保存到 sessionStorage，关闭浏览器标签后清除；
                关闭则改为 localStorage 持久保存。
              </p>
            </div>
            <Toggle
              checked={sessionOnly}
              onChange={setSessionOnly}
              ariaLabel="仅本会话保存 API Key"
            />
          </div>
          <p className="text-[11px] text-text-3 mt-1.5">
            {storedKey
              ? `当前已保存（${sessionOnly ? '本会话' : '本地'}）：${maskKey(storedKey)}`
              : '尚未保存 API Key'}
          </p>
        </div>

        <button
          type="button"
          onClick={handleSave}
          className="w-full h-11 rounded-xl bg-cyan-1 text-bg-0 font-semibold text-[14px]"
        >
          保存
        </button>
      </div>
    </Modal>
  )
}
