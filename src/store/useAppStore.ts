import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Event, Issue } from '../data/mockData'
import { initialSchedule } from '../data/mockData'
import type { ScenarioId } from '../data/mockAnalysis'

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
  /** Local schedule as it was just *before* push completed. Restoring this
   *  rewinds local edits that the user pushed. */
  eventsBefore: Event[]
  /** Original (= remote baseline) snapshot before the push. */
  originalBefore: Event[]
  /** Feishu event_ids that were created during the push and should be
   *  deleted on undo. */
  createdFeishuIds: string[]
  /** Local ids of events for which a feishuEventId was assigned during push.
   *  On undo we strip the feishuEventId so the local copy goes back to
   *  un-synced state. */
  createdLocalIds: string[]
  /** Human-readable timestamp ("HH:MM"). */
  syncedAt: string
  /** True when the source push was performed in demo mode (no remote calls
   *  to undo, just restore local state). */
  demo: boolean
}

interface AppState {
  // Physiology
  energyLevel: number
  heartRate: number
  stressLevel: StressLevel
  activeScenario: ScenarioId

  // Logs
  logs: LogEntry[]

  // Schedule
  scheduleEvents: Event[]
  /** Last snapshot fetched from Feishu — used to diff before pushing back. */
  originalEvents: Event[]
  analysisResults: Issue[]
  /** Persisted: ids whose suggestion the user accepted across sessions. */
  acceptedIds: string[]
  /** IDs ignored within the *current* analysis cycle. Cleared on reanalyze. */
  ignoredEventIds: string[]
  scheduleConfirmed: boolean
  isAnalyzing: boolean
  analysisError: string | null
  lastSyncTime: string

  // Sync history
  lastSyncSnapshot: SyncSnapshot | null

  // User / connections
  userName: string
  userEmail: string
  feishuConnected: boolean

  // Settings
  energyThreshold: number
  notificationsEnabled: boolean
  demoMode: boolean

  // UI
  userDrawerOpen: boolean

  // Actions
  setEnergyLevel: (v: number) => void
  setHeartRate: (v: number) => void
  setStressLevel: (v: StressLevel) => void
  setActiveScenario: (v: ScenarioId) => void

  appendLog: (entry: Omit<LogEntry, 'id' | 'time'> & { time?: string }) => void
  appendLogs: (entries: Array<Omit<LogEntry, 'id' | 'time'> & { time?: string }>) => void
  resetLogs: (entries?: LogEntry[]) => void

  // Schedule actions
  setScheduleEvents: (events: Event[]) => void
  setOriginalEvents: (events: Event[]) => void
  addEvent: (event: Event) => void
  updateEvent: (id: string, patch: Partial<Event>) => void
  deleteEvent: (id: string) => void

  setAnalysisResults: (issues: Issue[]) => void
  acceptIssue: (eventId: string) => void
  ignoreIssue: (eventId: string) => void
  resetIssueDecisions: () => void
  setIsAnalyzing: (v: boolean) => void
  setAnalysisError: (msg: string | null) => void
  setScheduleConfirmed: (v: boolean) => void
  setLastSyncTime: (v: string) => void

  /**
   * Wipe every piece of derived schedule state and load a new event list.
   * Used by the scenario buttons on the Control page so a previous
   * scenario's analysis/issues/decisions never leak into the next one.
   */
  resetScheduleForScenario: (events: Event[]) => void

  setLastSyncSnapshot: (s: SyncSnapshot | null) => void

  setUserName: (v: string) => void
  setUserEmail: (v: string) => void
  setFeishuConnected: (v: boolean) => void

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

const nowHHmm = () => {
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

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      energyLevel: 15,
      heartRate: 72,
      stressLevel: 'low',
      activeScenario: null,
      logs: initialLogs,

      scheduleEvents: initialSchedule,
      originalEvents: [],
      analysisResults: [],
      acceptedIds: [],
      ignoredEventIds: [],
      scheduleConfirmed: false,
      isAnalyzing: false,
      analysisError: null,
      lastSyncTime: '',

      lastSyncSnapshot: null,

      userName: '用户',
      userEmail: '',
      feishuConnected:
        typeof localStorage !== 'undefined' &&
        !!localStorage.getItem('feishu_token'),

      energyThreshold: 30,
      notificationsEnabled: true,
      demoMode: true,

      userDrawerOpen: false,

      setEnergyLevel: (v) =>
        set({ energyLevel: Math.max(0, Math.min(100, Math.round(v))) }),
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
        }),

      setOriginalEvents: (events) => set({ originalEvents: [...events] }),

      addEvent: (event) =>
        set((s) => ({
          scheduleEvents: [...s.scheduleEvents, event].sort(sortByStart),
          acceptedIds: [],
          ignoredEventIds: [],
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
        })),

      deleteEvent: (id) =>
        set((s) => ({
          scheduleEvents: s.scheduleEvents.filter((e) => e.id !== id),
          acceptedIds: s.acceptedIds.filter((aid) => aid !== id),
          ignoredEventIds: s.ignoredEventIds.filter((iid) => iid !== id),
          scheduleConfirmed: false,
        })),

      setAnalysisResults: (issues) =>
        set({
          analysisResults: issues,
          acceptedIds: [],
          ignoredEventIds: [],
          scheduleConfirmed: false,
        }),

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
      setScheduleConfirmed: (v) => set({ scheduleConfirmed: v }),

      setLastSyncTime: (v) => set({ lastSyncTime: v }),

      resetScheduleForScenario: (events) =>
        set({
          scheduleEvents: [...events].sort(sortByStart),
          originalEvents: [],
          analysisResults: [],
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

      setEnergyThreshold: (v) => set({ energyThreshold: v }),
      setNotificationsEnabled: (v) => set({ notificationsEnabled: v }),
      setDemoMode: (v) => set({ demoMode: v }),

      setUserDrawerOpen: (v) => set({ userDrawerOpen: v }),
    }),
    {
      name: 'vita_app_state',
      version: 2,
      storage: createJSONStorage(() => localStorage),
      // Only fields the user expects to survive reloads. Transient analysis
      // state, logs, and dialog flags are intentionally excluded.
      partialize: (s) => ({
        energyLevel: s.energyLevel,
        activeScenario: s.activeScenario,
        acceptedIds: s.acceptedIds,
        lastSyncTime: s.lastSyncTime,
        lastSyncSnapshot: s.lastSyncSnapshot,
        userName: s.userName,
        userEmail: s.userEmail,
        energyThreshold: s.energyThreshold,
        notificationsEnabled: s.notificationsEnabled,
        demoMode: s.demoMode,
      }),
      migrate: (persisted, version) => {
        // v1 → v2: legacy `vita_settings` key already migrated by hand below.
        if (version < 2 && persisted && typeof persisted === 'object') {
          const p = persisted as Record<string, unknown>
          return {
            ...p,
            lastSyncSnapshot: null,
          }
        }
        return persisted as AppState
      },
    },
  ),
)

// One-time legacy migration from `vita_settings` (pre-persist middleware) into
// the new persisted blob. Runs at import time, harmless on subsequent loads.
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
    // ignore — legacy migration is best-effort
  }
}

export { nowHHmm }
