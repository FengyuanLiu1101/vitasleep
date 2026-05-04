/** Demo anchor date for single-day schedules (local ISO datetime prefix). */
export const SCHEDULE_DAY = '2026-05-04'

export function hhmmToIso(hhmm: string): string {
  return `${SCHEDULE_DAY}T${hhmm}:00`
}

export function isoToHHmm(iso: string): string {
  const d = new Date(iso)
  if (!Number.isNaN(d.getTime())) {
    const h = d.getHours().toString().padStart(2, '0')
    const m = d.getMinutes().toString().padStart(2, '0')
    return `${h}:${m}`
  }
  if (/^\d{2}:\d{2}$/.test(iso)) return iso
  return '12:00'
}

export function parseInstant(iso: string): Date {
  const d = new Date(iso)
  if (!Number.isNaN(d.getTime())) return d
  return new Date(`${SCHEDULE_DAY}T${iso}:00`)
}

export function durationMinutesIso(startIso: string, endIso: string): number {
  return Math.round(
    (parseInstant(endIso).getTime() - parseInstant(startIso).getTime()) / 60000,
  )
}

export function addMinutesIso(iso: string, mins: number): string {
  const t = parseInstant(iso).getTime() + mins * 60000
  const d = new Date(t)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`
}
