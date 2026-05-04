import type { Event as ScheduleEvent, Issue } from '../data/mockData'
import callZhipu, { REST_KEYWORDS } from '../lib/zhipuClient'
import {
  addMinutesIso,
  durationMinutesIso,
  parseInstant,
} from '../utils/scheduleTime'

export interface ScheduleSuggestion {
  id: string
  type: 'insert_rest' | 'split_work' | 'delay_reminder' | 'reschedule'
  targetEventId?: string
  insertAfterEventId?: string
  newEvent?: Omit<ScheduleEvent, 'id' | 'source'>
  reason: string
  confidence: number
}

const uuid = (): string => {
  try {
    return crypto.randomUUID()
  } catch {
    return `sg-${Date.now()}-${Math.random().toString(16).slice(2)}`
  }
}

export function isRestTitle(title: string): boolean {
  if (!title) return false
  return REST_KEYWORDS.some((kw) => title.includes(kw))
}

/** Rule 3 — fixed items cannot be moved or split by the advisor. */
export function isEventModifiable(event: ScheduleEvent): boolean {
  return !event.isFixed
}

/**
 * Rule 1 — true if any `type === 'rest'` event overlaps [windowStart, windowEnd].
 */
export function hasRestInWindow(
  events: ScheduleEvent[],
  windowStart: string,
  windowEnd: string,
): boolean {
  const ws = parseInstant(windowStart).getTime()
  const we = parseInstant(windowEnd).getTime()
  return events.some((e) => {
    if (e.type !== 'rest') return false
    const es = parseInstant(e.startTime).getTime()
    const ee = parseInstant(e.endTime).getTime()
    return !(ee <= ws || es >= we)
  })
}

/**
 * Rule 2 — accepted blocks overlap the suggestion's proposed window.
 */
export function isAlreadyAccepted(
  events: ScheduleEvent[],
  suggestion: ScheduleSuggestion,
): boolean {
  const accepted = events.filter((e) => e.source === 'agent_accepted')
  if (accepted.length === 0) return false

  if (suggestion.newEvent) {
    const ws = parseInstant(suggestion.newEvent.startTime).getTime()
    const we = parseInstant(suggestion.newEvent.endTime).getTime()
    return accepted.some((a) => {
      const as = parseInstant(a.startTime).getTime()
      const ae = parseInstant(a.endTime).getTime()
      return !(ae <= ws || as >= we)
    })
  }

  const anchorId =
    suggestion.insertAfterEventId ?? suggestion.targetEventId ?? ''
  const anchor = events.find((e) => e.id === anchorId)
  if (!anchor) return false
  const ws = parseInstant(anchor.startTime).getTime()
  const we = parseInstant(anchor.endTime).getTime()
  return accepted.some((a) => {
    const as = parseInstant(a.startTime).getTime()
    const ae = parseInstant(a.endTime).getTime()
    return !(ae <= ws || as >= we)
  })
}

function windowAround(centerIso: string, plusMinusMinutes: number): [string, string] {
  const c = parseInstant(centerIso).getTime()
  const ms = plusMinusMinutes * 60000
  return [
    new Date(c - ms).toISOString(),
    new Date(c + ms).toISOString(),
  ]
}

/** Apply Rules 1–3 plus insert_rest ±30min dedupe window. */
export function filterSuggestions(
  events: ScheduleEvent[],
  suggestions: ScheduleSuggestion[],
): ScheduleSuggestion[] {
  return suggestions.filter((s) => {
    if (isAlreadyAccepted(events, s)) return false

    if (s.type === 'insert_rest' && s.newEvent) {
      const [wStart, wEnd] = windowAround(s.newEvent.startTime, 30)
      if (hasRestInWindow(events, wStart, wEnd)) return false
    }

    const targetId = s.targetEventId ?? s.insertAfterEventId
    if (targetId) {
      const target = events.find((e) => e.id === targetId)
      if (target && !isEventModifiable(target)) return false
    }

    return true
  })
}

function eligibleWork(events: ScheduleEvent[]): ScheduleEvent[] {
  return events.filter(
    (e) =>
      isEventModifiable(e) &&
      e.type !== 'rest' &&
      !isRestTitle(e.title),
  )
}

function suggestInsertRestAfter(
  _events: ScheduleEvent[],
  ev: ScheduleEvent,
  breakMinutes: number,
  reason: string,
): ScheduleSuggestion {
  const restStart = ev.endTime
  const restEnd = addMinutesIso(restStart, breakMinutes)
  return {
    id: uuid(),
    type: 'insert_rest',
    insertAfterEventId: ev.id,
    targetEventId: ev.id,
    newEvent: {
      title: `代谢恢复 ${breakMinutes} 分钟`,
      startTime: restStart,
      endTime: restEnd,
      type: 'rest',
      isFixed: false,
    },
    reason,
    confidence: 1,
  }
}

function ruleEngineSuggestions(
  events: ScheduleEvent[],
  energy: number,
): ScheduleSuggestion[] {
  if (events.length === 0) return []

  const hasKeywordRest = events.some((e) => isRestTitle(e.title))
  if (energy > 80 && hasKeywordRest) return []
  if (energy >= 80) return []

  const candidates = eligibleWork(events)
  if (candidates.length === 0) return []

  let durationThreshold: number
  if (energy >= 50) durationThreshold = 180
  else if (energy >= 30) durationThreshold = 90
  else durationThreshold = 60

  const ranked = [...candidates].sort(
    (a, b) =>
      durationMinutesIso(b.startTime, b.endTime) -
      durationMinutesIso(a.startTime, a.endTime),
  )

  const longEnough = ranked.filter(
    (e) => durationMinutesIso(e.startTime, e.endTime) >= durationThreshold,
  )

  const pick =
    longEnough[0] ??
    (energy < 30 ? ranked[0] : undefined)

  if (!pick) return []

  const breakMinutes = energy < 25 ? 30 : energy < 40 ? 20 : 30

  const sug = suggestInsertRestAfter(
    events,
    pick,
    breakMinutes,
    `${pick.title} 持续 ${durationMinutesIso(pick.startTime, pick.endTime)} 分钟，当前电量 ${energy}% 易累积疲劳，建议在结束后插入短暂恢复窗口。`,
  )

  const extras: ScheduleSuggestion[] = []

  if (energy < 18 && ranked.length >= 2) {
    const second = ranked.find((e) => e.id !== pick.id)
    if (second && durationMinutesIso(second.startTime, second.endTime) >= 120) {
      extras.push(
        suggestInsertRestAfter(
          events,
          second,
          30,
          `${second.title} 时长较长且电量极低，追加一段恢复可降低连续负荷。`,
        ),
      )
    }
  }

  if (energy < 38 && energy >= 25) {
    const fixedMeeting = events.find(
      (e) =>
        e.isFixed &&
        (e.type === 'meeting' || e.type === 'fixed') &&
        durationMinutesIso(e.startTime, e.endTime) >= 90,
    )
    const flexAfter = ranked.find((e) => parseInstant(e.startTime) > parseInstant(fixedMeeting?.endTime ?? '1970-01-01'))
    if (fixedMeeting && flexAfter) {
      extras.push({
        id: uuid(),
        type: 'delay_reminder',
        targetEventId: flexAfter.id,
        insertAfterEventId: fixedMeeting.id,
        reason:
          '会议密集时段建议降低非紧急打扰；在会议结束后再进入下一项深度工作。',
        confidence: 0.85,
      })
    }
  }

  return filterSuggestions(events, [sug, ...extras])
}

function tryParseSuggestionArray(raw: string): Partial<ScheduleSuggestion>[] | null {
  const trimmed = raw.trim()
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const text = fence ? fence[1].trim() : trimmed
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start === -1 || end === -1 || end < start) return null
  try {
    const parsed = JSON.parse(text.slice(start, end + 1)) as unknown
    if (!Array.isArray(parsed)) return null
    return parsed as Partial<ScheduleSuggestion>[]
  } catch {
    return null
  }
}

function normalizeLlmSuggestion(
  raw: Partial<ScheduleSuggestion>,
  events: ScheduleEvent[],
): ScheduleSuggestion | null {
  const type = raw.type
  if (
    type !== 'insert_rest' &&
    type !== 'split_work' &&
    type !== 'delay_reminder' &&
    type !== 'reschedule'
  )
    return null
  const reason =
    typeof raw.reason === 'string' ? raw.reason : '日程优化建议'
  const tid =
    typeof raw.targetEventId === 'string' ? raw.targetEventId : undefined
  const ia =
    typeof raw.insertAfterEventId === 'string'
      ? raw.insertAfterEventId
      : undefined
  const validIds = new Set(events.map((e) => e.id))
  if (tid && !validIds.has(tid)) return null
  if (ia && !validIds.has(ia)) return null

  let newEvent = raw.newEvent as ScheduleSuggestion['newEvent']
  if (newEvent) {
    if (
      typeof newEvent.title !== 'string' ||
      typeof newEvent.startTime !== 'string' ||
      typeof newEvent.endTime !== 'string' ||
      !['work', 'meeting', 'rest', 'fixed'].includes(String(newEvent.type))
    )
      newEvent = undefined
    else {
      newEvent = {
        title: newEvent.title,
        startTime: newEvent.startTime,
        endTime: newEvent.endTime,
        type: newEvent.type as ScheduleEvent['type'],
        isFixed: Boolean(newEvent.isFixed),
      }
    }
  }

  const conf =
    typeof raw.confidence === 'number' &&
    raw.confidence >= 0 &&
    raw.confidence <= 1
      ? raw.confidence
      : 0.72

  return {
    id: uuid(),
    type,
    targetEventId: tid,
    insertAfterEventId: ia,
    newEvent,
    reason,
    confidence: conf,
  }
}

/**
 * Generate reschedule suggestions from rules and optional GLM-4-flash.
 * Rule-engine output is deterministic for identical inputs.
 */
export async function generateScheduleSuggestions(
  events: ScheduleEvent[],
  currentEnergy: number,
  useAI: boolean,
): Promise<ScheduleSuggestion[]> {
  const base = ruleEngineSuggestions(events, currentEnergy)

  if (!useAI) return base

  const apiKeyMissing =
    !import.meta.env.VITE_ZHIPU_API_KEY ||
    String(import.meta.env.VITE_ZHIPU_API_KEY).startsWith('请填入')

  if (apiKeyMissing) return base

  const systemPrompt = `你是一个健康日程优化助手。根据用户当前的身体电量和日程安排，提出具体的日程调整建议。

规则：
1. 只针对 isFixed=false 的事件提出修改
2. 如果某个时间段已经有休息事件（type=rest），不要再建议插入休息
3. 建议必须基于实际日程数据，不能凭空生成
4. 返回 JSON 数组，格式严格遵循 ScheduleSuggestion 接口（字段：type, targetEventId?, insertAfterEventId?, newEvent?, reason, confidence）

当前电量：${currentEnergy}%
当前日程（JSON）：${JSON.stringify(events, null, 2)}

请返回建议数组（JSON only，无其他文字）：`

  try {
    const raw = await callZhipu([{ role: 'user', content: systemPrompt }])
    const parsed = tryParseSuggestionArray(raw)
    if (!parsed || parsed.length === 0) return base

    const mapped = parsed
      .map((p) => normalizeLlmSuggestion(p, events))
      .filter((x): x is ScheduleSuggestion => !!x)

    const merged = [...mapped, ...base]
    const dedup = dedupeByTarget(merged)
    return filterSuggestions(events, dedup)
  } catch {
    return base
  }
}

function dedupeByTarget(list: ScheduleSuggestion[]): ScheduleSuggestion[] {
  const seen = new Set<string>()
  const out: ScheduleSuggestion[] = []
  for (const s of list) {
    const key = `${s.type}:${s.insertAfterEventId ?? ''}:${s.targetEventId ?? ''}:${s.newEvent?.startTime ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(s)
  }
  return out
}

/**
 * Map advisor output to legacy `Issue` cards (EventCard).
 */
export function suggestionsToIssues(rows: ScheduleSuggestion[]): Issue[] {
  return rows
    .map((s) => {
      const anchor = s.insertAfterEventId ?? s.targetEventId ?? ''
      const insertBreakAfter = s.type === 'insert_rest'
      let breakDuration = 30
      if (s.newEvent) {
        breakDuration = Math.max(
          5,
          durationMinutesIso(s.newEvent.startTime, s.newEvent.endTime),
        )
      }
      const suggestionLine =
        s.type === 'delay_reminder'
          ? '会议结束后再进入下一项任务，减少打断与切换成本'
          : s.newEvent?.title ?? '日程优化建议'
      return {
        eventId: anchor,
        reason: s.reason,
        suggestion: suggestionLine,
        insertBreakAfter,
        breakDuration,
        suggestionId: s.id,
      }
    })
    .filter((i) => i.eventId.length > 0)
}
