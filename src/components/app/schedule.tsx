import {
  Agenda,
  AgendaItem,
  Alert,
  Badge,
  Breadcrumbs,
  Button,
  CaseTimeline,
  Cell,
  Checkbox,
  Column,
  ConsultationSlotPicker,
  DatePicker,
  Drawer,
  EmptyState,
  Grid,
  IconButton,
  Link,
  Modal,
  ModalActions,
  ModalBody,
  Pagination,
  Popover,
  PrivacyNotice,
  Radio,
  RadioGroup,
  Row,
  Search,
  SectionHeader,
  Segment,
  SegmentedControl,
  Select,
  SelectOption,
  Tab,
  TabList,
  TabPanel,
  Table,
  TableBody,
  TableHeader,
  TableRow,
  Tabs,
  Tag,
  TagGroup,
  TextArea,
  TextField,
  TimeBlock,
  Timetable,
  ViewState,
  toast,
  type BadgeForm,
  type BadgeTone,
  type BlockForm,
  type CaseEvent,
  type TimetableDay,
  type TimetableEvent,
} from '@meetingat10/design-system/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter, useRouterState } from '@tanstack/react-router'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'

import { RestrictedView } from '@/components/app/guards'
import {
  EventCalendar,
  PersonCard,
  ProfileHeader,
  type CalendarEvent,
} from '@/components/ds-next'
import {
  ApiError,
  performPageAction,
  type PageAction,
  type PageEnvelope,
  type Session,
} from '@/lib/api'
import { pageQuery, sessionQuery } from '@/lib/queries'
import './schedule.css'

interface Person {
  id: string
  name: string
  email?: string
  roles?: string[]
  title?: string
  office?: string
  nextSlot?: Slot
}

interface Slot {
  id: string
  facultyId: string
  date: string
  start: string
  end: string
  state: 'open' | 'requested' | 'booked' | 'unavailable'
}

type ConsultationStatus =
  'Requested' | 'Approved' | 'Booked' | 'Completed' | 'Declined' | 'Cancelled'

interface Consultation {
  id: string
  studentId: string
  facultyId: string
  slotId: string
  purpose: string
  status: ConsultationStatus
  createdAt: string
  updatedAt: string
  student: Person
  faculty: Person
  slot: Slot
  history: Array<{
    at: string
    status: ConsultationStatus
    note: string
    actorId: string
  }>
}

interface InstitutionalEvent {
  id: string
  title: string
  date: string
  start: string
  end?: string
  type: string
  description: string
  contactId?: string
  location?: string
  place?: string
  eventPlace?: string
  contact?: string
  organizationId?: string
}

interface Todo {
  id: string
  title: string
  date: string
  done: boolean
}

interface CalendarEntry extends CalendarEvent {
  layer: string
  start: string
  end: string
  description?: string
  contactId?: string
  contact?: string
  place?: string
  form?: BlockForm
  slot?: Slot
  todo?: Todo
  consultation?: Consultation
}

const statusForms: Record<ConsultationStatus, BadgeForm> = {
  Requested: 'pending',
  Approved: 'pending',
  Booked: 'solid',
  Completed: 'solid',
  Declined: 'closed',
  Cancelled: 'closed',
}

const statusTones: Record<ConsultationStatus, BadgeTone> = {
  Requested: 'warning',
  Approved: 'info',
  Booked: 'info',
  Completed: 'success',
  Declined: 'neutral',
  Cancelled: 'neutral',
}

function list<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

function record<T>(value: unknown): T | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as T)
    : undefined
}

function isoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function today() {
  return isoDate(new Date())
}

function parseDate(value: string) {
  const date = new Date(`${value}T12:00:00`)
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(date.getTime())
    ? date
    : new Date(`${today()}T12:00:00`)
}

function addDays(value: string, days: number) {
  const date = parseDate(value)
  date.setDate(date.getDate() + days)
  return isoDate(date)
}

function weekStart(value: string) {
  const date = parseDate(value)
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7))
  return isoDate(date)
}

function weekDays(value: string): TimetableDay[] {
  const start = weekStart(value)
  return Array.from({ length: 7 }, (_, index) => {
    const id = addDays(start, index)
    const date = parseDate(id)
    return {
      id,
      label: date.toLocaleDateString('en-PH', { weekday: 'short' }),
      date: String(date.getDate()),
      fullLabel: date.toLocaleDateString('en-PH', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }),
      isToday: id === today(),
    }
  })
}

function decimalTime(value: string, fallback: number) {
  if (!/^\d{2}:\d{2}$/.test(value)) return fallback
  const [hour, minute] = value.split(':').map(Number)
  return hour + minute / 60
}

function displayDate(value: string | undefined, withTime = false) {
  if (!value) return '—'
  const date = new Date(value.includes('T') ? value : `${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return withTime
    ? date.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })
    : date.toLocaleDateString('en-PH', { dateStyle: 'medium' })
}

function slotTime(slot: Slot) {
  return `${displayDate(slot.date)} · ${slot.start}–${slot.end}`
}

function slotForm(slot: Slot): BlockForm {
  return slot.state === 'open'
    ? 'open'
    : slot.state === 'unavailable'
      ? 'disabled'
      : slot.state === 'requested'
        ? 'pending'
        : 'taken'
}

function useScheduleAction(pageId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (action: PageAction) => performPageAction(pageId, action),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['page'] })
      toast(result.message, { tone: 'success' })
    },
  })
}

function ActionError({
  error,
  title = "The change couldn't be saved",
}: {
  error: unknown
  title?: string
}) {
  return error ? (
    <Alert tone="danger" title={title}>
      {error instanceof Error
        ? error.message
        : 'Try again. Your entered text is kept.'}
    </Alert>
  ) : null
}

function Heading({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <SectionHeader
      level={1}
      split
      title={title}
      description={description}
      actions={
        <Row gap={8}>
          <Badge outline marker={false}>
            Sample data
          </Badge>
          {actions}
        </Row>
      }
    />
  )
}

function StatusBadge({ status }: { status: ConsultationStatus }) {
  return (
    <Badge form={statusForms[status]} tone={statusTones[status]}>
      {status}
    </Badge>
  )
}

function useCalendarLocation() {
  const router = useRouter()
  const location = useRouterState({ select: (state) => state.location })
  const params = new URLSearchParams(location.searchStr)
  function update(values: Record<string, string>) {
    const next = new URLSearchParams(location.searchStr)
    for (const [key, value] of Object.entries(values)) next.set(key, value)
    router.history.push(`${location.pathname}?${next.toString()}`)
  }
  return { params, update }
}

function useSmallScreen() {
  const [small, setSmall] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(max-width: 767px)').matches,
  )
  useEffect(() => {
    const query = window.matchMedia('(max-width: 767px)')
    const change = () => setSmall(query.matches)
    query.addEventListener('change', change)
    return () => query.removeEventListener('change', change)
  }, [])
  return small
}

function CalendarPage({
  page,
  session,
}: {
  page: PageEnvelope
  session: Session
}) {
  const { params, update } = useCalendarLocation()
  const small = useSmallScreen()
  const action = useScheduleAction('P13')
  const [selectedEntry, setSelectedEntry] = useState<CalendarEntry>()
  const [todoOpen, setTodoOpen] = useState(false)
  const [todoTitle, setTodoTitle] = useState('')
  const [todoDate, setTodoDate] = useState('')
  const [todoError, setTodoError] = useState('')
  const selectedDate = isoDate(parseDate(params.get('date') ?? today()))
  const view = ['month', 'week', 'list'].includes(params.get('view') ?? '')
    ? (params.get('view') as 'month' | 'week' | 'list')
    : 'month'
  const organization = session.user.roles.includes('organization')
  const canTodo = session.permissions.includes('todo.manage')
  const professor = session.permissions.includes('consultation.decide')
  const activeConsultations = list<Consultation>(
    page.data.consultations,
  ).filter((consultation) =>
    ['Approved', 'Booked'].includes(consultation.status),
  )
  const layers = organization
    ? [
        { id: 'ccs', label: 'CCS events' },
        { id: 'organization', label: 'Our organization' },
      ]
    : [
        { id: 'academic', label: 'Academic year' },
        { id: 'campus', label: 'Campus' },
        { id: 'ccs', label: 'CCS events' },
        { id: 'faculty', label: 'Faculty availability' },
        ...(professor
          ? [{ id: 'consultations', label: 'My consultations' }]
          : []),
        ...(canTodo ? [{ id: 'todos', label: 'My to-dos' }] : []),
      ]
  const selectedLayers = params.has('layers')
    ? (params.get('layers') ?? '').split(',')
    : layers.map((layer) => layer.id)
  const entries: CalendarEntry[] = [
    ...list<InstitutionalEvent>(page.data.events).map((event) => ({
      id: `event:${event.id}`,
      title: event.title,
      date: event.date,
      start: event.start,
      end: event.end ?? event.start,
      time: event.end ? `${event.start}–${event.end}` : event.start,
      type: event.type,
      layer: event.organizationId
        ? 'organization'
        : event.type.toLowerCase().includes('academic')
          ? 'academic'
          : event.type.toLowerCase().includes('campus')
            ? 'campus'
            : 'ccs',
      lane: event.organizationId
        ? ('community' as const)
        : ('schedule' as const),
      description: event.description,
      contactId: event.contactId,
      place: event.location ?? event.place ?? event.eventPlace,
      contact: event.contact,
    })),
    ...list<Slot>(page.data.slots)
      .filter(
        (slot) =>
          !activeConsultations.some(
            (consultation) => consultation.slotId === slot.id,
          ),
      )
      .map((slot) => ({
        id: `slot:${slot.id}`,
        title:
          slot.facultyId === session.user.id
            ? 'My availability'
            : 'Faculty availability',
        date: slot.date,
        start: slot.start,
        end: slot.end,
        time: `${slot.start}–${slot.end}`,
        type:
          slot.state === 'open'
            ? 'Open time'
            : slot.state === 'unavailable'
              ? 'Unavailable'
              : 'Requested or booked',
        layer: 'faculty',
        lane: 'consult' as const,
        form: slotForm(slot),
        contactId: slot.facultyId,
        slot,
      })),
    ...list<Todo>(page.data.todos).map((todo) => ({
      id: `todo:${todo.id}`,
      title: todo.title,
      date: todo.date,
      start: '08:00',
      end: '09:00',
      time: todo.done ? 'Completed' : 'Due today',
      type: 'Personal to-do',
      layer: 'todos',
      lane: 'schedule' as const,
      todo,
    })),
    ...activeConsultations.map((consultation) => ({
      id: `consultation:${consultation.id}`,
      title:
        session.user.id === consultation.facultyId
          ? `Consultation with ${consultation.student.name}`
          : `Consultation with ${consultation.faculty.name}`,
      date: consultation.slot.date,
      start: consultation.slot.start,
      end: consultation.slot.end,
      time: `${consultation.slot.start}–${consultation.slot.end}`,
      type: consultation.status,
      layer: professor ? 'consultations' : 'faculty',
      lane: 'consult' as const,
      form:
        consultation.status === 'Booked'
          ? ('taken' as const)
          : ('pending' as const),
      consultation,
    })),
  ].filter((entry) => selectedLayers.includes(entry.layer))
  const days = weekDays(selectedDate)
  const weekEntries = entries
    .filter((entry) => days.some((day) => day.id === entry.date))
    .sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`))
  const weekEventDays = days
    .map((day) => ({
      day,
      events: weekEntries.filter((entry) => entry.date === day.id),
    }))
    .filter(({ events }) => events.length)
  const weekEvents: TimetableEvent[] = weekEntries
    .map((entry) => ({
      id: entry.id,
      day: entry.date,
      start: decimalTime(entry.start, 8),
      end: Math.max(
        decimalTime(entry.end, 9),
        decimalTime(entry.start, 8) + 0.5,
      ),
      title: entry.title,
      time: entry.time,
      lane: entry.lane,
      form: entry.form,
      stateLabel: entry.type,
      onPress: () => setSelectedEntry(entry),
    }))

  function shift(direction: number) {
    const date = parseDate(selectedDate)
    if (view === 'week') date.setDate(date.getDate() + direction * 7)
    else {
      date.setDate(1)
      date.setMonth(date.getMonth() + direction)
    }
    update({ date: isoDate(date) })
  }

  async function saveTodo(event: FormEvent) {
    event.preventDefault()
    if (!todoTitle.trim() || !todoDate) {
      setTodoError('Enter a title and due date.')
      return
    }
    try {
      await action.mutateAsync({
        action: 'createTodo',
        payload: { title: todoTitle.trim(), date: todoDate },
      })
      setTodoOpen(false)
      setTodoTitle('')
      setTodoDate('')
      setTodoError('')
    } catch {
      // Keep the entered to-do for another attempt.
    }
  }

  function entryDetails(entry: CalendarEntry) {
    return (
      <div className="app-page">
        <Row gap={8}>
          <Badge outline>{entry.type}</Badge>
          <time dateTime={entry.date}>
            {displayDate(entry.date)} · {entry.time}
          </time>
        </Row>
        {entry.description && <p>{entry.description}</p>}
        {entry.place && <p>Place: {entry.place}</p>}
        {entry.contact && <p>Contact: {entry.contact}</p>}
        {entry.contactId && (
          <Link href={`/people/${encodeURIComponent(entry.contactId)}`}>
            View contact profile
          </Link>
        )}
        {entry.slot &&
          session.permissions.includes('consultation.request') &&
          entry.slot.state === 'open' && (
            <Button
              href={`/consultations/faculty/${encodeURIComponent(entry.slot.facultyId)}`}
            >
              Request this time
            </Button>
          )}
        {entry.slot && entry.slot.state !== 'open' && (
          <Alert tone="neutral" title="This time is not open">
            Unavailable, requested, and booked times cannot be requested.
          </Alert>
        )}
        {entry.consultation && (
          <Link
            href={`/consultations/requests/${encodeURIComponent(entry.consultation.id)}`}
          >
            Open consultation request
          </Link>
        )}
        {entry.todo && canTodo && (
          <>
            <Checkbox
              isSelected={entry.todo.done}
              onChange={(done) =>
                action.mutate(
                  {
                    action: 'toggleTodo',
                    recordId: entry.todo!.id,
                    payload: { done },
                  },
                  { onSuccess: () => setSelectedEntry(undefined) },
                )
              }
            >
              Completed
            </Checkbox>
            <Button
              variant="destructive"
              onPress={() =>
                action.mutate(
                  {
                    action: 'deleteTodo',
                    recordId: entry.todo!.id,
                    payload: {},
                  },
                  { onSuccess: () => setSelectedEntry(undefined) },
                )
              }
            >
              Delete to-do
            </Button>
          </>
        )}
        <ActionError error={action.error} />
      </div>
    )
  }

  function renderCalendarEvent(event: CalendarEvent) {
    const entry = entries.find((candidate) => candidate.id === event.id)!
    const trigger = (
      <Button
        size="sm"
        variant="tertiary"
        className="schedule-calendar-event"
        onPress={small ? () => setSelectedEntry(entry) : undefined}
      >
        {event.time && <span>{event.time}</span>}
        <span>{event.title}</span>
      </Button>
    )
    return small ? (
      trigger
    ) : (
      <Popover trigger={trigger} title={entry.title}>
        {entryDetails(entry)}
      </Popover>
    )
  }

  return (
    <>
      <Heading
        title="Calendar"
        description="Local campus time · events in your permitted calendars"
        actions={
          <>
            {canTodo && (
              <Button icon="plus" onPress={() => setTodoOpen(true)}>
                Add to-do
              </Button>
            )}
            {professor && (
              <Button variant="secondary" href="/consultations/availability">
                Manage availability
              </Button>
            )}
          </>
        }
      />
      <Row justify="between">
        <SegmentedControl
          aria-label="Calendar view"
          selectedKey={view}
          onSelectionChange={(key) => update({ view: String(key) })}
        >
          <Segment id="month">Month</Segment>
          <Segment id="week">Week</Segment>
          <Segment id="list">List</Segment>
        </SegmentedControl>
        <Row gap={8}>
          <IconButton
            icon="caret-left"
            label="Previous"
            onPress={() => shift(-1)}
          />
          <Button variant="tertiary" onPress={() => update({ date: today() })}>
            Today
          </Button>
          <IconButton
            icon="caret-right"
            label="Next"
            onPress={() => shift(1)}
          />
        </Row>
      </Row>
      <TagGroup
        label="Show"
        selectionMode="multiple"
        selectedKeys={new Set(selectedLayers)}
        onSelectionChange={(keys) =>
          update({
            layers:
              keys === 'all'
                ? layers.map((layer) => layer.id).join(',')
                : [...keys].map(String).join(',') || 'none',
          })
        }
      >
        {layers.map((layer) => (
          <Tag
            id={layer.id}
            key={layer.id}
            lane={
              layer.id === 'faculty' || layer.id === 'consultations'
                ? 'consult'
                : layer.id === 'organization'
                  ? 'community'
                  : undefined
            }
          >
            {layer.label}
          </Tag>
        ))}
      </TagGroup>
      {view === 'week' ? (
        <>
          <SectionHeader
            level={2}
            title={`Week of ${displayDate(weekStart(selectedDate))}`}
          />
          {small ? (
            weekEventDays.length ? (
              <div
                className="schedule-week-list"
                role="region"
                aria-label="Calendar week events"
              >
                {weekEventDays.map(({ day, events }) => (
                  <section className="schedule-week-list__day" key={day.id}>
                    <h3>
                      <time dateTime={day.id}>
                        {parseDate(day.id).toLocaleDateString('en-PH', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </time>
                    </h3>
                    <ul className="schedule-week-list__events">
                      {events.map((entry) => (
                        <li key={entry.id}>
                          {renderCalendarEvent(entry)}
                          {entry.type && <p>{entry.type}</p>}
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            ) : (
              <ViewState
                kind="empty"
                title="No events in this week"
                description="No events are substituted from a different date or layer."
              />
            )
          ) : (
            <>
              <Timetable
                label="Calendar week, local campus time"
                days={days}
                events={weekEvents}
                startHour={7}
                endHour={19}
              />
              {!weekEvents.length && (
                <ViewState
                  kind="empty"
                  title="No events in this week"
                  description="No events are substituted from a different date or layer."
                />
              )}
            </>
          )}
        </>
      ) : (
        <EventCalendar
          date={selectedDate}
          view={view}
          events={entries}
          onDateChange={(date) => update({ date })}
          renderEvent={renderCalendarEvent}
        />
      )}
      <ActionError error={action.error} />
      <Drawer
        title={selectedEntry?.title ?? 'Event details'}
        side={small ? 'bottom' : 'end'}
        isOpen={Boolean(selectedEntry)}
        onOpenChange={(open) => {
          if (!open) setSelectedEntry(undefined)
        }}
      >
        {selectedEntry && entryDetails(selectedEntry)}
      </Drawer>
      <Modal title="Add to-do" isOpen={todoOpen} onOpenChange={setTodoOpen}>
        <form onSubmit={saveTodo}>
          <ModalBody>
            <div className="app-page">
              <TextField
                label="To-do"
                value={todoTitle}
                onChange={setTodoTitle}
                maxLength={200}
                isRequired
              />
              <DatePicker
                label="Due"
                isRequired
                onChange={(value) => setTodoDate(value?.toString() ?? '')}
              />
              <PrivacyNotice title="Personal to-do">
                Only you can see your to-dos.
              </PrivacyNotice>
              {todoError && (
                <Alert tone="danger" title="Check the to-do">
                  {todoError}
                </Alert>
              )}
              <ActionError error={action.error} />
            </div>
          </ModalBody>
          <ModalActions>
            <Button variant="secondary" onPress={() => setTodoOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={action.isPending}>
              Add to-do
            </Button>
          </ModalActions>
        </form>
      </Modal>
    </>
  )
}

function ConsultationTable({
  consultations,
  facultyView = false,
}: {
  consultations: Consultation[]
  facultyView?: boolean
}) {
  const [page, setPage] = useState(1)
  const pageCount = Math.max(1, Math.ceil(consultations.length / 20))
  const current = Math.min(page, pageCount)
  return consultations.length ? (
    <div className="app-page">
      <div className="schedule-consultation-table">
        <Table
          aria-label={
            facultyView
              ? 'Consultation requests from students'
              : 'Your consultation requests'
          }
        >
          <TableHeader>
            <Column id="person" isRowHeader>
              {facultyView ? 'Student' : 'Professor'}
            </Column>
            <Column id="time">Date and time</Column>
            <Column id="status">Status</Column>
            <Column id="updated">Updated</Column>
            {facultyView && <Column id="topic">Topic</Column>}
          </TableHeader>
          <TableBody>
            {consultations
              .slice((current - 1) * 20, current * 20)
              .map((consultation) => (
                <TableRow
                  id={consultation.id}
                  key={consultation.id}
                  href={`/consultations/requests/${encodeURIComponent(consultation.id)}`}
                >
                  <Cell>
                    {facultyView
                      ? consultation.student.name
                      : consultation.faculty.name}
                  </Cell>
                  <Cell>{slotTime(consultation.slot)}</Cell>
                  <Cell>
                    <StatusBadge status={consultation.status} />
                  </Cell>
                  <Cell>{displayDate(consultation.updatedAt, true)}</Cell>
                  {facultyView && <Cell>{consultation.purpose}</Cell>}
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
      <ul
        className="schedule-consultation-cards"
        aria-label={
          facultyView
            ? 'Consultation requests from students'
            : 'Your consultation requests'
        }
      >
        {consultations
          .slice((current - 1) * 20, current * 20)
          .map((consultation) => (
            <li key={consultation.id}>
              <article className="schedule-consultation-card">
                <h3>
                  <Link
                    href={`/consultations/requests/${encodeURIComponent(consultation.id)}`}
                  >
                    {facultyView
                      ? consultation.student.name
                      : consultation.faculty.name}
                  </Link>
                </h3>
                <p className="schedule-consultation-card__time">
                  <span>Date and time</span>
                  <time
                    dateTime={`${consultation.slot.date}T${consultation.slot.start}`}
                  >
                    {slotTime(consultation.slot)}
                  </time>
                </p>
                <dl className="schedule-consultation-card__details">
                  <div>
                    <dt>Status</dt>
                    <dd>
                      <StatusBadge status={consultation.status} />
                    </dd>
                  </div>
                  <div>
                    <dt>Updated</dt>
                    <dd>
                      <time dateTime={consultation.updatedAt}>
                        {displayDate(consultation.updatedAt, true)}
                      </time>
                    </dd>
                  </div>
                  {facultyView && (
                    <div>
                      <dt>Topic</dt>
                      <dd>{consultation.purpose}</dd>
                    </div>
                  )}
                </dl>
              </article>
            </li>
          ))}
      </ul>
      <Pagination
        page={current}
        pageCount={pageCount}
        onPageChange={setPage}
        summary={`${consultations.length} requests`}
      />
    </div>
  ) : (
    <EmptyState
      title={facultyView ? 'No requests to show' : 'No requests yet'}
      description={
        facultyView
          ? 'Requests in this view will appear here.'
          : 'Choose a professor and request an open time.'
      }
    />
  )
}

function ConsultationsPage({
  page,
  session,
}: {
  page: PageEnvelope
  session: Session
}) {
  const [query, setQuery] = useState('')
  const [studentTab, setStudentTab] = useState('requests')
  const [roleView, setRoleView] = useState(
    session.user.roles.includes('professor') ? 'faculty' : 'student',
  )
  const professor = roleView === 'faculty'
  const consultations = list<Consultation>(page.data.consultations).filter(
    (consultation) =>
      professor
        ? consultation.facultyId === session.user.id
        : consultation.studentId === session.user.id,
  )
  const faculty = list<Person>(page.data.faculty).filter((person) =>
    person.name.toLowerCase().includes(query.toLowerCase()),
  )
  const pending = consultations.filter(
    (consultation) => consultation.status === 'Requested',
  )
  const upcoming = consultations.filter((consultation) =>
    ['Approved', 'Booked'].includes(consultation.status),
  )
  const history = consultations.filter((consultation) =>
    ['Completed', 'Declined', 'Cancelled'].includes(consultation.status),
  )

  return (
    <>
      <Heading
        title={professor ? 'Consultation requests' : 'Consultations'}
        actions={
          professor && (
            <Button variant="secondary" href="/consultations/availability">
              Manage availability
            </Button>
          )
        }
      />
      {session.user.roles.includes('student') &&
        session.user.roles.includes('professor') && (
          <SegmentedControl
            aria-label="Consultation role view"
            selectedKey={roleView}
            onSelectionChange={(key) => setRoleView(String(key))}
          >
            <Segment id="faculty">As faculty</Segment>
            <Segment id="student">As student</Segment>
          </SegmentedControl>
        )}
      {professor ? (
        <Tabs defaultSelectedKey="pending">
          <TabList aria-label="Faculty consultation views">
            <Tab id="pending" count={pending.length}>
              To decide
            </Tab>
            <Tab id="upcoming">Upcoming</Tab>
            <Tab id="history">History</Tab>
          </TabList>
          <TabPanel id="pending">
            {pending.length ? (
              <ConsultationTable consultations={pending} facultyView />
            ) : (
              <EmptyState title="No requests to decide" />
            )}
          </TabPanel>
          <TabPanel id="upcoming">
            {upcoming.length ? (
              <Agenda>
                {upcoming.map((consultation) => (
                  <AgendaItem
                    key={consultation.id}
                    chip={`${consultation.slot.date} · ${consultation.slot.start}`}
                    lane="consult"
                    title={`Consultation with ${consultation.student.name}`}
                    href={`/consultations/requests/${encodeURIComponent(consultation.id)}`}
                    linkLabel="Open request"
                  >
                    {consultation.purpose} · {consultation.status}
                  </AgendaItem>
                ))}
              </Agenda>
            ) : (
              <EmptyState title="No upcoming consultations" />
            )}
          </TabPanel>
          <TabPanel id="history">
            <ConsultationTable consultations={history} facultyView />
          </TabPanel>
        </Tabs>
      ) : (
        <Tabs
          selectedKey={studentTab}
          onSelectionChange={(key) => setStudentTab(String(key))}
        >
          <TabList aria-label="Student consultation views">
            <Tab id="requests">My requests</Tab>
            <Tab id="faculty">Find faculty</Tab>
          </TabList>
          <TabPanel id="requests">
            {consultations.length ? (
              <ConsultationTable consultations={consultations} />
            ) : (
              <EmptyState
                title="No requests yet"
                description="Request an open time with a professor assigned to you."
                action={
                  <Button onPress={() => setStudentTab('faculty')}>
                    Find a time
                  </Button>
                }
              />
            )}
          </TabPanel>
          <TabPanel id="faculty">
            <div className="app-page">
              <Search
                label="Find a professor"
                showLabel
                value={query}
                onChange={setQuery}
              />
              {faculty.length ? (
                <Grid columns={3}>
                  {faculty.map((person) => (
                    <PersonCard
                      key={person.id}
                      name={person.name}
                      role="Faculty"
                      office={person.office}
                      description={person.title}
                      href={`/consultations/faculty/${encodeURIComponent(person.id)}`}
                      meta={
                        person.nextSlot
                          ? `Next open time: ${slotTime(person.nextSlot)}`
                          : 'No open time posted'
                      }
                    />
                  ))}
                </Grid>
              ) : (
                <ViewState
                  kind="empty"
                  title={
                    query
                      ? 'No professors match this search'
                      : 'No faculty linked for consultations'
                  }
                  description="Only professors you may consult appear here."
                />
              )}
            </div>
          </TabPanel>
        </Tabs>
      )}
    </>
  )
}

function FacultyTimesPage({ page }: { page: PageEnvelope }) {
  const faculty = record<Person>(page.data.record)
  const action = useScheduleAction('P15')
  const queryClient = useQueryClient()
  const router = useRouter()
  const [week, setWeek] = useState(weekStart(today()))
  const slots = list<Slot>(page.data.slots)
  const [selectedDay, setSelectedDay] = useState(
    () =>
      slots.find(
        (slot) =>
          slot.state === 'open' &&
          slot.date >= weekStart(today()) &&
          slot.date < addDays(weekStart(today()), 7),
      )?.date ?? today(),
  )
  const [selectedSlot, setSelectedSlot] = useState<string>()
  const [purpose, setPurpose] = useState('')
  const [purposeError, setPurposeError] = useState('')
  const days = weekDays(week)
  const weekSlots = slots.filter((slot) =>
    days.some((day) => day.id === slot.date),
  )
  const daySlots = weekSlots
    .filter((slot) => slot.date === selectedDay)
    .sort((a, b) => a.start.localeCompare(b.start))
  const openCount = weekSlots.filter((slot) => slot.state === 'open').length

  if (!faculty) return <RestrictedView record />

  function changeWeek(direction: number) {
    const next = addDays(week, direction * 7)
    setWeek(next)
    setSelectedDay(next)
    setSelectedSlot(undefined)
  }

  async function requestTime(event: FormEvent) {
    event.preventDefault()
    if (!selectedSlot || !purpose.trim()) {
      setPurposeError('Choose an open time and enter a short topic.')
      return
    }
    try {
      const result = await action.mutateAsync({
        action: 'createConsultation',
        payload: { slotId: selectedSlot, purpose: purpose.trim() },
      })
      const request = record<Consultation>(result.record)
      if (request)
        router.history.push(
          `/consultations/requests/${encodeURIComponent(request.id)}`,
        )
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setSelectedSlot(undefined)
        await queryClient.invalidateQueries({ queryKey: ['page', 'P15'] })
      }
    }
  }

  return (
    <>
      <Breadcrumbs
        items={[
          { label: 'Consultations', href: '/consultations' },
          { label: faculty.name },
        ]}
      />
      <ProfileHeader
        compact
        name={faculty.name}
        role="Faculty"
        title={faculty.title}
        office={faculty.office}
        email={faculty.email}
      />
      <Row justify="between">
        <SectionHeader level={2} title={`Week of ${displayDate(week)}`} />
        <Row gap={8}>
          <IconButton
            icon="caret-left"
            label="Previous week"
            onPress={() => changeWeek(-1)}
          />
          <IconButton
            icon="caret-right"
            label="Next week"
            onPress={() => changeWeek(1)}
          />
        </Row>
      </Row>
      {!openCount && (
        <EmptyState
          title="No open times this week"
          description="Try another week, or send a permitted message to the professor."
          action={
            <Button
              variant="secondary"
              href={`/messages?recipient=${encodeURIComponent(faculty.id)}`}
            >
              Message professor
            </Button>
          }
        />
      )}
      <form className="app-page" onSubmit={requestTime}>
        <ConsultationSlotPicker
          days={days.map((day) => ({
            id: day.id,
            weekday: day.label,
            day: day.date ?? '',
            label: day.fullLabel ?? day.label,
            openCount: weekSlots.filter(
              (slot) => slot.date === day.id && slot.state === 'open',
            ).length,
            isToday: day.isToday,
          }))}
          selectedDay={selectedDay}
          onDayChange={(day) => {
            setSelectedDay(day)
            setSelectedSlot(undefined)
          }}
          slots={daySlots.map((slot) => ({
            id: slot.id,
            time: `${slot.start}–${slot.end}`,
            state:
              slot.state === 'open'
                ? 'open'
                : slot.state === 'unavailable'
                  ? 'unavailable'
                  : 'booked',
          }))}
          value={selectedSlot}
          onChange={setSelectedSlot}
          timeZoneNote="Local campus time"
          errorMessage={
            action.error instanceof ApiError && action.error.status === 409
              ? 'That time was just taken. Pick another time.'
              : undefined
          }
        />
        {!daySlots.length && (
          <ViewState kind="empty" title="No times posted for this day" />
        )}
        <TextArea
          label="What do you want to discuss?"
          value={purpose}
          onChange={setPurpose}
          maxLength={300}
          showCount
          isRequired
          isInvalid={Boolean(purposeError)}
          errorMessage={purposeError}
        />
        <Alert
          tone="neutral"
          title="Nothing is booked until your professor confirms"
        >
          A request starts as Requested. Check its status before attending.
        </Alert>
        <ActionError error={action.error} />
        <Row>
          <Button
            type="submit"
            loading={action.isPending}
            isDisabled={!selectedSlot}
          >
            Request this time
          </Button>
        </Row>
      </form>
    </>
  )
}

function RequestPage({
  page,
  session,
}: {
  page: PageEnvelope
  session: Session
}) {
  const consultation = record<Consultation>(page.data.record)
  const action = useScheduleAction('P16')
  const [decision, setDecision] = useState<ConsultationStatus>()
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState('')
  if (!consultation) return <RestrictedView record />
  const faculty = consultation.facultyId === session.user.id
  const valid: Record<ConsultationStatus, ConsultationStatus[]> = {
    Requested: ['Approved', 'Declined', 'Cancelled'],
    Approved: ['Booked', 'Cancelled'],
    Booked: ['Completed', 'Cancelled'],
    Completed: [],
    Declined: [],
    Cancelled: [],
  }
  const next = valid[consultation.status].filter(
    (status) => faculty || status === 'Cancelled',
  )
  const latest = consultation.history.at(-1)
  const events: CaseEvent[] = consultation.history.map((entry, index) => ({
    title: entry.status,
    actor:
      entry.actorId === consultation.facultyId
        ? 'Professor'
        : 'Requesting student',
    body: entry.note,
    date: displayDate(entry.at, true),
    dateTime: entry.at,
    state: index === consultation.history.length - 1 ? 'current' : 'done',
  }))
  const labels: Partial<Record<ConsultationStatus, string>> = {
    Approved: 'Approve',
    Booked: 'Book',
    Completed: 'Mark completed',
    Declined: 'Decline',
    Cancelled: faculty ? 'Cancel' : 'Cancel request',
  }

  async function saveDecision(status: ConsultationStatus, note?: string) {
    try {
      await action.mutateAsync({
        action: 'decideConsultation',
        recordId: consultation!.id,
        payload: { decision: status, ...(note ? { note } : {}) },
      })
      setDecision(undefined)
      setReason('')
      setReasonError('')
    } catch {
      // Keep the decision dialog open if the API rejects a conflict.
    }
  }

  function chooseDecision(status: ConsultationStatus) {
    if (status === 'Declined' || status === 'Cancelled') {
      setReason('')
      setReasonError('')
      setDecision(status)
    } else void saveDecision(status)
  }

  function confirmDecision() {
    if (!reason.trim()) {
      setReasonError('Enter a reason.')
      return
    }
    if (decision) void saveDecision(decision, reason.trim())
  }

  return (
    <>
      <Breadcrumbs
        items={[
          { label: 'Consultations', href: '/consultations' },
          { label: displayDate(consultation.slot.date) },
        ]}
      />
      <Heading
        title={
          faculty
            ? `Request from ${consultation.student.name}`
            : `Consultation with ${consultation.faculty.name}`
        }
        actions={<StatusBadge status={consultation.status} />}
      />
      <dl className="ds-record__facts">
        <div>
          <dt>Date and time</dt>
          <dd>{slotTime(consultation.slot)}</dd>
        </div>
        <div>
          <dt>Requested at</dt>
          <dd>{displayDate(consultation.createdAt, true)}</dd>
        </div>
        <div>
          <dt>Topic</dt>
          <dd>{consultation.purpose}</dd>
        </div>
        <div>
          <dt>Last decision</dt>
          <dd>
            {consultation.history.length > 1
              ? displayDate(latest?.at, true)
              : 'Awaiting decision'}
          </dd>
        </div>
        <div>
          <dt>Reason or update</dt>
          <dd>{latest?.note ?? '—'}</dd>
        </div>
      </dl>
      <SectionHeader level={2} title="Request history" />
      <CaseTimeline events={events} label="Consultation request history" />
      <ActionError
        error={action.error}
        title={
          action.error instanceof ApiError && action.error.status === 409
            ? 'This time could not be changed'
            : undefined
        }
      />
      <Row>
        {next.map((status) => (
          <Button
            key={status}
            variant={
              status === 'Cancelled'
                ? faculty
                  ? 'destructive'
                  : 'secondary'
                : status === 'Declined'
                  ? 'secondary'
                  : 'primary'
            }
            loading={action.isPending}
            onPress={() => chooseDecision(status)}
          >
            {labels[status]}
          </Button>
        ))}
      </Row>
      {/* TBD(D-04): cancellation notice periods and rescheduling rules are not approved. */}
      {next.includes('Cancelled') && (
        <Alert tone="neutral" title="Cancellation policy is under review">
          A cancellation needs a reason and stays in the request history.
          Rescheduling requires a new open time.
        </Alert>
      )}
      <Modal
        title={
          decision === 'Declined'
            ? 'Decline this request?'
            : 'Cancel this consultation?'
        }
        role={decision === 'Cancelled' ? 'alertdialog' : 'dialog'}
        isOpen={Boolean(decision)}
        onOpenChange={(open) => {
          if (!open) setDecision(undefined)
        }}
      >
        <ModalBody>
          <div className="app-page">
            <TextArea
              label="Reason"
              value={reason}
              onChange={setReason}
              isRequired
              maxLength={2000}
              isInvalid={Boolean(reasonError)}
              errorMessage={reasonError}
            />
            <p>Both participants can see the recorded update.</p>
            <ActionError error={action.error} />
          </div>
        </ModalBody>
        <ModalActions>
          <Button variant="secondary" onPress={() => setDecision(undefined)}>
            Keep request
          </Button>
          <Button
            variant={decision === 'Cancelled' ? 'destructive' : 'primary'}
            loading={action.isPending}
            onPress={confirmDecision}
          >
            {decision === 'Declined'
              ? 'Decline request'
              : 'Cancel consultation'}
          </Button>
        </ModalActions>
      </Modal>
    </>
  )
}

function AvailabilityPage({ page }: { page: PageEnvelope }) {
  const action = useScheduleAction('P17')
  const consultationsQuery = useQuery(pageQuery('P14'))
  const slots = list<Slot>(page.data.slots)
  const consultations = list<Consultation>(
    consultationsQuery.data?.data.consultations,
  )
  const [view, setView] = useState('week')
  const [week, setWeek] = useState(weekStart(today()))
  const [addOpen, setAddOpen] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<Slot>()
  const [date, setDate] = useState('')
  const [start, setStart] = useState('09:00')
  const [end, setEnd] = useState('09:30')
  const [state, setState] = useState<'open' | 'unavailable'>('open')
  const [fieldError, setFieldError] = useState('')
  const times = Array.from(
    { length: 27 },
    (_, index) =>
      `${String(6 + Math.floor(index / 2)).padStart(2, '0')}:${index % 2 ? '30' : '00'}`,
  )
  const days = weekDays(week)
  const weekSlots = slots.filter((slot) =>
    days.some((day) => day.id === slot.date),
  )
  const booked =
    selectedSlot && ['booked', 'requested'].includes(selectedSlot.state)
  const selectedRequest = consultations.find(
    (consultation) =>
      consultation.slotId === selectedSlot?.id &&
      !['Completed', 'Declined', 'Cancelled'].includes(consultation.status),
  )
  const events: TimetableEvent[] = weekSlots.map((slot) => ({
    id: slot.id,
    day: slot.date,
    start: decimalTime(slot.start, 8),
    end: decimalTime(slot.end, 9),
    title:
      slot.state === 'open'
        ? 'Available for consultation'
        : slot.state === 'unavailable'
          ? 'Unavailable'
          : 'Consultation request',
    lane: 'consult',
    form: slotForm(slot),
    time: `${slot.start}–${slot.end}`,
    onPress: () => setSelectedSlot(slot),
  }))

  async function saveTimes(event: FormEvent) {
    event.preventDefault()
    if (!date || end <= start) {
      setFieldError('Choose a date and an end time after the start time.')
      return
    }
    const overlap = slots.find(
      (slot) => slot.date === date && slot.start < end && slot.end > start,
    )
    if (overlap) {
      setFieldError(`Overlaps ${overlap.start}–${overlap.end}.`)
      return
    }
    try {
      await action.mutateAsync({
        action: 'saveAvailability',
        payload: { date, start, end, state },
      })
      setAddOpen(false)
      setDate('')
      setFieldError('')
    } catch {
      // The entered date and times remain available after an API error.
    }
  }

  async function changeSlot(slot: Slot, remove = false) {
    if (['booked', 'requested'].includes(slot.state)) {
      setSelectedSlot(slot)
      return
    }
    try {
      await action.mutateAsync({
        action: remove ? 'deleteAvailability' : 'saveAvailability',
        recordId: slot.id,
        payload: remove
          ? {}
          : {
              date: slot.date,
              start: slot.start,
              end: slot.end,
              state: slot.state === 'open' ? 'unavailable' : 'open',
            },
      })
      setSelectedSlot(undefined)
    } catch {
      // The API rejects overlaps and changes to requested or booked times.
    }
  }

  function slotActions(slot: Slot) {
    return (
      <div className="app-page">
        <p>{slotTime(slot)}</p>
        <Button
          variant="secondary"
          loading={action.isPending}
          onPress={() => void changeSlot(slot)}
        >
          {slot.state === 'open' ? 'Mark unavailable' : 'Mark available'}
        </Button>
        <Button
          variant="destructive"
          loading={action.isPending}
          onPress={() => void changeSlot(slot, true)}
        >
          Delete time
        </Button>
        <ActionError error={action.error} />
      </div>
    )
  }

  return (
    <>
      <Heading
        title="My availability"
        description="Your own consultation schedule · local campus time"
        actions={
          <Button
            icon="plus"
            onPress={() => {
              setFieldError('')
              setAddOpen(true)
            }}
          >
            Add times
          </Button>
        }
      />
      <Row justify="between">
        <SegmentedControl
          aria-label="Availability view"
          selectedKey={view}
          onSelectionChange={(key) => setView(String(key))}
        >
          <Segment id="week">Week</Segment>
          <Segment id="list">List</Segment>
        </SegmentedControl>
        <Row gap={8}>
          <IconButton
            icon="caret-left"
            label="Previous week"
            onPress={() => setWeek(addDays(week, -7))}
          />
          <Button
            variant="tertiary"
            onPress={() => setWeek(weekStart(today()))}
          >
            This week
          </Button>
          <IconButton
            icon="caret-right"
            label="Next week"
            onPress={() => setWeek(addDays(week, 7))}
          />
        </Row>
      </Row>
      <SectionHeader level={2} title={`Week of ${displayDate(week)}`} />
      {view === 'week' ? (
        <Timetable
          label="My consultation availability"
          days={days}
          events={events}
          startHour={6}
          endHour={20}
        />
      ) : (
        <div className="app-card-list">
          {weekSlots.map((slot) =>
            ['booked', 'requested'].includes(slot.state) ? (
              <TimeBlock
                key={slot.id}
                title="Consultation request"
                time={slotTime(slot)}
                lane="consult"
                form={slotForm(slot)}
                onPress={() => setSelectedSlot(slot)}
              />
            ) : (
              <Popover
                key={slot.id}
                trigger={
                  <Button variant="secondary">
                    {slotTime(slot)} ·{' '}
                    {slot.state === 'open' ? 'Available' : 'Unavailable'}
                  </Button>
                }
                title="Availability options"
              >
                {slotActions(slot)}
              </Popover>
            ),
          )}
        </div>
      )}
      {!weekSlots.length && (
        <EmptyState
          title="No availability posted this week"
          description="Add an open or unavailable time to your own schedule."
        />
      )}
      <ActionError error={action.error} />
      {/* TBD(D-04): external calendar sync, recurrence and booking-change policy are not approved. */}
      <Alert tone="neutral" title="Calendar sync is under review">
        Changes here update ACCS availability. External calendar synchronization
        and recurring times are not configured.
      </Alert>
      <Modal title="Add times" isOpen={addOpen} onOpenChange={setAddOpen}>
        <form onSubmit={saveTimes}>
          <ModalBody>
            <div className="app-page">
              <DatePicker
                label="Date"
                isRequired
                onChange={(value) => setDate(value?.toString() ?? '')}
              />
              <Row>
                <Select
                  label="Start"
                  selectedKey={start}
                  onSelectionChange={(key) => setStart(String(key))}
                >
                  {times.map((time) => (
                    <SelectOption key={time} id={time}>
                      {time}
                    </SelectOption>
                  ))}
                </Select>
                <Select
                  label="End"
                  selectedKey={end}
                  onSelectionChange={(key) => setEnd(String(key))}
                >
                  {times.map((time) => (
                    <SelectOption key={time} id={time}>
                      {time}
                    </SelectOption>
                  ))}
                </Select>
              </Row>
              <RadioGroup
                label="Availability"
                row
                value={state}
                onChange={(value) => setState(value as 'open' | 'unavailable')}
              >
                <Radio value="open">Available</Radio>
                <Radio value="unavailable">Unavailable</Radio>
              </RadioGroup>
              <RadioGroup
                label="Repeat"
                value="once"
                description="Recurring times await an approved term rule."
              >
                <Radio value="once">Once</Radio>
                <Radio value="weekly" isDisabled>
                  Weekly until the end of term
                </Radio>
              </RadioGroup>
              <Alert tone="neutral" title="Students see changes right away">
                Requested or booked times need a recorded cancellation before
                they can change.
              </Alert>
              {fieldError && (
                <Alert tone="danger" title="Check the time">
                  {fieldError}
                </Alert>
              )}
              <ActionError error={action.error} />
            </div>
          </ModalBody>
          <ModalActions>
            <Button variant="secondary" onPress={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={action.isPending}>
              Save time
            </Button>
          </ModalActions>
        </form>
      </Modal>
      <Modal
        title={
          booked
            ? 'This time is booked. Changing it needs a cancellation.'
            : 'Availability options'
        }
        role={booked ? 'alertdialog' : 'dialog'}
        isOpen={Boolean(selectedSlot)}
        onOpenChange={(open) => {
          if (!open) setSelectedSlot(undefined)
        }}
      >
        <ModalBody>
          {selectedSlot &&
            (booked ? (
              <div className="app-page">
                <p>{slotTime(selectedSlot)}</p>
                <p>
                  The consultation remains on both calendars until a
                  cancellation is recorded.
                </p>
              </div>
            ) : (
              slotActions(selectedSlot)
            ))}
        </ModalBody>
        <ModalActions>
          <Button
            variant="secondary"
            onPress={() => setSelectedSlot(undefined)}
          >
            {booked ? 'Keep booking' : 'Close'}
          </Button>
          {booked && (
            <Button
              variant="destructive"
              href={
                selectedRequest
                  ? `/consultations/requests/${encodeURIComponent(selectedRequest.id)}`
                  : '/consultations'
              }
            >
              Cancel the booking
            </Button>
          )}
        </ModalActions>
      </Modal>
    </>
  )
}

export function SchedulePage({ page }: { page: PageEnvelope }) {
  const session = useQuery(sessionQuery())
  if (!session.data)
    return <ViewState kind="loading" title="Loading account context" />
  if (page.pageId === 'P13')
    return <CalendarPage page={page} session={session.data} />
  if (page.pageId === 'P14')
    return <ConsultationsPage page={page} session={session.data} />
  if (page.pageId === 'P15') return <FacultyTimesPage page={page} />
  if (page.pageId === 'P16')
    return <RequestPage page={page} session={session.data} />
  return <AvailabilityPage page={page} />
}
