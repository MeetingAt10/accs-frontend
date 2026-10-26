import { Button, ViewState } from '@meetingat10/design-system/react'
import type { ReactNode } from 'react'

import './EventCalendar.css'

export interface CalendarEvent {
  id: string
  date: string
  title: string
  time?: string
  type?: string
  lane?: 'schedule' | 'community' | 'consult'
}

export interface EventCalendarProps {
  date: string
  view: 'month' | 'list'
  events: CalendarEvent[]
  onDateChange?: (date: string) => void
  onEventPress?: (event: CalendarEvent) => void
  renderEvent?: (event: CalendarEvent) => ReactNode
  label?: string
}

function isoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function EventCalendar({
  date,
  view,
  events,
  onDateChange,
  onEventPress,
  renderEvent,
  label = 'Events calendar',
}: EventCalendarProps) {
  const selectedDate = new Date(`${date}T12:00:00`)
  const start = new Date(
    selectedDate.getFullYear(),
    selectedDate.getMonth(),
    1,
    12,
  )
  const month = isoDate(start).slice(0, 7)
  const monthEvents = events
    .filter((event) => event.date.startsWith(month))
    .sort((a, b) =>
      `${a.date}${a.time ?? ''}`.localeCompare(`${b.date}${b.time ?? ''}`),
    )
  const today = isoDate(new Date())

  function eventControl(event: CalendarEvent) {
    return renderEvent ? (
      renderEvent(event)
    ) : (
      <Button
        size="sm"
        variant="tertiary"
        onPress={() => onEventPress?.(event)}
        className="ds-next-event-calendar__event"
      >
        {event.time && <span>{event.time}</span>}
        <span>{event.title}</span>
      </Button>
    )
  }

  if (view === 'list') {
    return monthEvents.length ? (
      <ol className="ds-next-event-calendar-list" aria-label={label}>
        {monthEvents.map((event) => (
          <li key={event.id} className="ds-next-event-calendar-list__item">
            <time dateTime={event.date}>
              {new Date(`${event.date}T12:00:00`).toLocaleDateString('en-PH', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
              })}
            </time>
            <div>
              {eventControl(event)}
              {event.type && <p>{event.type}</p>}
            </div>
          </li>
        ))}
      </ol>
    ) : (
      <ViewState
        kind="empty"
        title="No events in this month"
        description="Change the date or calendar layers to see other permitted events."
      />
    )
  }

  const firstDay = new Date(start)
  firstDay.setDate(firstDay.getDate() - firstDay.getDay())
  const days = Array.from({ length: 42 }, (_, index) => {
    const day = new Date(firstDay)
    day.setDate(day.getDate() + index)
    return day
  })

  return (
    <div className="ds-next-event-calendar-wrap">
      <table className="ds-next-event-calendar" aria-label={label}>
        <caption>
          {selectedDate.toLocaleDateString('en-PH', {
            month: 'long',
            year: 'numeric',
          })}
        </caption>
        <thead>
          <tr>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(
              (weekday) => (
                <th scope="col" key={weekday}>
                  {weekday}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 6 }, (_, week) => (
            <tr key={week}>
              {days.slice(week * 7, week * 7 + 7).map((day) => {
                const value = isoDate(day)
                const dayEvents = events.filter((event) => event.date === value)
                return (
                  <td
                    key={value}
                    className={
                      day.getMonth() === selectedDate.getMonth()
                        ? undefined
                        : 'ds-next-event-calendar__outside'
                    }
                  >
                    <Button
                      variant="tertiary"
                      size="sm"
                      onPress={() => onDateChange?.(value)}
                      aria-current={value === today ? 'date' : undefined}
                      aria-label={day.toLocaleDateString('en-PH', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    >
                      <time dateTime={value}>{day.getDate()}</time>
                    </Button>
                    <ul className="ds-next-event-calendar__events">
                      {dayEvents.map((event) => (
                        <li key={event.id} data-lane={event.lane}>
                          {eventControl(event)}
                        </li>
                      ))}
                    </ul>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
