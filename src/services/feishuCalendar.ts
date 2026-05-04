/**
 * Feishu Calendar API stubs aligned with Open Platform shapes.
 * Uses mock data when credentials or network are unavailable.
 */

import type {
  CreateEventPayload,
  FeishuCalendar,
  FeishuEvent,
} from '../types/feishu'

const MOCK_CALENDARS: FeishuCalendar[] = [
  {
    calendar_id: 'mock-cal-primary',
    summary: '主日历',
    role: 'owner',
  },
]

let mockEventSeq = 1

function nextMockEventId(): string {
  return `mock-ev-${Date.now()}-${mockEventSeq++}`
}

function payloadToFeishuEvent(
  eventId: string,
  payload: CreateEventPayload,
): FeishuEvent {
  return {
    event_id: eventId,
    summary: payload.summary,
    start_time: { ...payload.start_time },
    end_time: { ...payload.end_time },
    status: 'confirmed',
    is_all_day: false,
    description: payload.description,
    app_metadata: payload.app_metadata,
  }
}

/**
 * Exchange OAuth authorization code for a user access token (OAuth 2.0).
 * Real implementation calls Feishu authen APIs with app credentials from backend.
 */
export async function getFeishuAccessToken(code: string): Promise<string> {
  try {
    const appId = import.meta.env.VITE_FEISHU_APP_ID
    const appSecret = import.meta.env.VITE_FEISHU_APP_SECRET
    if (!appId || !appSecret || appId.startsWith('请填入')) {
      await new Promise((r) => setTimeout(r, 200))
      return `mock-user-token-${code.slice(0, 8)}`
    }
    // Browser-side token exchange normally requires a backend; reserve spec URL.
    const res = await fetch('/api/feishu/open-apis/authen/v1/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        app_id: appId,
        app_secret: appSecret,
      }),
    })
    const data = (await res.json()) as {
      data?: { access_token?: string }
      msg?: string
    }
    const token = data?.data?.access_token
    if (!token) throw new Error(data?.msg ?? '飞书 access_token 获取失败')
    return token
  } catch {
    await new Promise((r) => setTimeout(r, 150))
    return `mock-user-token-${code.slice(0, 8)}`
  }
}

/**
 * List calendars visible to the authenticated user.
 */
export async function fetchCalendars(accessToken: string): Promise<FeishuCalendar[]> {
  try {
    if (!accessToken || accessToken.startsWith('mock-user-token')) {
      await new Promise((r) => setTimeout(r, 180))
      return MOCK_CALENDARS.map((c) => ({ ...c }))
    }
    const res = await fetch(
      '/api/feishu/open-apis/calendar/v4/calendars?page_size=50',
      { headers: { Authorization: `Bearer ${accessToken}` } },
    )
    if (!res.ok) throw new Error(`calendar list ${res.status}`)
    const data = (await res.json()) as {
      data?: {
        calendar_list?: Array<{
          calendar_id?: string
          summary?: string
          role?: string
        }>
      }
    }
    const raw = data?.data?.calendar_list ?? []
    const mapped: FeishuCalendar[] = raw
      .filter((c) => c.calendar_id && c.summary && c.role)
      .map((c) => ({
        calendar_id: c.calendar_id as string,
        summary: c.summary as string,
        role: c.role as FeishuCalendar['role'],
      }))
    return mapped.length ? mapped : MOCK_CALENDARS.map((x) => ({ ...x }))
  } catch {
    await new Promise((r) => setTimeout(r, 120))
    return MOCK_CALENDARS.map((c) => ({ ...c }))
  }
}

/**
 * List events on a calendar within [startTime, endTime] (ISO 8601), inclusive semantics per API.
 */
export async function fetchCalendarEvents(
  accessToken: string,
  calendarId: string,
  startTime: string,
  endTime: string,
): Promise<FeishuEvent[]> {
  try {
    if (!accessToken || accessToken.startsWith('mock-user-token')) {
      await new Promise((r) => setTimeout(r, 200))
      const startSec = Math.floor(new Date(startTime).getTime() / 1000)
      const endSec = Math.floor(new Date(endTime).getTime() / 1000)
      const mid = Math.floor((startSec + endSec) / 2)
      return [
        {
          event_id: `mock-${calendarId}-evt`,
          summary: '演示事件',
          start_time: { timestamp: String(startSec) },
          end_time: { timestamp: String(mid) },
          status: 'confirmed',
          is_all_day: false,
          description: 'Mock VitaSleep',
          app_metadata: {
            vitasleep_managed: false,
            block_type: 'work',
          },
        },
      ]
    }
    const qs = new URLSearchParams({
      page_size: '50',
      start_time: startTime,
      end_time: endTime,
    })
    const res = await fetch(
      `/api/feishu/open-apis/calendar/v4/calendars/${encodeURIComponent(calendarId)}/events?${qs}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    )
    if (!res.ok) throw new Error(`events ${res.status}`)
    const data = (await res.json()) as {
      data?: {
        items?: Array<{
          event_id?: string
          summary?: string
          start_time?: { timestamp?: string }
          end_time?: { timestamp?: string }
          status?: string
          is_all_day?: boolean
          description?: string
        }>
      }
    }
    const items = data?.data?.items ?? []
    return items
      .filter(
        (it) =>
          it.event_id &&
          it.summary &&
          it.start_time?.timestamp &&
          it.end_time?.timestamp,
      )
      .map((it) => ({
        event_id: it.event_id as string,
        summary: it.summary as string,
        start_time: { timestamp: it.start_time!.timestamp! },
        end_time: { timestamp: it.end_time!.timestamp! },
        status: (it.status === 'cancelled' || it.status === 'tentative'
          ? it.status
          : 'confirmed') as FeishuEvent['status'],
        is_all_day: !!it.is_all_day,
        description: it.description,
      }))
  } catch {
    await new Promise((r) => setTimeout(r, 100))
    return []
  }
}

/**
 * Create an event on the given calendar (e.g. VitaSleep-managed rest block).
 */
export async function createCalendarEvent(
  accessToken: string,
  calendarId: string,
  event: CreateEventPayload,
): Promise<FeishuEvent> {
  try {
    const id = nextMockEventId()
    if (!accessToken || accessToken.startsWith('mock-user-token')) {
      await new Promise((r) => setTimeout(r, 220))
      return payloadToFeishuEvent(id, event)
    }
    const res = await fetch(
      `/api/feishu/open-apis/calendar/v4/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(event),
      },
    )
    if (!res.ok) throw new Error(`create ${res.status}`)
    const data = (await res.json()) as {
      data?: { event?: Record<string, unknown> }
    }
    const raw = data?.data?.event as FeishuEvent | undefined
    if (
      raw?.event_id &&
      raw.summary &&
      raw.start_time?.timestamp &&
      raw.end_time?.timestamp
    )
      return raw
    return payloadToFeishuEvent(id, event)
  } catch {
    await new Promise((r) => setTimeout(r, 150))
    return payloadToFeishuEvent(nextMockEventId(), event)
  }
}

/**
 * Patch fields on an existing calendar event.
 */
export async function updateCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  patch: Partial<CreateEventPayload>,
): Promise<FeishuEvent> {
  try {
    if (!accessToken || accessToken.startsWith('mock-user-token')) {
      await new Promise((r) => setTimeout(r, 180))
      const base = payloadToFeishuEvent(eventId, {
        summary: patch.summary ?? '更新的事件',
        start_time: patch.start_time ?? { timestamp: String(Math.floor(Date.now() / 1000)) },
        end_time:
          patch.end_time ??
          { timestamp: String(Math.floor(Date.now() / 1000) + 900) },
        description: patch.description,
        app_metadata: patch.app_metadata,
      })
      return base
    }
    const res = await fetch(
      `/api/feishu/open-apis/calendar/v4/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(patch),
      },
    )
    if (!res.ok) throw new Error(`patch ${res.status}`)
    const data = (await res.json()) as { data?: { event?: FeishuEvent } }
    const ev = data?.data?.event
    if (ev?.event_id) return ev
    throw new Error('invalid patch response')
  } catch {
    await new Promise((r) => setTimeout(r, 120))
    return payloadToFeishuEvent(eventId, {
      summary: patch.summary ?? '更新的事件',
      start_time:
        patch.start_time ?? { timestamp: String(Math.floor(Date.now() / 1000)) },
      end_time:
        patch.end_time ??
        { timestamp: String(Math.floor(Date.now() / 1000) + 900) },
      description: patch.description,
      app_metadata: patch.app_metadata,
    })
  }
}

/**
 * Delete a calendar event by id.
 */
export async function deleteCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
): Promise<void> {
  try {
    if (!accessToken || accessToken.startsWith('mock-user-token')) {
      await new Promise((r) => setTimeout(r, 120))
      return
    }
    const res = await fetch(
      `/api/feishu/open-apis/calendar/v4/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    )
    if (!res.ok && res.status !== 404) throw new Error(`delete ${res.status}`)
  } catch {
    await new Promise((r) => setTimeout(r, 80))
  }
}
