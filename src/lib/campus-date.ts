import { today } from '@internationalized/date'

/** The campus time zone. Dates people pick (events, availability, when something happened) are campus dates. */
export const campusZone = 'Asia/Manila'

/** Today on campus, for date pickers' minValue and maxValue. */
export const campusToday = () => today(campusZone)
