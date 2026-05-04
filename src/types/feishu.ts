export interface FeishuCalendar {
  calendar_id: string
  summary: string
  role: 'owner' | 'writer' | 'reader'
}

export interface FeishuEvent {
  event_id: string
  summary: string
  start_time: { timestamp: string }
  end_time: { timestamp: string }
  status: 'confirmed' | 'tentative' | 'cancelled'
  is_all_day: boolean
  description?: string
  app_metadata?: { vitasleep_managed: boolean; block_type: 'rest' | 'work' }
}

export interface CreateEventPayload {
  summary: string
  start_time: { timestamp: string }
  end_time: { timestamp: string }
  description?: string
  app_metadata?: FeishuEvent['app_metadata']
}
