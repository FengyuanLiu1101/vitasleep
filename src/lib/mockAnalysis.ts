import type { Event, Issue } from '../data/mockData'
import { isRestEvent } from './zhipuClient'

const durationMinutes = (e: Event): number => {
  const [sh, sm] = e.startTime.split(':').map(Number)
  const [eh, em] = e.endTime.split(':').map(Number)
  return eh * 60 + em - (sh * 60 + sm)
}

/**
 * Local fallback analyzer used when the Zhipu API isn't available.
 *
 * Rules (mirroring the prompt in zhipuClient.ts):
 * - If energy > 80 AND the schedule already contains at least one
 *   rest-keyword event, the user is in great shape — return [].
 * - Rest-keyword events are never flagged.
 * - Energy-banded thresholds:
 *     >= 80 → never intervene
 *     50-79 → only flag flexible work events longer than 180 min
 *     30-49 → only flag flexible work events longer than 90 min
 *     < 30  → always pick the longest flexible event (proactive)
 */
export const analyzeLocally = (events: Event[], energyLevel: number): Issue[] => {
  if (events.length === 0) return []

  const hasRestEvent = events.some((e) => isRestEvent(e.title))

  // High-energy + already has restful slot → no intervention needed.
  if (energyLevel > 80 && hasRestEvent) return []
  if (energyLevel >= 80) return []

  // Eligible candidates exclude any rest-keyword events.
  const candidates = events.filter((e) => !isRestEvent(e.title))
  if (candidates.length === 0) return []

  let threshold: number
  if (energyLevel >= 50) threshold = 180
  else if (energyLevel >= 30) threshold = 90
  else threshold = 0 // proactive — flag the longest

  const eligible = candidates
    .filter((e) => e.type === 'flexible' && durationMinutes(e) > threshold)
    .sort((a, b) => durationMinutes(b) - durationMinutes(a))

  const target =
    eligible[0] ??
    (energyLevel < 30
      ? [...candidates].sort(
          (a, b) => durationMinutes(b) - durationMinutes(a),
        )[0]
      : undefined)

  if (!target) return []

  return [
    {
      eventId: target.id,
      reason: `${target.title} 持续 ${durationMinutes(target)} 分钟，结合当前 ${energyLevel}% 电量可能积累认知负荷`,
      suggestion: '在结束后插入 30 分钟代谢恢复窗口',
      insertBreakAfter: true,
      breakDuration: 30,
    },
  ]
}

/** True when the schedule is in a "good state" — surfaces a positive UI hint. */
export const isHealthySchedule = (
  events: Event[],
  energyLevel: number,
): boolean => {
  if (events.length === 0) return false
  return energyLevel > 80 && events.some((e) => isRestEvent(e.title))
}
