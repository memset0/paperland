const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]]
const format = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

/** "3 days ago" style text for an ISO time; "just now" under a minute. */
export function relativeTime(iso: string, now = Date.now()): string {
  const seconds = (new Date(iso).getTime() - now) / 1000
  for (const [unit, size] of UNITS) if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit)
  return 'just now'
}
