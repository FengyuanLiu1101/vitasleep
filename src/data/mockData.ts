export type EventType = 'fixed' | 'flexible'
export type EventSource = 'feishu' | 'apple' | 'manual'

export interface Event {
  id: string
  title: string
  startTime: string
  endTime: string
  type: EventType
  source: EventSource
  feishuEventId?: string
}

/**
 * Render-only break row produced when the user accepts an Issue with
 * insertBreakAfter. Not part of the persisted Event[] state.
 */
export interface BreakRow {
  id: string
  title: string
  startTime: string
  endTime: string
  type: 'rest'
  subtitle?: string
}

export type DisplayItem = Event | BreakRow

export const initialSchedule: Event[] = [
  {
    id: 'e1',
    title: '产品同步',
    startTime: '14:00',
    endTime: '15:00',
    type: 'fixed',
    source: 'manual',
  },
  {
    id: 'e2',
    title: '核心架构评审',
    startTime: '15:00',
    endTime: '16:30',
    type: 'fixed',
    source: 'manual',
  },
  {
    id: 'e3',
    title: '文档整理',
    startTime: '16:30',
    endTime: '17:30',
    type: 'flexible',
    source: 'manual',
  },
]

export const scenarioSchedules: Record<1 | 2 | 3, Event[]> = {
  1: [
    { id: 's1-e1', title: '晨会', startTime: '09:00', endTime: '10:00', type: 'fixed', source: 'manual' },
    { id: 's1-e2', title: '产品方案撰写', startTime: '10:00', endTime: '12:00', type: 'flexible', source: 'manual' },
    { id: 's1-e3', title: '产品同步', startTime: '14:00', endTime: '15:00', type: 'fixed', source: 'manual' },
    { id: 's1-e4', title: '文档整理', startTime: '15:00', endTime: '17:30', type: 'flexible', source: 'manual' },
  ],
  2: [
    { id: 's2-e1', title: '核心功能开发', startTime: '09:00', endTime: '12:00', type: 'flexible', source: 'manual' },
    { id: 's2-e2', title: '代码审查与优化', startTime: '13:00', endTime: '17:00', type: 'flexible', source: 'manual' },
    { id: 's2-e3', title: '团队周会', startTime: '17:00', endTime: '18:00', type: 'fixed', source: 'manual' },
  ],
  3: [
    { id: 's3-e1', title: '跨部门对齐会议', startTime: '09:00', endTime: '11:00', type: 'fixed', source: 'manual' },
    { id: 's3-e2', title: '核心架构评审', startTime: '11:00', endTime: '12:00', type: 'fixed', source: 'manual' },
    { id: 's3-e3', title: '专项研究', startTime: '14:00', endTime: '16:00', type: 'flexible', source: 'manual' },
    { id: 's3-e4', title: '邮件处理', startTime: '16:00', endTime: '17:00', type: 'flexible', source: 'manual' },
  ],
}

export interface Issue {
  eventId: string
  reason: string
  suggestion: string
  insertBreakAfter: boolean
  breakDuration: number
}

const durationMinutes = (e: Event): number => {
  const [sh, sm] = e.startTime.split(':').map(Number)
  const [eh, em] = e.endTime.split(':').map(Number)
  return eh * 60 + em - (sh * 60 + sm)
}

/** Generate a fallback issue list when the Zhipu API isn't available. */
export const generateMockIssues = (events: Event[]): Issue[] => {
  if (events.length === 0) return []
  const flexLong = events
    .filter((e) => e.type === 'flexible' && durationMinutes(e) >= 90)
    .sort((a, b) => durationMinutes(b) - durationMinutes(a))[0]
  const target =
    flexLong ??
    [...events].sort((a, b) => durationMinutes(b) - durationMinutes(a))[0]
  if (!target) return []
  return [
    {
      eventId: target.id,
      reason: `${target.title} 持续 ${durationMinutes(target)} 分钟，可能积累认知负荷`,
      suggestion: '在结束后插入 30 分钟代谢恢复窗口',
      insertBreakAfter: true,
      breakDuration: 30,
    },
  ]
}

export interface TrendPoint {
  label: string
  value: number
}

export const energyTrend7d: TrendPoint[] = [
  { label: 'MON', value: 78 },
  { label: 'TUE', value: 64 },
  { label: 'WED', value: 82 },
  { label: 'THU', value: 70 },
  { label: 'FRI', value: 88 },
  { label: 'SAT', value: 92 },
  { label: 'SUN', value: 85 },
]

export const energyTrend30d: TrendPoint[] = Array.from({ length: 30 }, (_, i) => {
  const base = 70
  const wave = Math.sin((i / 30) * Math.PI * 3) * 14
  const noise = ((i * 17) % 9) - 4
  return {
    label: `D${i + 1}`,
    value: Math.max(40, Math.min(98, Math.round(base + wave + noise))),
  }
})

export interface SleepBar {
  label: string
  hours: number
}

export const sleep7d: SleepBar[] = [
  { label: 'MON', hours: 7.0 },
  { label: 'TUE', hours: 8.0 },
  { label: 'WED', hours: 5.5 },
  { label: 'THU', hours: 6.0 },
  { label: 'FRI', hours: 8.0 },
  { label: 'SAT', hours: 8.0 },
  { label: 'SUN', hours: 7.0 },
]

export const sleep30d: SleepBar[] = Array.from({ length: 30 }, (_, i) => {
  const wave = Math.sin((i / 30) * Math.PI * 4) * 1.2
  const noise = ((i * 11) % 7) / 10 - 0.3
  return {
    label: `D${i + 1}`,
    hours: Math.max(4.5, Math.min(9, +(7.2 + wave + noise).toFixed(1))),
  }
})

export const metricsGrid = [
  { key: 'hr', label: '静息心率', value: '62', unit: 'bpm', icon: 'heart' as const },
  { key: 'cal', label: '活跃卡路里', value: '2.4k', unit: 'kcal', icon: 'bolt' as const },
  { key: 'stress', label: '压力水平', value: '低', unit: '皮质醇', icon: 'battery-low' as const },
  { key: 'spo2', label: '步率', value: '94%', unit: '稳态', icon: 'droplet' as const },
]

export interface Scenario {
  id: 1 | 2 | 3
  title: string
  subtitle: string
}

export const scenarios: Scenario[] = [
  {
    id: 1,
    title: '场景1：基础闭环',
    subtitle: '标准24小时生理节律，无干扰因素',
  },
  {
    id: 2,
    title: '场景2：高疲劳干预',
    subtitle: '将身体电量降至15%，触发街道策略',
  },
  {
    id: 3,
    title: '场景3：免打扰适配',
    subtitle: '模拟外部干扰屏蔽，优先认知窗口',
  },
]

export interface ScenarioLogTemplate {
  level: 'INFO' | 'WARN' | 'DONE' | 'ERROR'
  message: string
}

export const scenarioLogs: Record<1 | 2 | 3, ScenarioLogTemplate[]> = {
  1: [
    { level: 'INFO', message: '触发场景1：基础闭环' },
    { level: 'INFO', message: '加载日程数据集 1（4 项事件）' },
    { level: 'INFO', message: '采样生理信号：HRV 正常 / 皮质醇平稳' },
    { level: 'DONE', message: '24h 节律基线已建立' },
  ],
  2: [
    { level: 'INFO', message: '触发场景2：高疲劳干预' },
    { level: 'INFO', message: '加载日程数据集 2（3 项事件，连续高强度）' },
    { level: 'INFO', message: '检测到身体电量低于阈值（当前：15%）' },
    { level: 'WARN', message: '识别到可移动弹性事件：代码审查与优化' },
    { level: 'DONE', message: '建议已推送至日程优化页面' },
  ],
  3: [
    { level: 'INFO', message: '触发场景3：免打扰适配' },
    { level: 'INFO', message: '加载日程数据集 3（4 项事件，会议密集）' },
    { level: 'WARN', message: '进入认知保护窗口，屏蔽非紧急消息' },
    { level: 'DONE', message: '已为下一专注块预留 45 分钟静默期' },
  ],
}
