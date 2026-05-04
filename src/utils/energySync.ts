export interface EnergyPoint {
  time: string
  value: number
}

/**
 * Ensures the last point in `energyHistory` matches `currentEnergyLevel` (rounded).
 * If missing or inconsistent, appends a correction sample with the same timestamp
 * resolution as typical appends (`toISOString()`).
 */
export function assertEnergySynced(
  history: EnergyPoint[],
  current: number,
  nowIso: string = new Date().toISOString(),
): EnergyPoint[] {
  const rounded = Math.max(0, Math.min(100, Math.round(current)))
  if (history.length === 0) {
    return [{ time: nowIso, value: rounded }]
  }
  const last = history[history.length - 1]
  if (last.value === rounded) return history
  return [...history, { time: nowIso, value: rounded }]
}
