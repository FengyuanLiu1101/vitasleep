import type { Issue } from '../data/mockData'
import {
  fallbackMockAnalysis,
  getMockAnalysis,
  type MockAnalysis,
  type ScenarioId,
} from '../data/mockAnalysis'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export const ZHIPU_TIMEOUT_MS = 15_000

const SESSION_KEY = 'zhipu_api_key_session'
const PERSIST_KEY = 'zhipu_api_key'

export const readZhipuApiKey = (): string | null => {
  try {
    const sess = sessionStorage.getItem(SESSION_KEY)
    if (sess) return sess
  } catch {
    // ignore
  }
  try {
    const persisted = localStorage.getItem(PERSIST_KEY)
    if (persisted) return persisted
  } catch {
    // ignore
  }
  return import.meta.env.VITE_ZHIPU_API_KEY || null
}

const callZhipu = async (
  messages: ChatMessage[],
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<string> => {
  const apiKey = readZhipuApiKey()
  if (!apiKey || apiKey.startsWith('请填入')) {
    throw new Error('请先在用户面板中填入智谱 API Key')
  }

  // Combine an internal timeout with any caller-provided signal.
  const timeoutMs = options.timeoutMs ?? ZHIPU_TIMEOUT_MS
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs)
  if (options.signal) {
    if (options.signal.aborted) controller.abort()
    else options.signal.addEventListener('abort', () => controller.abort())
  }

  try {
    const res = await fetch('/api/zhipu/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'glm-4-flash',
        messages,
        stream: false,
      }),
      signal: controller.signal,
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`智谱接口错误 ${res.status}：${text.slice(0, 200)}`)
    }
    const data = await res.json()
    const content: string | undefined = data?.choices?.[0]?.message?.content
    if (!content) throw new Error('智谱接口返回为空')
    return content
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') {
      throw new Error(`智谱接口超时（>${Math.round(timeoutMs / 1000)}s）`)
    }
    throw e
  } finally {
    window.clearTimeout(timeoutId)
  }
}

export default callZhipu

/**
 * Strip ```json ... ``` style fences and parse JSON safely.
 * Returns null on failure.
 */
export function tryParseJson<T = unknown>(raw: string): T | null {
  if (!raw) return null
  let text = raw.trim()
  // 1. Strip a fenced code block first.
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenceMatch) text = fenceMatch[1].trim()
  // 2. Slice from the first { to the last } — be permissive about prose
  //    around the JSON object (the model occasionally writes "Sure, here...").
  const firstBrace = text.indexOf('{')
  const lastBrace = text.lastIndexOf('}')
  if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) return null
  const jsonSlice = text.slice(firstBrace, lastBrace + 1)
  try {
    return JSON.parse(jsonSlice) as T
  } catch {
    // Last resort: regex out a balanced-ish object literal.
    const m = jsonSlice.match(/\{[\s\S]*\}/)
    if (!m) return null
    try {
      return JSON.parse(m[0]) as T
    } catch {
      return null
    }
  }
}

/** Keywords that mark an event as restorative — never to be flagged. */
export const REST_KEYWORDS = [
  '睡觉',
  '睡眠',
  '小睡',
  '午休',
  '休息',
  '茶歇',
  '散步',
  '运动',
  '锻炼',
  '吃饭',
  '用餐',
  '早饭',
  '早餐',
  '午饭',
  '午餐',
  '晚饭',
  '晚餐',
  '聚餐',
  '咖啡',
  '冥想',
]

export const isRestEvent = (title: string): boolean => {
  if (!title) return false
  return REST_KEYWORDS.some((kw) => title.includes(kw))
}

/** Describe the user's current energy level as a band with intervention rules. */
const describeEnergyBand = (energyLevel: number): string => {
  if (energyLevel >= 80) {
    return `当前身体电量 ${energyLevel}%（高位区间，状态极佳）。
此区间不需要任何干预，请直接返回 {"issues": []}，绝对不要标红任何事件。`
  }
  if (energyLevel >= 50) {
    return `当前身体电量 ${energyLevel}%（中位区间，良好）。
仅当某项专注/工作类事件持续时间严格超过 180 分钟（3 小时）时才允许标红一次；
持续时间 ≤ 180 分钟的事件一律不要标红。`
  }
  if (energyLevel >= 30) {
    return `当前身体电量 ${energyLevel}%（偏低区间）。
仅当某项专注/工作类事件持续时间严格超过 90 分钟（1.5 小时）时才允许标红；
短于此阈值的事件不要标红。`
  }
  return `当前身体电量 ${energyLevel}%（危险区间，过低）。
应主动干预：识别最长的弹性事件（>= 60 分钟）并在其后插入 30 分钟恢复休息块。
若没有任何弹性事件，则返回 {"issues": []}。`
}

/**
 * Build the schedule-analysis (scenario A) prompt.
 * Adds rest-keyword exclusion, banded energy interpretation, and an explicit
 * "do not force issues when schedule is reasonable" clause.
 */
export const buildAnalyzePrompt = (
  events: Array<{
    id: string
    title: string
    startTime: string
    endTime: string
    type: string
  }>,
  energyLevel: number,
): string => {
  const restKwList = REST_KEYWORDS.join('、')
  return `你是一个健康日程助手。以下是用户今天的日程（JSON格式）：
${JSON.stringify(events)}

不干预条件（务必严格遵守，违反则视为错误输出）：
1. 凡事件标题中包含以下任一关键词的事件都属于恢复型活动，**绝对不要标红**：${restKwList}。
2. 当日程中已存在上述恢复型事件的时段，视为用户已自行安排休息，不需要再额外建议休息。
3. 短于电量阈值（见下文）的事件，即使是高强度工作也不要标红。
4. type=fixed 的事件不可修改，不要建议调整其开始/结束时间，只能在其前后插入休息块。
5. 当日程整体合理（电量充足 / 已有休息 / 单段时长在阈值内）时，**必须直接返回 {"issues": []}**，
   不要为了"找问题"而强行标红任何事件。

身体电量评估与干预阈值：
${describeEnergyBand(energyLevel)}

请基于以上规则分析哪些时间段存在连续工作风险，返回如下严格 JSON，**不要返回任何其他文字、Markdown 或代码块**：
{
  "issues": [
    {
      "eventId": "事件ID（必须是上面 JSON 中存在的 id）",
      "reason": "问题原因，一句话中文",
      "suggestion": "建议，一句话中文",
      "insertBreakAfter": true,
      "breakDuration": 30
    }
  ]
}

风格要求：每次分析使用不同的表达方式描述问题和建议，避免重复句式。
可从能量管理、认知负荷、生理节律、专注力保护、疲劳预防等角度切入。

随机种子：${Date.now()}`
}

export interface AnalyzeResult {
  issues: Issue[]
  source: 'zhipu' | 'mock-scenario' | 'mock-fallback'
  summary?: string
  hint?: string
  /** Present when fallback was triggered. */
  error?: string
}

/**
 * High-level analysis helper.
 *
 * - Calls Zhipu with a 15s timeout.
 * - Falls back to scenario mock fixtures when:
 *   - demoMode is true,
 *   - no API key is configured,
 *   - the request times out / errors,
 *   - the response cannot be parsed as JSON.
 */
export const analyzeWithZhipu = async (params: {
  events: Array<{
    id: string
    title: string
    startTime: string
    endTime: string
    type: string
  }>
  energyLevel: number
  scenario: ScenarioId
  demoMode: boolean
  signal?: AbortSignal
}): Promise<AnalyzeResult> => {
  const { events, energyLevel, scenario, demoMode, signal } = params

  const mockResult = (error?: string): AnalyzeResult => {
    const fixture: MockAnalysis | null = getMockAnalysis(scenario)
    if (fixture) {
      return {
        issues: fixture.issues,
        summary: fixture.summary,
        hint: fixture.hint,
        source: 'mock-scenario',
        error,
      }
    }
    return {
      issues: fallbackMockAnalysis.issues,
      summary: fallbackMockAnalysis.summary,
      hint: fallbackMockAnalysis.hint,
      source: 'mock-fallback',
      error,
    }
  }

  if (demoMode) return mockResult()
  if (!readZhipuApiKey()) return mockResult('未配置智谱 API Key')

  try {
    const prompt = buildAnalyzePrompt(events, energyLevel)
    const raw = await callZhipu([{ role: 'user', content: prompt }], { signal })
    const parsed = tryParseJson<{ issues?: Issue[] }>(raw)
    if (!parsed || !Array.isArray(parsed.issues)) {
      return mockResult('智谱返回无法解析为 JSON')
    }
    // Filter out issues pointing at non-existent events.
    const validIds = new Set(events.map((e) => e.id))
    const issues = parsed.issues.filter(
      (i): i is Issue =>
        !!i &&
        typeof i.eventId === 'string' &&
        validIds.has(i.eventId) &&
        typeof i.reason === 'string' &&
        typeof i.suggestion === 'string',
    )
    return { issues, source: 'zhipu' }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return mockResult(msg)
  }
}
