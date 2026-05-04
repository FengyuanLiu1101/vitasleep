import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Event, Issue } from '../data/mockData'
import { initialSchedule } from '../data/mockData'
import type { ScenarioId } from '../data/mockAnalysis'
import type { ScheduleSuggestion } from '../services/scheduleAdvisor'
import { assertEnergySynced, type EnergyPoint } from '../utils/energySync'
import { hhmmToIso } from '../utils/scheduleTime'
import { setFeishuToken } from '../lib/feishuClient'

export type StressLevel = 'low' | 'mid' | 'high'
export type LogLevel = 'INFO' | 'WARN' | 'DONE' | 'ERROR'
export type { ScenarioId }

export interface LogEntry {
  id: string
  time: string
  level: LogLevel
  message: string
  animate?: boolean
}

/** Snapshot recorded just before a Feishu push, used to power "undo last sync". */
export interface SyncSnapshot {
  eventsBefore: Event[]
  originalBefore: Event[]
  createdFeishuIds: string[]
  createdLocalIds: string[]
  syncedAt: string
  demo: boolean
}

function seedEnergyHistory(level: number): EnergyPoint[] {
  const rounded = Math.max(0, Math.min(100, Math.round(level)))
  const now = Date.now()
  const hourMs = 3600000
  const pts: EnergyPoint[] = []
  for (let i = 0; i < 7; i++) {
    pts.push({
      time: new Date(now - (7 - i) * hourMs).toISOString(),
      value: Math.max(0, Math.min(100, rounded + (i - 3) * 6)),
    })
  }
  return assertEnergySynced(pts, rounded)
}

/** Migrate persisted calendar rows from legacy HH:mm + flexible/fixed. */
export function migrateLegacyEvent(raw: Record<string, unknown>): Event {
  const id = String(raw.id ?? '')
  const title = String(raw.title ?? '')
  let startTime = String(raw.startTime ?? '')
  let endTime = String(raw.endTime ?? '')
  if (/^\d{2}:\d{2}$/.test(startTime)) startTime = hhmmToIso(startTime)
  if (/^\d{2}:\d{2}$/.test(endTime)) endTime = hhmmToIso(endTime)

  const legacyType = raw.type
  let type: Event['type']
  let isFixed: boolean
  if (legacyType === 'flexible') {
    type = 'work'
    isFixed = false
  } else if (legacyType === 'fixed') {
    type = /会议|评审|同步|周会|对齐/.test(title) ? 'meeting' : 'fixed'
    isFixed = true
  } else if (
    legacyType === 'work' ||
    legacyType === 'meeting' ||
    legacyType === 'rest' ||
    legacyType === 'fixed'
  ) {
    type = legacyType as Event['type']
    isFixed =
      typeof raw.isFixed === 'boolean'
        ? raw.isFixed
        : type === 'fixed' || type === 'meeting'
  } else {
    type = 'work'
    isFixed = false
  }

  const source =
    raw.source === 'feishu' ||
    raw.source === 'manual' ||
    raw.source === 'agent_suggested' ||
    raw.source === 'agent_accepted' ||
    raw.source === 'apple'
      ? (raw.source as Event['source'])
      : 'manual'

  const ev: Event = {
    id,
    title,
    startTime,
    endTime,
    type,
    isFixed,
    source,
  }
  if (typeof raw.feishuEventId === 'string') ev.feishuEventId = raw.feishuEventId
  if (typeof raw.acceptedAt === 'string') ev.acceptedAt = raw.acceptedAt
  return ev
}

interface AppState {
  currentEnergyLevel: number
  energyHistory: EnergyPoint[]
  heartRate: number
  stressLevel: StressLevel
  activeScenario: ScenarioId

  logs: LogEntry[]

  scheduleEvents: Event[]
  originalEvents: Event[]
  analysisResults: Issue[]
  scheduleSuggestions: ScheduleSuggestion[]
  acceptedIds: string[]
  ignoredEventIds: string[]
  scheduleConfirmed: boolean
  isAnalyzing: boolean
  analysisError: string | null
  errorMessage: string | null
  lastSyncTime: string

  lastSyncSnapshot: SyncSnapshot | null

  userName: string
  userEmail: string
  feishuConnected: boolean
  feishuAccessToken: string | null
  lastSyncedAt: string | null

  energyThreshold: number
  notificationsEnabled: boolean
  demoMode: boolean

  userDrawerOpen: boolean

  setCurrentEnergyLevel: (v: number) => void
  appendEnergyHistory: (point: EnergyPoint) => void
  setHeartRate: (v: number) => void
  setStressLevel: (v: StressLevel) => void
  setActiveScenario: (v: ScenarioId) => void

  appendLog: (entry: Omit<LogEntry, 'id' | 'time'> & { time?: string }) => void
  appendLogs: (entries: Array<Omit<LogEntry, 'id' | 'time'> & { time?: string }>) => void
  resetLogs: (entries?: LogEntry[]) => void

  setScheduleEvents: (events: Event[]) => void
  setOriginalEvents: (events: Event[]) => void
  addEvent: (event: Event) => void
  applyAgentAcceptedEvent: (event: Event) => void
  updateEvent: (id: string, patch: Partial<Event>) => void
  deleteEvent: (id: string) => void

  setAnalysisResults: (issues: Issue[]) => void
  setScheduleSuggestions: (rows: ScheduleSuggestion[]) => void
  acceptIssue: (eventId: string) => void
  ignoreIssue: (eventId: string) => void
  resetIssueDecisions: () => void
  setIsAnalyzing: (v: boolean) => void
  setAnalysisError: (msg: string | null) => void
  setErrorMessage: (msg: string | null) => void
  setScheduleConfirmed: (v: boolean) => void
  setLastSyncTime: (v: string) => void

  resetScheduleForScenario: (events: Event[]) => void

  setLastSyncSnapshot: (s: SyncSnapshot | null) => void

  setUserName: (v: string) => void
  setUserEmail: (v: string) => void
  setFeishuConnected: (v: boolean) => void
  setFeishuAccessToken: (token: string) => void
  disconnectFeishu: () => void
  setLastSyncedAt: (iso: string | null) => void

  setEnergyThreshold: (v: number) => void
  setNotificationsEnabled: (v: boolean) => void
  setDemoMode: (v: boolean) => void

  setUserDrawerOpen: (v: boolean) => void
}

const nowTime = () => {
  const d = new Date()
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export const nowHHmm = () => {
  const d = new Date()
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

let idSeq = 0
const nextId = () => `log-${Date.now()}-${idSeq++}`

const initialLogs: LogEntry[] = [
  {
    id: nextId(),
    time: '14:32:08',
    level: 'INFO',
    message: '系统初始化完成，开始监听生理信号...',
  },
  {
    id: nextId(),
    time: '14:32:10',
    level: 'INFO',
    message: '已加载用户日程：3 项事件 (2 固定 / 1 弹性)',
  },
]

const sortByStart = (a: Event, b: Event) =>
  a.startTime.localeCompare(b.startTime)

const initialToken =
  typeof localStorage !== 'undefined'
    ? localStorage.getItem('feishu_token')
    : null

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      currentEnergyLevel: 15,
      energyHistory: seedEnergyHistory(15),
      heartRate: 72,
      stressLevel: 'low',
      activeScenario: null,
      logs: initialLogs,

      scheduleEvents: initialSchedule,
      originalEvents: [],
      analysisResults: [],
      scheduleSuggestions: [],
      acceptedIds: [],
      ignoredEventIds: [],
      scheduleConfirmed: false,
      isAnalyzing: false,
      analysisError: null,
      errorMessage: null,
      lastSyncTime: '',

      lastSyncSnapshot: null,

      userName: '用户',
      userEmail: '',
      feishuConnected: !!initialToken,
      feishuAccessToken: initialToken,
      lastSyncedAt: null,

      energyThreshold: 30,
      notificationsEnabled: true,
      demoMode: true,

      userDrawerOpen: false,

      setCurrentEnergyLevel: (v) => {
        const rounded = Math.max(0, Math.min(100, Math.round(v)))
        const pt: EnergyPoint = {
          time: new Date().toISOString(),
          value: rounded,
        }
        set((s) => ({
          currentEnergyLevel: rounded,
          energyHistory: assertEnergySynced([...s.energyHistory, pt], rounded),
        }))
      },

      appendEnergyHistory: (point) => {
        const rounded = Math.max(0, Math.min(100, Math.round(point.value)))
        const pt = { ...point, value: rounded }
        set((s) => ({
          energyHistory: assertEnergySynced([...s.energyHistory, pt], rounded),
          currentEnergyLevel: rounded,
        }))
      },

      setHeartRate: (v) =>
        set({ heartRate: Math.max(40, Math.min(120, Math.round(v))) }),
      setStressLevel: (v) => set({ stressLevel: v }),
      setActiveScenario: (v) => set({ activeScenario: v }),

      appendLog: (entry) =>
        set((state) => ({
          logs: [
            ...state.logs,
            {
              id: nextId(),
              time: entry.time ?? nowTime(),
              level: entry.level,
              message: entry.message,
              animate: entry.animate ?? true,
            },
          ],
        })),

      appendLogs: (entries) =>
        set((state) => ({
          logs: [
            ...state.logs,
            ...entries.map((e) => ({
              id: nextId(),
              time: e.time ?? nowTime(),
              level: e.level,
              message: e.message,
              animate: e.animate ?? true,
            })),
          ],
        })),

      resetLogs: (entries) => set({ logs: entries ?? initialLogs }),

      setScheduleEvents: (events) =>
        set({
          scheduleEvents: [...events].sort(sortByStart),
          acceptedIds: [],
          ignoredEventIds: [],
          scheduleConfirmed: false,
          scheduleSuggestions: [],
        }),

      setOriginalEvents: (events) => set({ originalEvents: [...events] }),

      addEvent: (event) =>
        set((s) => ({
          scheduleEvents: [...s.scheduleEvents, event].sort(sortByStart),
          acceptedIds: [],
          ignoredEventIds: [],
          scheduleConfirmed: false,
          scheduleSuggestions: [],
        })),

      applyAgentAcceptedEvent: (event) =>
        set((s) => ({
          scheduleEvents: [...s.scheduleEvents, event].sort(sortByStart),
          scheduleConfirmed: false,
        })),

      updateEvent: (id, patch) =>
        set((s) => ({
          scheduleEvents: s.scheduleEvents
            .map((e) => (e.id === id ? { ...e, ...patch } : e))
            .sort(sortByStart),
          acceptedIds: s.acceptedIds.filter((aid) => aid !== id),
          ignoredEventIds: s.ignoredEventIds.filter((iid) => iid !== id),
          scheduleConfirmed: false,
          scheduleSuggestions: [],
        })),

      deleteEvent: (id) =>
        set((s) => ({
          scheduleEvents: s.scheduleEvents.filter((e) => e.id !== id),
          acceptedIds: s.acceptedIds.filter((aid) => aid !== id),
          ignoredEventIds: s.ignoredEventIds.filter((iid) => iid !== id),
          scheduleConfirmed: false,
          scheduleSuggestions: [],
        })),

      setAnalysisResults: (issues) =>
        set({
          analysisResults: issues,
          scheduleConfirmed: false,
        }),

      setScheduleSuggestions: (rows) => set({ scheduleSuggestions: rows }),

      acceptIssue: (eventId) =>
        set((s) => ({
          acceptedIds: s.acceptedIds.includes(eventId)
            ? s.acceptedIds
            : [...s.acceptedIds, eventId],
          ignoredEventIds: s.ignoredEventIds.filter((id) => id !== eventId),
        })),

      ignoreIssue: (eventId) =>
        set((s) => ({
          ignoredEventIds: s.ignoredEventIds.includes(eventId)
            ? s.ignoredEventIds
            : [...s.ignoredEventIds, eventId],
          acceptedIds: s.acceptedIds.filter((id) => id !== eventId),
        })),

      resetIssueDecisions: () => set({ acceptedIds: [], ignoredEventIds: [] }),
      setIsAnalyzing: (v) => set({ isAnalyzing: v }),
      setAnalysisError: (msg) => set({ analysisError: msg }),
      setErrorMessage: (msg) => set({ errorMessage: msg }),
      setScheduleConfirmed: (v) => set({ scheduleConfirmed: v }),

      setLastSyncTime: (v) => set({ lastSyncTime: v }),

      resetScheduleForScenario: (events) =>
        set({
          scheduleEvents: [...events].sort(sortByStart),
          originalEvents: [],
          analysisResults: [],
          scheduleSuggestions: [],
          acceptedIds: [],
          ignoredEventIds: [],
          scheduleConfirmed: false,
          isAnalyzing: false,
          analysisError: null,
        }),

      setLastSyncSnapshot: (s) => set({ lastSyncSnapshot: s }),

      setUserName: (v) => set({ userName: v }),
      setUserEmail: (v) => set({ userEmail: v }),

      setFeishuConnected: (v) => set({ feishuConnected: v }),

      setFeishuAccessToken: (token) => {
        setFeishuToken(token)
        set({
          feishuAccessToken: token,
          feishuConnected: true,
        })
      },

      disconnectFeishu: () => {
        setFeishuToken(null)
        set({
          feishuAccessToken: null,
          feishuConnected: false,
          userEmail: '',
        })
      },

      setLastSyncedAt: (iso) => set({ lastSyncedAt: iso }),

      setEnergyThreshold: (v) => set({ energyThreshold: v }),
      setNotificationsEnabled: (v) => set({ notificationsEnabled: v }),
      setDemoMode: (v) => set({ demoMode: v }),

      setUserDrawerOpen: (v) => set({ userDrawerOpen: v }),
    }),
    {
      name: 'vita_app_state',
      version: 3,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        currentEnergyLevel: s.currentEnergyLevel,
        energyHistory: s.energyHistory,
        activeScenario: s.activeScenario,
        acceptedIds: s.acceptedIds,
        lastSyncTime: s.lastSyncTime,
        lastSyncSnapshot: s.lastSyncSnapshot,
        userName: s.userName,
        userEmail: s.userEmail,
        energyThreshold: s.energyThreshold,
        notificationsEnabled: s.notificationsEnabled,
        demoMode: s.demoMode,
        scheduleEvents: s.scheduleEvents,
      }),
      migrate: (persisted, version) => {
        let p = persisted as Record<string, unknown>
        if (version < 3 && p && typeof p === 'object') {
          const el = p.energyLevel
          if (typeof el === 'number' && p.currentEnergyLevel === undefined) {
            p = { ...p, currentEnergyLevel: el }
          }
          const se = p.scheduleEvents
          if (Array.isArray(se)) {
            p = {
              ...p,
              scheduleEvents: se.map((raw) =>
                migrateLegacyEvent(raw as Record<string, unknown>),
              ),
            }
          }
          if (!Array.isArray(p.energyHistory)) {
            const lvl =
              typeof p.currentEnergyLevel === 'number' ? p.currentEnergyLevel : 15
            p = { ...p, energyHistory: seedEnergyHistory(lvl) }
          }
        }
        if (version < 2 && p && typeof p === 'object') {
          p = { ...p, lastSyncSnapshot: null }
        }
        return p as unknown as AppState
      },
    },
  ),
)

if (typeof window !== 'undefined') {
  try {
    const legacy = localStorage.getItem('vita_settings')
    const fresh = localStorage.getItem('vita_app_state')
    if (legacy && !fresh) {
      const parsed = JSON.parse(legacy)
      const s = useAppStore.getState()
      if (typeof parsed.userName === 'string') s.setUserName(parsed.userName)
      if (typeof parsed.userEmail === 'string') s.setUserEmail(parsed.userEmail)
      if (typeof parsed.energyThreshold === 'number')
        s.setEnergyThreshold(parsed.energyThreshold)
      if (typeof parsed.notificationsEnabled === 'boolean')
        s.setNotificationsEnabled(parsed.notificationsEnabled)
      if (typeof parsed.demoMode === 'boolean') s.setDemoMode(parsed.demoMode)
      if (typeof parsed.lastSyncTime === 'string')
        s.setLastSyncTime(parsed.lastSyncTime)
      localStorage.removeItem('vita_settings')
    }
  } catch {
    // ignore
  }
}
