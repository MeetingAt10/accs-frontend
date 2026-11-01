import { AnimatePresence, motion, useReducedMotion, type Variants } from 'motion/react'
import { useState, type CSSProperties } from 'react'

import { DateTile, Empty } from '@/components/app/page-shell'
import { dateParts, formatDate } from '@/lib/format'
import './EventCalendar.css'

export interface CalendarEvent {
  id: string
  date: string
  title: string
  /** Preformatted range for display, e.g. "2:00 PM–3:00 PM". */
  time?: string
  type?: string
  /** Color family, set as data-etone (academic, campus, ccs, open, consult, unavailable, org, todo). */
  tone?: string
  /** 24h "HH:MM", used to place the event in the week grid and label chips. */
  start?: string
  end?: string
  /** Date-only item (to-dos): no time on chips, shown in the all-day row of the week grid. */
  allDay?: boolean
}

export interface EventCalendarProps {
  date: string
  view: 'month' | 'week' | 'list'
  events: CalendarEvent[]
  onDateChange?: (date: string) => void
  onEventPress?: (event: CalendarEvent) => void
  label?: string
  startHour?: number
  endHour?: number
}

const DAY = 86_400_000
const ease: [number, number, number, number] = [0.16, 1, 0.3, 1]
const MAX_CHIPS = 3

function iso(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function parse(value: string) {
  const date = new Date(`${value}T12:00:00`)
  return Number.isNaN(date.getTime()) ? new Date() : date
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function mondayOf(date: Date) {
  return addDays(date, -((date.getDay() + 6) % 7))
}

function hours(value: string | undefined, fallback: number) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value ?? '')
  return match ? Number(match[1]) + Number(match[2]) / 60 : fallback
}

/** "14:00" -> "2:00 PM". */
export function formatClock(value: string | undefined) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value ?? '')
  if (!match) return value ?? ''
  const hour = Number(match[1])
  return `${hour % 12 || 12}:${match[2]} ${hour < 12 ? 'AM' : 'PM'}`
}

function hourLabel(hour: number) {
  return `${hour % 12 || 12} ${hour < 12 ? 'AM' : 'PM'}`
}

function longDay(date: Date) {
  return date.toLocaleDateString('en-PH', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function compare(a: CalendarEvent, b: CalendarEvent) {
  return (
    Number(Boolean(b.allDay)) - Number(Boolean(a.allDay)) ||
    `${a.date}${a.start ?? ''}${a.title}`.localeCompare(
      `${b.date}${b.start ?? ''}${b.title}`,
    )
  )
}

function groupByDate(events: CalendarEvent[]) {
  const map = new Map<string, CalendarEvent[]>()
  for (const event of [...events].sort(compare)) {
    const day = map.get(event.date)
    if (day) day.push(event)
    else map.set(event.date, [event])
  }
  return map
}

type Press = (event: CalendarEvent) => void

function Chip({ event, onPress }: { event: CalendarEvent; onPress?: Press }) {
  const clock = event.allDay ? '' : formatClock(event.start)
  return (
    <button
      type="button"
      className="ec-chip"
      data-etone={event.tone}
      onClick={() => onPress?.(event)}
      title={event.time ? `${event.title} · ${event.time}` : event.title}
    >
      {clock && <span className="ec-chip__time">{clock}</span>}
      <span className="ec-chip__title">{event.title}</span>
    </button>
  )
}

function AgendaRows({
  events,
  onPress,
  label,
}: {
  events: CalendarEvent[]
  onPress?: Press
  label: string
}) {
  return (
    <ol className="accs-rows ec-rows" aria-label={label}>
      {events.map((event) => (
        <li key={event.id}>
          <div className="accs-row ec-row">
            <DateTile value={event.date} />
            <button
              type="button"
              className="ec-row__main"
              onClick={() => onPress?.(event)}
            >
              <span className="accs-row__title">{event.title}</span>
              <span className="accs-row__sub">
                {[event.allDay ? 'All day' : event.time, formatDate(event.date)]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </button>
            {event.type && (
              <span className="ec-badge" data-etone={event.tone}>
                {event.type}
              </span>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}

function Month({
  date,
  events,
  label,
  onDateChange,
  onEventPress,
}: Pick<EventCalendarProps, 'date' | 'events' | 'onDateChange' | 'onEventPress'> & {
  label: string
}) {
  const [expanded, setExpanded] = useState<string>()
  const selected = parse(date)
  const first = new Date(selected.getFullYear(), selected.getMonth(), 1, 12)
  const last = new Date(selected.getFullYear(), selected.getMonth() + 1, 0, 12)
  const start = mondayOf(first)
  const weeks = Math.ceil(
    (Math.round((last.getTime() - start.getTime()) / DAY) + 1) / 7,
  )
  const monthLabel = selected.toLocaleDateString('en-PH', {
    month: 'long',
    year: 'numeric',
  })
  const today = iso(new Date())
  const byDate = groupByDate(events)
  const selectedEvents = byDate.get(date) ?? []
  const weekdays = Array.from({ length: 7 }, (_, index) =>
    addDays(start, index).toLocaleDateString('en-PH', { weekday: 'short' }),
  )

  return (
    <>
      <div className="ec-month" role="region" aria-label={`${label}, month view`}>
        <table className="ec-table" aria-label={label}>
          <caption className="ec-sr">{monthLabel}</caption>
          <thead>
            <tr>
              {weekdays.map((weekday) => (
                <th scope="col" key={weekday}>
                  {weekday}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: weeks }, (_, week) => (
              <tr key={week} style={{ '--r': week } as CSSProperties}>
                {Array.from({ length: 7 }, (_, index) => {
                  const day = addDays(start, week * 7 + index)
                  const value = iso(day)
                  const dayEvents = byDate.get(value) ?? []
                  const open = expanded === value
                  const shown = open ? dayEvents : dayEvents.slice(0, MAX_CHIPS)
                  const more = dayEvents.length - MAX_CHIPS
                  return (
                    <td
                      key={value}
                      data-today={value === today || undefined}
                      data-selected={value === date || undefined}
                      data-outside={
                        day.getMonth() !== selected.getMonth() || undefined
                      }
                    >
                      <button
                        type="button"
                        className="ec-daybtn"
                        onClick={() => onDateChange?.(value)}
                        aria-current={value === today ? 'date' : undefined}
                        aria-label={`${longDay(day)}${
                          dayEvents.length
                            ? `, ${dayEvents.length} event${dayEvents.length > 1 ? 's' : ''}`
                            : ''
                        }`}
                      >
                        <time dateTime={value}>{day.getDate()}</time>
                      </button>
                      {dayEvents.length > 0 && (
                        <ul className="ec-chips">
                          {shown.map((event) => (
                            <li key={event.id}>
                              <Chip event={event} onPress={onEventPress} />
                            </li>
                          ))}
                          {more > 0 && (
                            <li>
                              <button
                                type="button"
                                className="ec-more"
                                aria-expanded={open}
                                onClick={() => setExpanded(open ? undefined : value)}
                              >
                                {open ? 'Show less' : `+${more} more`}
                              </button>
                            </li>
                          )}
                        </ul>
                      )}
                      <span className="ec-dots" aria-hidden>
                        {dayEvents.slice(0, 3).map((event) => (
                          <i key={event.id} className="ec-dot" data-etone={event.tone} />
                        ))}
                      </span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <section className="ec-mobile-agenda" aria-label="Selected day">
        <h3 className="ec-mobile-agenda__title">
          {dateParts(date)?.weekday}, {formatDate(date)}
        </h3>
        {selectedEvents.length ? (
          <AgendaRows
            events={selectedEvents}
            onPress={onEventPress}
            label={`Events on ${formatDate(date)}`}
          />
        ) : (
          <Empty title="Nothing on this day">
            Pick another date or turn on more layers.
          </Empty>
        )}
      </section>
    </>
  )
}

interface Placed {
  event: CalendarEvent
  from: number
  to: number
  col: number
  cols: number
}

/** Side-by-side columns for overlapping events within one day. */
function place(events: CalendarEvent[], startHour: number, endHour: number) {
  const items: Placed[] = events
    .map((event) => {
      const from = Math.min(
        Math.max(hours(event.start, startHour), startHour),
        endHour - 0.5,
      )
      const to = Math.min(
        Math.max(hours(event.end, from + 1), from + 0.5),
        endHour,
      )
      return { event, from, to, col: 0, cols: 1 }
    })
    .sort((a, b) => a.from - b.from || a.to - b.to)
  let cluster: Placed[] = []
  let ends: number[] = []
  let clusterEnd = -1
  const flush = () => {
    for (const item of cluster) item.cols = ends.length
    cluster = []
    ends = []
  }
  for (const item of items) {
    if (item.from >= clusterEnd) {
      flush()
      clusterEnd = -1
    }
    let col = ends.findIndex((end) => end <= item.from)
    if (col < 0) col = ends.length
    ends[col] = item.to
    item.col = col
    cluster.push(item)
    clusterEnd = Math.max(clusterEnd, item.to)
  }
  flush()
  return items
}

function Week({
  date,
  events,
  label,
  onEventPress,
  startHour,
  endHour,
}: Pick<EventCalendarProps, 'date' | 'events' | 'onEventPress'> & {
  label: string
  startHour: number
  endHour: number
}) {
  const start = mondayOf(parse(date))
  const days = Array.from({ length: 7 }, (_, index) => addDays(start, index))
  const span = endHour - startHour
  const today = iso(new Date())
  const now = new Date()
  const nowHour = now.getHours() + now.getMinutes() / 60
  const byDate = groupByDate(events)
  const weekEvents = days.flatMap((day) => byDate.get(iso(day)) ?? [])
  const hasAllDay = weekEvents.some((event) => event.allDay)
  const marks = Array.from({ length: span }, (_, index) => startHour + index)

  return (
    <>
      <div
        className="ec-weekgrid"
        role="region"
        aria-label={`${label}, week view`}
        tabIndex={0}
      >
        <div
          className="ec-wk"
          style={{ '--ec-hours': span } as CSSProperties}
        >
          <div className="ec-wk__head">
            <span />
            {days.map((day) => (
              <div
                className="ec-wk__dayhead"
                key={iso(day)}
                data-today={iso(day) === today || undefined}
              >
                <span>
                  {day.toLocaleDateString('en-PH', { weekday: 'short' })}
                </span>
                <b>{day.getDate()}</b>
              </div>
            ))}
          </div>
          {hasAllDay && (
            <div className="ec-wk__allday">
              <span className="ec-wk__label">All day</span>
              {days.map((day) => (
                <div className="ec-wk__allcell" key={iso(day)}>
                  {(byDate.get(iso(day)) ?? [])
                    .filter((event) => event.allDay)
                    .map((event) => (
                      <Chip key={event.id} event={event} onPress={onEventPress} />
                    ))}
                </div>
              ))}
            </div>
          )}
          <div className="ec-wk__body">
            <div className="ec-wk__gutter" aria-hidden>
              {marks.map((hour) => (
                <span
                  key={hour}
                  style={{ top: `${((hour - startHour) / span) * 100}%` }}
                >
                  {hourLabel(hour)}
                </span>
              ))}
            </div>
            {days.map((day, column) => {
              const value = iso(day)
              const timed = (byDate.get(value) ?? []).filter(
                (event) => !event.allDay,
              )
              return (
                <div
                  className="ec-wk__col"
                  key={value}
                  data-today={value === today || undefined}
                >
                  {value === today && nowHour >= startHour && nowHour <= endHour && (
                    <span
                      className="ec-now"
                      aria-hidden
                      style={{ top: `${((nowHour - startHour) / span) * 100}%` }}
                    />
                  )}
                  {place(timed, startHour, endHour).map((item, index) => (
                    <button
                      type="button"
                      key={item.event.id}
                      className="ec-block"
                      data-etone={item.event.tone}
                      onClick={() => onEventPress?.(item.event)}
                      style={
                        {
                          top: `${((item.from - startHour) / span) * 100}%`,
                          height: `${((item.to - item.from) / span) * 100}%`,
                          left: `calc(${(item.col / item.cols) * 100}% + 2px)`,
                          width: `calc(${100 / item.cols}% - 4px)`,
                          animationDelay: `${column * 24 + index * 40}ms`,
                        } as CSSProperties
                      }
                    >
                      <span className="ec-block__title">{item.event.title}</span>
                      <span className="ec-block__time">
                        {item.event.time ?? formatClock(item.event.start)}
                      </span>
                    </button>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      </div>
      <div className="ec-weeklist">
        {weekEvents.length ? (
          <AgendaRows
            events={weekEvents}
            onPress={onEventPress}
            label={`${label}, events this week`}
          />
        ) : (
          <Empty title="No events this week">
            Try another week or turn on more layers.
          </Empty>
        )}
      </div>
    </>
  )
}

const variants: Variants = {
  enter: (dir: number) => ({ opacity: 0, x: dir }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: -dir }),
}

export function EventCalendar({
  date,
  view,
  events,
  onDateChange,
  onEventPress,
  label = 'Events calendar',
  startHour = 7,
  endHour = 19,
}: EventCalendarProps) {
  const reduce = useReducedMotion()
  const [track, setTrack] = useState({ date, dir: 0 })
  if (track.date !== date)
    setTrack({ date, dir: date > track.date ? 1 : -1 })
  const anchor = parse(date)
  const key =
    view === 'week'
      ? `week:${iso(mondayOf(anchor))}`
      : `${view}:${date.slice(0, 7)}`
  const monthPrefix = date.slice(0, 7)
  const monthLabel = anchor.toLocaleDateString('en-PH', {
    month: 'long',
    year: 'numeric',
  })
  const monthEvents = events
    .filter((event) => event.date.startsWith(monthPrefix))
    .sort(compare)

  return (
    <div className="ec">
      <AnimatePresence mode="wait" initial={false} custom={reduce ? 0 : track.dir * 28}>
        <motion.div
          key={key}
          custom={reduce ? 0 : track.dir * 28}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: reduce ? 0 : 0.22, ease }}
        >
          {view === 'month' && (
            <Month
              date={date}
              events={events}
              label={label}
              onDateChange={onDateChange}
              onEventPress={onEventPress}
            />
          )}
          {view === 'week' && (
            <Week
              date={date}
              events={events}
              label={label}
              onEventPress={onEventPress}
              startHour={startHour}
              endHour={endHour}
            />
          )}
          {view === 'list' &&
            (monthEvents.length ? (
              <AgendaRows
                events={monthEvents}
                onPress={onEventPress}
                label={`${label}, events for ${monthLabel}`}
              />
            ) : (
              <Empty title="No events this month">
                Try another month or turn on more layers.
              </Empty>
            ))}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
