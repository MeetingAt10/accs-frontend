import { today } from '@internationalized/date'

/** The campus time zone. Dates people pick (events, availability, when something happened) are campus dates. */
export const campusZone = 'Asia/Manila'

/** Today on campus, for date pickers' minValue and maxValue. */
export const campusToday = () => today(campusZone)

/** Now on campus as a datetime-local value ("2026-11-20T15:04"), to compare with what someone typed. */
export const campusNowLocal = () => new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 16)

/** A datetime-local value on campus that has already come. Empty is not past. */
export const isPastLocal = (value: string) => Boolean(value) && value.slice(0, 16) <= campusNowLocal()
