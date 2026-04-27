/**
 * Lightweight Feishu Open Platform client routed via /api/feishu Vite proxy.
 *
 * Note: Feishu's authen access_token endpoint normally requires an
 * `app_access_token` issued from the server side. In a pure browser demo this
 * will not work without a backend; the helpers below are wired up to spec but
 * will fail gracefully if you don't have a backend that mints app_access_token.
 */

import type { Event } from '../data/mockData'

const TOKEN_KEY = 'feishu_token'
const PUSHED_KEYS_STORAGE = 'feishu_pushed_keys'
/** Cap the persisted dedupe ring so it never grows unbounded. */
const PUSHED_KEYS_MAX = 200

export const getFeishuToken = (): string | null =>
  localStorage.getItem(TOKEN_KEY)

export const setFeishuToken = (token: string | null) => {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

/**
 * Stable dedupe key for a calendar event. Uses the title + the absolute
 * start/end timestamps so two pushes of the same logical event (regardless
 * of whether their local id changed) collapse into one Feishu write.
 */
export const eventDedupeKey = (e: {
  title: string
  startTime: string
  endTime: string
}): string => `${e.title}|${hhmmToTimestamp(e.startTime)}|${hhmmToTimestamp(e.endTime)}`

const loadPushedKeys = (): Set<string> => {
  try {
    const raw = localStorage.getItem(PUSHED_KEYS_STORAGE)
    if (!raw) return new Set()
    const arr = JSON.parse(raw)
    if (Array.isArray(arr)) return new Set(arr.filter((x) => typeof x === 'string'))
  } catch {
    // ignore
  }
  return new Set()
}

const savePushedKeys = (set: Set<string>) => {
  try {
    const arr = Array.from(set).slice(-PUSHED_KEYS_MAX)
    localStorage.setItem(PUSHED_KEYS_STORAGE, JSON.stringify(arr))
  } catch {
    // ignore
  }
}

const pushedKeys: Set<string> = loadPushedKeys()

export const hasBeenPushed = (key: string): boolean => pushedKeys.has(key)

export const markPushed = (key: string) => {
  pushedKeys.add(key)
  savePushedKeys(pushedKeys)
}

export const forgetPushed = (key: string) => {
  if (pushedKeys.delete(key)) savePushedKeys(pushedKeys)
}

export const clearPushedKeys = () => {
  pushedKeys.clear()
  savePushedKeys(pushedKeys)
}

export const buildAuthorizeUrl = (): string => {
  const appId = import.meta.env.VITE_FEISHU_APP_ID || ''
  const redirectUri = encodeURIComponent(window.location.origin + window.location.pathname)
  return (
    'https://open.feishu.cn/open-apis/authen/v1/authorize' +
    `?app_id=${appId}` +
    `&redirect_uri=${redirectUri}` +
    `&scope=calendar:calendar`
  )
}

export const exchangeCodeForToken = async (
  code: string,
  appAccessToken: string,
): Promise<string> => {
  const res = await fetch('/api/feishu/open-apis/authen/v1/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${appAccessToken}`,
    },
    body: JSON.stringify({ grant_type: 'authorization_code', code }),
  })
  const data = await res.json()
  const token = data?.data?.access_token
  if (!token) throw new Error('飞书 access_token 获取失败')
  setFeishuToken(token)
  return token
}

interface FeishuRawEvent {
  event_id?: string
  summary?: string
  start_time?: { timestamp?: string }
  end_time?: { timestamp?: string }
  description?: string
}

const tsToHHmm = (ts: string): string => {
  const d = new Date(Number(ts) * 1000)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const hhmmToTimestamp = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return Math.floor(d.getTime() / 1000)
}

const inferType = (raw: FeishuRawEvent): 'fixed' | 'flexible' =>
  /会议|评审|同步|周会|对齐/.test(raw.summary ?? '') ? 'fixed' : 'flexible'

export const listPrimaryEvents = async (): Promise<Event[]> => {
  const token = getFeishuToken()
  if (!token) throw new Error('未连接飞书')
  const res = await fetch(
    '/api/feishu/open-apis/calendar/v4/calendars/primary/events',
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`飞书读取失败 ${res.status}：${text.slice(0, 200)}`)
  }
  const data = await res.json()
  const items: FeishuRawEvent[] = data?.data?.items ?? []
  return items
    .filter((it) => it.event_id && it.start_time?.timestamp && it.end_time?.timestamp)
    .map((it) => ({
      id: 'fs-' + it.event_id!,
      feishuEventId: it.event_id!,
      title: it.summary ?? '未命名',
      startTime: tsToHHmm(it.start_time!.timestamp!),
      endTime: tsToHHmm(it.end_time!.timestamp!),
      type: inferType(it),
      source: 'feishu' as const,
    }))
}

const eventToBody = (e: Event) => ({
  summary: e.title,
  start_time: { timestamp: String(hhmmToTimestamp(e.startTime)) },
  end_time: { timestamp: String(hhmmToTimestamp(e.endTime)) },
  description: '由 VitaSleep 创建',
})

export const createEvent = async (e: Event): Promise<string | undefined> => {
  const token = getFeishuToken()
  if (!token) throw new Error('未连接飞书')

  // Dedupe by (title, startTimestamp, endTimestamp). If we've already pushed
  // an event with the same key in this browser, skip the network call —
  // this prevents accidental double-creation when the user spams "推送"
  // or refreshes mid-sync.
  const key = eventDedupeKey(e)
  if (hasBeenPushed(key)) return undefined

  const res = await fetch(
    '/api/feishu/open-apis/calendar/v4/calendars/primary/events',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(eventToBody(e)),
    },
  )
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`飞书新增失败 ${res.status}：${text.slice(0, 200)}`)
  }
  const data = await res.json()
  markPushed(key)
  return data?.data?.event?.event_id
}

export const patchEvent = async (e: Event): Promise<void> => {
  if (!e.feishuEventId) throw new Error('缺少 feishuEventId，无法 PATCH')
  const token = getFeishuToken()
  if (!token) throw new Error('未连接飞书')
  const res = await fetch(
    `/api/feishu/open-apis/calendar/v4/calendars/primary/events/${e.feishuEventId}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(eventToBody(e)),
    },
  )
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`飞书更新失败 ${res.status}：${text.slice(0, 200)}`)
  }
}

export const deleteEvent = async (
  feishuEventId: string,
  dedupeKey?: string,
): Promise<void> => {
  const token = getFeishuToken()
  if (!token) throw new Error('未连接飞书')
  const res = await fetch(
    `/api/feishu/open-apis/calendar/v4/calendars/primary/events/${feishuEventId}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    },
  )
  if (!res.ok && res.status !== 404) {
    const text = await res.text().catch(() => '')
    throw new Error(`飞书删除失败 ${res.status}：${text.slice(0, 200)}`)
  }
  // Allow the same logical event to be pushed again later.
  if (dedupeKey) forgetPushed(dedupeKey)
}

export interface EventDiff {
  creates: Event[]
  updates: Event[]
  deletes: string[] // feishuEventIds
}

const eventEquivalent = (a: Event, b: Event): boolean =>
  a.title === b.title &&
  a.startTime === b.startTime &&
  a.endTime === b.endTime &&
  a.type === b.type

/** Diff local schedule vs the last-known remote snapshot. */
export const diffEvents = (local: Event[], remote: Event[]): EventDiff => {
  const remoteByFsId = new Map<string, Event>()
  for (const r of remote) {
    if (r.feishuEventId) remoteByFsId.set(r.feishuEventId, r)
  }
  const creates: Event[] = []
  const updates: Event[] = []
  for (const l of local) {
    if (!l.feishuEventId) {
      creates.push(l)
      continue
    }
    const r = remoteByFsId.get(l.feishuEventId)
    if (!r) {
      creates.push(l)
      continue
    }
    if (!eventEquivalent(l, r)) updates.push(l)
  }
  const localFsIds = new Set(
    local.map((l) => l.feishuEventId).filter(Boolean) as string[],
  )
  const deletes: string[] = []
  for (const r of remote) {
    if (r.feishuEventId && !localFsIds.has(r.feishuEventId)) {
      deletes.push(r.feishuEventId)
    }
  }
  return { creates, updates, deletes }
}
