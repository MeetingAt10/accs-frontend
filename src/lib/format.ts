// Display formatting shared by every page. Never render raw ISO strings.

const locale = 'en-PH'
const tz = 'Asia/Manila'

function toDate(value: unknown): Date | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined
  // A bare YYYY-MM-DD is a calendar date, not midnight UTC.
  const date = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(value + 'T00:00:00+08:00') : new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

/** "Nov 5, 2026". Returns the input unchanged when it is not a date. */
export function formatDate(value: unknown, fallback = '—') {
  const date = toDate(value)
  if (!date) return typeof value === 'string' && value ? value : fallback
  return date.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric', timeZone: tz })
}

/** "Nov 5, 2026, 2:00 PM". */
export function formatDateTime(value: unknown, fallback = '—') {
  const date = toDate(value)
  if (!date) return typeof value === 'string' && value ? value : fallback
  return date.toLocaleString(locale, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: tz })
}

/** "3h ago", "in 2 days", falls back to formatDate beyond 30 days. */
export function relativeTime(value: unknown, now = Date.now()) {
  const date = toDate(value)
  if (!date) return typeof value === 'string' ? value : ''
  const diff = date.getTime() - now
  const abs = Math.abs(diff)
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const minute = 60_000, hour = 60 * minute, day = 24 * hour
  if (abs < hour) return rtf.format(Math.round(diff / minute), 'minute')
  if (abs < day) return rtf.format(Math.round(diff / hour), 'hour')
  if (abs < 30 * day) return rtf.format(Math.round(diff / day), 'day')
  return formatDate(value)
}

/** Parts for the calendar date tile: { month: 'NOV', day: '5' }. */
export function dateParts(value: unknown) {
  const date = toDate(value)
  if (!date) return undefined
  return {
    month: date.toLocaleDateString(locale, { month: 'short', timeZone: tz }),
    day: date.toLocaleDateString(locale, { day: 'numeric', timeZone: tz }),
    weekday: date.toLocaleDateString(locale, { weekday: 'short', timeZone: tz }),
  }
}

/** "Mira Solis" -> "MS". */
export function initials(name: string) {
  return name
    .replace(/^(Prof\.|Dr\.)\s+/, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('')
}
