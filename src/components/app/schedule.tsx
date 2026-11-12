import {
  Alert,
  Button,
  Checkbox,
  DatePicker,
  Drawer,
  Icon,
  IconButton,
  Link,
  Modal,
  ModalActions,
  ModalBody,
  Pagination,
  PrivacyNotice,
  Radio,
  RadioGroup,
  Search,
  Select,
  SelectOption,
  TextArea,
  TextField,
  ViewState,
  toast,
} from '@meetingat10/design-system/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter, useRouterState } from '@tanstack/react-router'
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Variants,
} from 'motion/react'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'

import { RestrictedView } from '@/components/app/guards'
import { PagedList } from '@/components/app/paging'
import {
  Empty,
  PageHeader,
  Panel,
  StatusChip,
  toneFor,
  DateTile,
} from '@/components/app/page-shell'
import {
  EventCalendar,
  formatClock,
  type CalendarEvent,
} from '@/components/ds-next/EventCalendar'
import {
  ApiError,
  performPageAction,
  type PageAction,
  type PageEnvelope,
  type Session,
} from '@/lib/api'
import {
  dateParts,
  formatDate,
  formatDateTime,
  initials,
  relativeTime,
} from '@/lib/format'
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

const allStatuses: ConsultationStatus[] = [
  'Requested',
  'Approved',
  'Booked',
  'Completed',
  'Declined',
  'Cancelled',
]

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
  slot?: Slot
  todo?: Todo
  consultation?: Consultation
}

const ease: [number, number, number, number] = [0.16, 1, 0.3, 1]

const layerTone: Record<string, string> = {
  academic: 'academic',
  campus: 'campus',
  ccs: 'ccs',
  faculty: 'open',
  consultations: 'consult',
  todos: 'todo',
  organization: 'org',
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

function weekLabel(start: string) {
  return `${formatDate(start)} – ${formatDate(addDays(start, 6))}`
}

function slotRange(slot: { start: string; end: string }) {
  return `${formatClock(slot.start)}–${formatClock(slot.end)}`
}

function slotTime(slot: Slot) {
  return `${formatDate(slot.date)} · ${slotRange(slot)}`
}

function dayHeading(value: string) {
  return `${dateParts(value)?.weekday ?? ''}, ${formatDate(value)}`
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
  title = "Couldn't save the change",
}: {
  error: unknown
  title?: string
}) {
  return error ? (
    <Alert tone="danger" title={title}>
      {error instanceof Error
        ? error.message
        : 'Try again. Your text is still here.'}
    </Alert>
  ) : null
}

function StatusBadge({ status }: { status: ConsultationStatus }) {
  return <StatusChip tone={toneFor(status)}>{status}</StatusChip>
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

/** Pill group with one thumb that slides to the active item. */
function Segmented({
  id,
  label,
  items,
  value,
  onChange,
  variant = 'seg',
}: {
  id: string
  label: string
  items: Array<{ id: string; label: string; count?: number }>
  value: string
  onChange: (id: string) => void
  variant?: 'seg' | 'chip'
}) {
  const reduce = useReducedMotion()
  return (
    <div className={`sc-seg sc-seg--${variant}`} role="group" aria-label={label}>
      {items.map((item) => {
        const active = item.id === value
        return (
          <button
            type="button"
            key={item.id}
            className="sc-seg__btn"
            aria-pressed={active}
            onClick={() => onChange(item.id)}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                className="sc-seg__thumb"
                transition={
                  reduce
                    ? { duration: 0 }
                    : { type: 'spring', stiffness: 520, damping: 40 }
                }
              />
            )}
            <span className="sc-seg__label">{item.label}</span>
            {item.count !== undefined && (
              <span className="sc-seg__count">{item.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

function Avatar({ name, size }: { name: string; size?: 'lg' }) {
  return (
    <span className={`accs-avatar${size ? ' sc-avatar--lg' : ''}`} aria-hidden>
      {initials(name)}
    </span>
  )
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
  const todos = [...list<Todo>(page.data.todos)].sort(
    (a, b) => Number(a.done) - Number(b.done) || a.date.localeCompare(b.date),
  )
  const entries: CalendarEntry[] = [
    ...list<InstitutionalEvent>(page.data.events).map((event) => {
      const layer = event.organizationId
        ? 'organization'
        : event.type.toLowerCase().includes('academic')
          ? 'academic'
          : event.type.toLowerCase().includes('campus')
            ? 'campus'
            : 'ccs'
      return {
        id: `event:${event.id}`,
        title: event.title,
        date: event.date,
        start: event.start,
        end: event.end ?? event.start,
        time: event.end
          ? `${formatClock(event.start)}–${formatClock(event.end)}`
          : formatClock(event.start),
        type: event.type,
        tone: layerTone[layer],
        layer,
        description: event.description,
        contactId: event.contactId,
        place: event.location ?? event.place ?? event.eventPlace,
        contact: event.contact,
      }
    }),
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
        time: slotRange(slot),
        type:
          slot.state === 'open'
            ? 'Open time'
            : slot.state === 'unavailable'
              ? 'Unavailable'
              : 'Requested or booked',
        tone:
          slot.state === 'open'
            ? 'open'
            : slot.state === 'unavailable'
              ? 'unavailable'
              : 'consult',
        layer: 'faculty',
        contactId: slot.facultyId,
        slot,
      })),
    ...todos.map((todo) => ({
      id: `todo:${todo.id}`,
      title: todo.title,
      date: todo.date,
      start: '08:00',
      end: '09:00',
      allDay: true,
      time: todo.done ? 'Completed' : 'Due today',
      type: 'Personal to-do',
      tone: 'todo',
      layer: 'todos',
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
      time: slotRange(consultation.slot),
      type: consultation.status,
      tone: 'consult',
      layer: professor ? 'consultations' : 'faculty',
      consultation,
    })),
  ].filter((entry) => selectedLayers.includes(entry.layer))
  const upcoming = entries
    .filter(
      (entry) =>
        !entry.slot && entry.date >= today() && !(entry.todo && entry.todo.done),
    )
    .sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`))
    .slice(0, 6)
  const periodLabel =
    view === 'week'
      ? weekLabel(weekStart(selectedDate))
      : parseDate(selectedDate).toLocaleDateString('en-PH', {
          month: 'long',
          year: 'numeric',
        })

  function shift(direction: number) {
    const date = parseDate(selectedDate)
    if (view === 'week') date.setDate(date.getDate() + direction * 7)
    else {
      date.setDate(1)
      date.setMonth(date.getMonth() + direction)
    }
    update({ date: isoDate(date) })
  }

  function toggleLayer(id: string) {
    const next = selectedLayers.includes(id)
      ? selectedLayers.filter((layer) => layer !== id)
      : [...selectedLayers.filter((layer) => layer !== 'none'), id]
    update({ layers: next.join(',') || 'none' })
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

  function deleteTodo(todo: Todo, close = false) {
    action.mutate(
      { action: 'deleteTodo', recordId: todo.id, payload: {} },
      { onSuccess: () => close && setSelectedEntry(undefined) },
    )
  }

  function entryDetails(entry: CalendarEntry) {
    return (
      <div className="sc-detail">
        <span className="ec-badge" data-etone={entry.tone}>
          {entry.type}
        </span>
        <dl className="sc-facts sc-facts--stack">
          <div>
            <dt>Date</dt>
            <dd>
              <time dateTime={entry.date}>{formatDate(entry.date)}</time>
            </dd>
          </div>
          <div>
            <dt>Time</dt>
            <dd>{entry.allDay ? 'All day' : entry.time}</dd>
          </div>
          {entry.place && (
            <div>
              <dt>Place</dt>
              <dd>{entry.place}</dd>
            </div>
          )}
          {entry.contact && (
            <div>
              <dt>Contact</dt>
              <dd>{entry.contact}</dd>
            </div>
          )}
        </dl>
        {entry.description && <p>{entry.description}</p>}
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
          <Alert tone="neutral" title="This time is closed">
            You can only request open times.
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
          <div className="sc-detail__actions">
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
              onPress={() => deleteTodo(entry.todo!, true)}
            >
              Delete to-do
            </Button>
          </div>
        )}
        <ActionError error={action.error} />
      </div>
    )
  }

  const layerPills = (
    <div className="sc-layers" role="group" aria-label="Calendar layers">
      {layers.map((layer) => (
        <button
          type="button"
          key={layer.id}
          className="sc-layer"
          data-etone={layerTone[layer.id]}
          aria-pressed={selectedLayers.includes(layer.id)}
          onClick={() => toggleLayer(layer.id)}
        >
          <i aria-hidden />
          {layer.label}
        </button>
      ))}
    </div>
  )

  return (
    <>
      <PageHeader
        title="Calendar"
        description="All times are campus time."
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
      <div className="accs-stack accs-stagger">
        <div className="sc-bar">
          <div className="sc-bar__nav">
            <IconButton
              icon="caret-left"
              label="Previous"
              onPress={() => shift(-1)}
            />
            <Button
              variant="secondary"
              size="sm"
              onPress={() => update({ date: today() })}
            >
              Today
            </Button>
            <IconButton
              icon="caret-right"
              label="Next"
              onPress={() => shift(1)}
            />
            <h2 className="sc-bar__label" aria-live="polite">
              {periodLabel}
            </h2>
          </div>
          <Segmented
            id="calendar-view"
            label="Calendar view"
            value={view}
            onChange={(id) => update({ view: id })}
            items={[
              { id: 'month', label: 'Month' },
              { id: 'week', label: 'Week' },
              { id: 'list', label: 'List' },
            ]}
          />
          <div className="sc-bar__layers">{layerPills}</div>
        </div>
        <div className="accs-split">
          <div className="accs-stack">
            <Panel flush aria-label="Calendar">
              <EventCalendar
                date={selectedDate}
                view={view}
                events={entries}
                onDateChange={(date) => update({ date })}
                onEventPress={(event) =>
                  setSelectedEntry(
                    entries.find((entry) => entry.id === event.id),
                  )
                }
              />
            </Panel>
            <ActionError error={action.error} />
          </div>
          <div className="accs-stack">
            <Panel title="Show on calendar" className="sc-rail-layers">
              {layerPills}
            </Panel>
            <Panel flush title="Upcoming">
              {upcoming.length ? (
                <PagedList items={upcoming} noun="events">
                  {(upcoming) => (
                  <ul className="accs-rows">
                    {upcoming.map((entry) => (
                      <li key={entry.id}>
                        <button
                          type="button"
                          className="accs-row accs-row--link sc-up"
                          onClick={() => setSelectedEntry(entry)}
                        >
                          <DateTile value={entry.date} />
                          <span>
                            <span className="accs-row__title">{entry.title}</span>
                            <span className="accs-row__sub">
                              {entry.allDay ? 'All day' : entry.time}
                            </span>
                          </span>
                          <i
                            className="ec-dot"
                            data-etone={entry.tone}
                            aria-hidden
                          />
                        </button>
                      </li>
                    ))}
                  </ul>
                  )}
                </PagedList>
              ) : (
                <Empty title="Nothing coming up">
                  No events in the layers you selected.
                </Empty>
              )}
            </Panel>
            {canTodo && (
              <Panel
                title="My to-dos"
                action={
                  <button
                    type="button"
                    className="accs-panel__link sc-linkbtn"
                    onClick={() => setTodoOpen(true)}
                  >
                    Add
                  </button>
                }
              >
                {todos.length ? (
                  <ul className="sc-todos">
                    <AnimatePresence initial={false}>
                      {todos.map((todo) => (
                        <motion.li
                          key={todo.id}
                          layout
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.24, ease }}
                        >
                          <div className="sc-todo">
                            <Checkbox
                              isSelected={todo.done}
                              onChange={(done) =>
                                action.mutate({
                                  action: 'toggleTodo',
                                  recordId: todo.id,
                                  payload: { done },
                                })
                              }
                            >
                              <span className="sc-todo__t" data-done={todo.done}>
                                {todo.title}
                              </span>
                            </Checkbox>
                            <span className="accs-meta">
                              {formatDate(todo.date)}
                            </span>
                            <button
                              type="button"
                              className="accs-icon-btn"
                              aria-label={`Delete ${todo.title}`}
                              onClick={() => deleteTodo(todo)}
                            >
                              <Icon name="x" size={16} />
                            </button>
                          </div>
                        </motion.li>
                      ))}
                    </AnimatePresence>
                  </ul>
                ) : (
                  <Empty title="No to-dos yet">
                    Only you can see your to-dos.
                  </Empty>
                )}
              </Panel>
            )}
          </div>
        </div>
      </div>
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

function FacultyCard({
  person,
  selected,
  nextSlot,
}: {
  person: Person
  selected?: boolean
  nextSlot?: Slot
}) {
  const next = nextSlot ?? person.nextSlot
  return (
    <a
      className="sc-fac"
      href={`/consultations/faculty/${encodeURIComponent(person.id)}`}
      aria-current={selected ? 'true' : undefined}
    >
      <Avatar name={person.name} size="lg" />
      <span className="sc-fac__body">
        <strong>{person.name}</strong>
        <span className="sc-fac__meta">
          {[person.title ?? 'Faculty', person.office].filter(Boolean).join(' · ')}
        </span>
        <span className="sc-fac__next" data-open={Boolean(next) || undefined}>
          {next
            ? `Next open · ${formatDate(next.date)}, ${formatClock(next.start)}`
            : 'No open time posted'}
        </span>
      </span>
      {selected && (
        <span className="sc-fac__check" aria-label="Selected">
          <Icon name="check" size={16} />
        </span>
      )}
    </a>
  )
}

function ConsultationList({
  consultations,
  facultyView,
  emptyTitle,
  emptyHint,
  emptyAction,
}: {
  consultations: Consultation[]
  facultyView: boolean
  emptyTitle: string
  emptyHint: string
  emptyAction?: ReactNode
}) {
  const [page, setPage] = useState(1)
  const pageCount = Math.max(1, Math.ceil(consultations.length / 20))
  const current = Math.min(page, pageCount)
  if (!consultations.length)
    return (
      <Panel flush>
        <Empty title={emptyTitle} action={emptyAction}>
          {emptyHint}
        </Empty>
      </Panel>
    )
  return (
    <div className="accs-stack accs-stack--tight">
      <Panel flush aria-label={facultyView ? 'Requests from students' : 'Your requests'}>
        <ul className="accs-rows">
          {consultations.slice((current - 1) * 20, current * 20).map((item) => {
            const person = facultyView ? item.student : item.faculty
            return (
              <li key={item.id}>
                <a
                  className="accs-row accs-row--link sc-crow"
                  href={`/consultations/requests/${encodeURIComponent(item.id)}`}
                >
                  <Avatar name={person.name} />
                  <span className="sc-crow__who">
                    <span className="accs-row__title">{person.name}</span>
                    <span className="accs-row__sub">{item.purpose}</span>
                  </span>
                  <span className="sc-crow__when">
                    <time dateTime={item.slot.date}>
                      {formatDate(item.slot.date)}
                    </time>
                    <span>{slotRange(item.slot)}</span>
                  </span>
                  <span className="sc-crow__status">
                    <StatusBadge status={item.status} />
                    <span className="accs-meta">
                      Updated {relativeTime(item.updatedAt)}
                    </span>
                  </span>
                </a>
              </li>
            )
          })}
        </ul>
      </Panel>
      <Pagination
        page={current}
        pageCount={pageCount}
        onPageChange={setPage}
        summary={`${consultations.length} requests`}
      />
    </div>
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
  const [mode, setMode] = useState('requests')
  const dual =
    session.user.roles.includes('student') &&
    session.user.roles.includes('professor')
  const [roleView, setRoleView] = useState(
    session.user.roles.includes('professor') ? 'faculty' : 'student',
  )
  const professor = roleView === 'faculty'
  const [status, setStatus] = useState<string>(professor ? 'Requested' : 'All')
  const consultations = list<Consultation>(page.data.consultations).filter(
    (consultation) =>
      professor
        ? consultation.facultyId === session.user.id
        : consultation.studentId === session.user.id,
  )
  const faculty = list<Person>(page.data.faculty).filter((person) =>
    person.name.toLowerCase().includes(query.toLowerCase()),
  )
  const visible =
    status === 'All'
      ? consultations
      : consultations.filter((consultation) => consultation.status === status)
  const showRequests = professor || mode === 'requests'

  return (
    <>
      <PageHeader
        title={professor ? 'Consultation requests' : 'Consultations'}
        description={
          professor
            ? 'Approve or decline requests, and set the times you offer. To meet a student about a concern, add the time, link or place on the case.'
            : 'Track your requests or book a professor. To talk about a concern you filed, choose how in that concern.'
        }
        actions={
          professor ? (
            <Button variant="secondary" href="/consultations/availability">
              Manage availability
            </Button>
          ) : (
            <Button icon="plus" onPress={() => setMode('faculty')}>
              Book a consultation
            </Button>
          )
        }
      />
      <div className="accs-stack accs-stagger">
        <div className="sc-controls">
          {dual && (
            <Segmented
              id="consult-role"
              label="Consultation role view"
              value={roleView}
              onChange={(id) => {
                setRoleView(id)
                setStatus(id === 'faculty' ? 'Requested' : 'All')
              }}
              items={[
                { id: 'faculty', label: 'As faculty' },
                { id: 'student', label: 'As student' },
              ]}
            />
          )}
          {!professor && (
            <Segmented
              id="consult-mode"
              label="Consultation sections"
              value={mode}
              onChange={setMode}
              items={[
                { id: 'requests', label: 'My requests' },
                { id: 'faculty', label: 'Find faculty' },
              ]}
            />
          )}
        </div>
        {showRequests ? (
          <>
            <Segmented
              id="consult-status"
              variant="chip"
              label="Filter by status"
              value={status}
              onChange={setStatus}
              items={[
                { id: 'All', label: 'All', count: consultations.length },
                ...allStatuses.map((item) => ({
                  id: item,
                  label: item,
                  count: consultations.filter(
                    (consultation) => consultation.status === item,
                  ).length,
                })),
              ]}
            />
            <ConsultationList
              key={`${roleView}:${status}`}
              consultations={visible}
              facultyView={professor}
              emptyTitle={
                professor ? 'No requests to show' : 'No requests yet'
              }
              emptyHint={
                professor
                  ? 'No requests match this filter.'
                  : status === 'All'
                    ? 'Pick an open time with one of your professors.'
                    : `You have no ${status.toLowerCase()} requests.`
              }
              emptyAction={
                !professor &&
                status === 'All' && (
                  <Button onPress={() => setMode('faculty')}>Find a professor</Button>
                )
              }
            />
          </>
        ) : (
          <>
            <Search
              label="Find a professor"
              showLabel
              value={query}
              onChange={setQuery}
            />
            {faculty.length ? (
              <div className="accs-grid">
                {faculty.map((person) => (
                  <FacultyCard key={person.id} person={person} />
                ))}
              </div>
            ) : (
              <ViewState
                kind="empty"
                title={
                  query
                    ? 'No professors match this search'
                    : 'No professors available'
                }
                description="Your list only includes professors you can consult."
              />
            )}
          </>
        )}
      </div>
    </>
  )
}

const bookingSteps = ['Faculty', 'Time', 'Purpose', 'Confirm']

function FacultyTimesPage({ page }: { page: PageEnvelope }) {
  const faculty = record<Person>(page.data.record)
  const action = useScheduleAction('P15')
  const queryClient = useQueryClient()
  const router = useRouter()
  const reduce = useReducedMotion()
  const directory = useQuery(pageQuery('P14'))
  const slots = list<Slot>(page.data.slots)
  const firstOpen = slots
    .filter((slot) => slot.state === 'open' && slot.date >= today())
    .sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`))[0]
  const [step, setStep] = useState({ n: 1, dir: 1 })
  const [week, setWeek] = useState(() => weekStart(firstOpen?.date ?? today()))
  const [selectedSlot, setSelectedSlot] = useState<string>()
  const [purpose, setPurpose] = useState('')
  const [purposeError, setPurposeError] = useState('')
  const end = addDays(week, 7)
  const weekSlots = slots.filter((slot) => slot.date >= week && slot.date < end)
  const openCount = weekSlots.filter((slot) => slot.state === 'open').length
  const groups = [...new Set(weekSlots.map((slot) => slot.date))]
    .sort()
    .map((date) => ({
      date,
      slots: weekSlots
        .filter((slot) => slot.date === date)
        .sort((a, b) => a.start.localeCompare(b.start)),
    }))
  const chosen = slots.find((slot) => slot.id === selectedSlot)
  const conflict =
    action.error instanceof ApiError && action.error.status === 409

  if (!faculty) return <RestrictedView record />

  const others = list<Person>(directory.data?.data.faculty).filter(
    (person) => person.id !== faculty.id,
  )

  function go(n: number) {
    setStep((current) => ({ n, dir: n >= current.n ? 1 : -1 }))
  }

  function changeWeek(direction: number) {
    setWeek(addDays(week, direction * 7))
    setSelectedSlot(undefined)
  }

  function next() {
    if (step.n === 3 && !purpose.trim()) {
      setPurposeError('Add a short topic for your professor.')
      return
    }
    setPurposeError('')
    go(step.n + 1)
  }

  async function requestTime(event: FormEvent) {
    event.preventDefault()
    if (step.n !== 4) return
    if (!selectedSlot || !purpose.trim()) {
      setPurposeError('Choose an open time and add a short topic.')
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
        go(2)
        await queryClient.invalidateQueries({ queryKey: ['page', 'P15'] })
      }
    }
  }

  const dist = reduce ? 0 : 36
  const slide: Variants = {
    enter: (dir: number) => ({ opacity: 0, x: dir * dist }),
    center: { opacity: 1, x: 0 },
    exit: (dir: number) => ({ opacity: 0, x: -dir * dist }),
  }

  return (
    <>
      <PageHeader
        crumbs={[
          { label: 'Consultations', href: '/consultations' },
          { label: faculty.name },
        ]}
        title={`Book ${faculty.name}`}
      />
      <div className="accs-stack accs-stagger">
        <div className="bk-stepper">
          <div className="bk-steps__track" aria-hidden>
            <motion.span
              className="bk-steps__fill"
              initial={false}
              animate={{ scaleX: (step.n - 1) / (bookingSteps.length - 1) }}
              transition={{ duration: reduce ? 0 : 0.5, ease }}
            />
          </div>
          <ol className="bk-steps" aria-label="Booking steps">
            {bookingSteps.map((label, index) => {
              const n = index + 1
              const state =
                n < step.n ? 'done' : n === step.n ? 'current' : 'todo'
              return (
                <li key={label} data-state={state}>
                  <button
                    type="button"
                    className="bk-step"
                    disabled={n >= step.n}
                    aria-current={n === step.n ? 'step' : undefined}
                    onClick={() => go(n)}
                  >
                    <span className="bk-step__dot">
                      {state === 'current' && (
                        <motion.span
                          layoutId="bk-ring"
                          className="bk-step__ring"
                          transition={
                            reduce
                              ? { duration: 0 }
                              : { type: 'spring', stiffness: 420, damping: 32 }
                          }
                        />
                      )}
                      {state === 'done' ? <Icon name="check" size={16} /> : n}
                    </span>
                    <span className="bk-step__label">{label}</span>
                  </button>
                </li>
              )
            })}
          </ol>
        </div>
        <div className="accs-split">
          <form className="bk-main" onSubmit={requestTime}>
            <AnimatePresence mode="wait" initial={false} custom={step.dir}>
              <motion.div
                key={step.n}
                custom={step.dir}
                variants={slide}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: reduce ? 0 : 0.24, ease }}
              >
                {step.n === 1 && (
                  <section>
                    <h2 className="bk-title">Choose a professor</h2>
                    <div className="sc-faclist">
                      <FacultyCard
                        person={faculty}
                        selected
                        nextSlot={firstOpen}
                      />
                      {others.map((person) => (
                        <FacultyCard key={person.id} person={person} />
                      ))}
                    </div>
                  </section>
                )}
                {step.n === 2 && (
                  <Panel
                    title="Pick a time"
                    action={
                      <span className="bk-week">
                        <IconButton
                          icon="caret-left"
                          label="Previous week"
                          onPress={() => changeWeek(-1)}
                        />
                        <span className="bk-week__label">{weekLabel(week)}</span>
                        <IconButton
                          icon="caret-right"
                          label="Next week"
                          onPress={() => changeWeek(1)}
                        />
                      </span>
                    }
                  >
                    {conflict && (
                      <Alert tone="danger" title="That time was just taken">
                        Pick another time.
                      </Alert>
                    )}
                    {!openCount && (
                      <Empty
                        title="No open times this week"
                        action={
                          <Button
                            variant="secondary"
                            href={`/messages?recipient=${encodeURIComponent(faculty.id)}`}
                          >
                            Message professor
                          </Button>
                        }
                      >
                        Try another week, or message the professor.
                      </Empty>
                    )}
                    <div className="bk-days">
                      {groups.map((group) => (
                        <section className="bk-day" key={group.date}>
                          <h3 className="bk-day__title">
                            {dayHeading(group.date)}
                          </h3>
                          <div
                            className="bk-slots"
                            role="group"
                            aria-label={`Times on ${formatDate(group.date)}`}
                          >
                            {group.slots.map((slot) => {
                              const open = slot.state === 'open'
                              const active = selectedSlot === slot.id
                              return (
                                <motion.button
                                  type="button"
                                  key={slot.id}
                                  className="bk-slot"
                                  data-state={slot.state}
                                  disabled={!open}
                                  aria-pressed={active}
                                  whileTap={open ? { scale: 0.95 } : undefined}
                                  onClick={() => setSelectedSlot(slot.id)}
                                >
                                  {active && (
                                    <motion.span
                                      layoutId="bk-thumb"
                                      className="bk-slot__thumb"
                                      transition={
                                        reduce
                                          ? { duration: 0 }
                                          : {
                                              type: 'spring',
                                              stiffness: 520,
                                              damping: 30,
                                            }
                                      }
                                    />
                                  )}
                                  <span className="bk-slot__time">
                                    {formatClock(slot.start)}
                                  </span>
                                  {!open && (
                                    <span className="bk-slot__label">
                                      {slot.state === 'unavailable'
                                        ? 'Unavailable'
                                        : slot.state === 'requested'
                                          ? 'Requested'
                                          : 'Booked'}
                                    </span>
                                  )}
                                </motion.button>
                              )
                            })}
                          </div>
                        </section>
                      ))}
                    </div>
                    <p className="accs-meta">Campus time. Each slot is 30 minutes unless noted.</p>
                  </Panel>
                )}
                {step.n === 3 && (
                  <Panel title="What do you want to discuss?">
                    {chosen && (
                      <p className="bk-recap">
                        <Icon name="clock" size={16} />
                        {slotTime(chosen)}
                      </p>
                    )}
                    <TextArea
                      label="Topic"
                      value={purpose}
                      onChange={(value) => {
                        setPurpose(value)
                        setPurposeError('')
                      }}
                      maxLength={300}
                      showCount
                      isRequired
                      isInvalid={Boolean(purposeError)}
                      errorMessage={purposeError}
                    />
                  </Panel>
                )}
                {step.n === 4 && (
                  <Panel title="Confirm your request">
                    <dl className="sc-facts">
                      <div>
                        <dt>Professor</dt>
                        <dd>{faculty.name}</dd>
                      </div>
                      <div>
                        <dt>Date and time</dt>
                        <dd>{chosen ? slotTime(chosen) : '—'}</dd>
                      </div>
                      <div className="sc-facts__wide">
                        <dt>Topic</dt>
                        <dd>{purpose.trim() || '—'}</dd>
                      </div>
                    </dl>
                    <Alert
                      tone="neutral"
                      title="Your professor still has to approve"
                    >
                      The request stays Requested until then. Check its status before you go.
                    </Alert>
                    {purposeError && (
                      <Alert tone="danger" title="Check your request">
                        {purposeError}
                      </Alert>
                    )}
                    {!conflict && <ActionError error={action.error} />}
                  </Panel>
                )}
              </motion.div>
            </AnimatePresence>
            <div className="bk-actions">
              {step.n > 1 ? (
                <Button variant="secondary" onPress={() => go(step.n - 1)}>
                  Back
                </Button>
              ) : (
                <span />
              )}
              {step.n < 4 ? (
                <Button
                  iconEnd="arrow-right"
                  isDisabled={step.n === 2 && !selectedSlot}
                  onPress={next}
                >
                  Continue
                </Button>
              ) : (
                <Button
                  type="submit"
                  loading={action.isPending}
                  isDisabled={!selectedSlot}
                >
                  Request this time
                </Button>
              )}
            </div>
          </form>
          <Panel title="Professor">
            <div className="sc-profile">
              <Avatar name={faculty.name} size="lg" />
              <div>
                <strong>{faculty.name}</strong>
                <p className="accs-meta">{faculty.title ?? 'Faculty'}</p>
              </div>
            </div>
            <dl className="sc-facts sc-facts--stack">
              {faculty.office && (
                <div>
                  <dt>Office</dt>
                  <dd>{faculty.office}</dd>
                </div>
              )}
              {faculty.email && (
                <div>
                  <dt>Email</dt>
                  <dd>{faculty.email}</dd>
                </div>
              )}
              <div>
                <dt>Open times this week</dt>
                <dd>{openCount}</dd>
              </div>
            </dl>
          </Panel>
        </div>
      </div>
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
      <PageHeader
        crumbs={[
          { label: 'Consultations', href: '/consultations' },
          { label: formatDate(consultation.slot.date) },
        ]}
        title={
          faculty
            ? `Request from ${consultation.student.name}`
            : `Consultation with ${consultation.faculty.name}`
        }
        description={slotTime(consultation.slot)}
        actions={<StatusBadge status={consultation.status} />}
      />
      <div className="accs-stack accs-stagger">
        {next.length > 0 && (
          <Panel
            className="sc-actionbar"
            title={faculty ? 'Respond to this request' : 'Manage this request'}
          >
            <ActionError
              error={action.error}
              title={
                action.error instanceof ApiError && action.error.status === 409
                  ? "This time can't be changed"
                  : undefined
              }
            />
            <div className="sc-actionbar__buttons">
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
            </div>
            {/* TBD(D-04): cancellation notice periods and rescheduling rules are not approved. */}
            {next.includes('Cancelled') && (
              <p className="accs-meta">
                Cancelling needs a reason, and the reason stays in the request history. To reschedule, book a new open time.
              </p>
            )}
          </Panel>
        )}
        <div className="accs-split">
          <div className="accs-stack">
            <Panel title="Details">
              <dl className="sc-facts">
                <div>
                  <dt>Date and time</dt>
                  <dd>{slotTime(consultation.slot)}</dd>
                </div>
                <div>
                  <dt>Requested at</dt>
                  <dd>{formatDateTime(consultation.createdAt)}</dd>
                </div>
                <div className="sc-facts__wide">
                  <dt>Topic</dt>
                  <dd>{consultation.purpose}</dd>
                </div>
                <div>
                  <dt>Last decision</dt>
                  <dd>
                    {consultation.history.length > 1
                      ? formatDateTime(latest?.at)
                      : 'Awaiting decision'}
                  </dd>
                </div>
                <div>
                  <dt>Reason or update</dt>
                  <dd>{latest?.note || '—'}</dd>
                </div>
              </dl>
            </Panel>
            <Panel title="Request history">
              <ol
                className="accs-timeline sc-tl"
                aria-label="Consultation request history"
              >
                {consultation.history.map((entry, index) => (
                  <li key={`${entry.at}-${index}`}>
                    <div className="sc-tl__head">
                      <StatusBadge status={entry.status} />
                      <span className="accs-timeline__time">
                        {formatDateTime(entry.at)} ·{' '}
                        {entry.actorId === consultation.facultyId
                          ? 'Professor'
                          : 'Requesting student'}
                      </span>
                    </div>
                    {entry.note && <p className="sc-tl__note">{entry.note}</p>}
                  </li>
                ))}
              </ol>
            </Panel>
          </div>
          <Panel flush title="People">
            <ul className="accs-rows">
              {[
                { person: consultation.student, role: 'Student' },
                { person: consultation.faculty, role: 'Professor' },
              ].map(({ person, role }) => (
                <li key={role}>
                  <div className="accs-row accs-row--people">
                    <Avatar name={person.name} />
                    <span>
                      <span className="accs-row__title">{person.name}</span>
                      <span className="accs-row__sub">
                        {role}
                        {person.title ? ` · ${person.title}` : ''}
                      </span>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
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
            <p>The student and the professor can both see this reason.</p>
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

const slotStateLabel: Record<Slot['state'], string> = {
  open: 'Available',
  unavailable: 'Unavailable',
  requested: 'Requested',
  booked: 'Booked',
}

function AvailabilityPage({ page }: { page: PageEnvelope }) {
  const action = useScheduleAction('P17')
  const reduce = useReducedMotion()
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
  const weekEnd = addDays(week, 7)
  const weekSlots = slots
    .filter((slot) => slot.date >= week && slot.date < weekEnd)
    .sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`))
  const count = (...states: Slot['state'][]) =>
    weekSlots.filter((slot) => states.includes(slot.state)).length
  const booked =
    selectedSlot && ['booked', 'requested'].includes(selectedSlot.state)
  const selectedRequest = consultations.find(
    (consultation) =>
      consultation.slotId === selectedSlot?.id &&
      !['Completed', 'Declined', 'Cancelled'].includes(consultation.status),
  )
  const events: CalendarEvent[] = weekSlots.map((slot) => ({
    id: slot.id,
    date: slot.date,
    start: slot.start,
    end: slot.end,
    time: slotRange(slot),
    title:
      slot.state === 'open'
        ? 'Available'
        : slot.state === 'unavailable'
          ? 'Unavailable'
          : 'Consultation request',
    type: slotStateLabel[slot.state],
    tone:
      slot.state === 'open'
        ? 'open'
        : slot.state === 'unavailable'
          ? 'unavailable'
          : 'consult',
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
      setFieldError(`Overlaps ${slotRange(overlap)}.`)
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
      <div className="sc-detail">
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
      <PageHeader
        title="My availability"
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
      <div className="accs-stack accs-stagger">
        <p className="accs-meta" aria-live="polite">
          This week: {count('open')} open, {count('requested', 'booked')}{' '}
          requested or booked, {count('unavailable')} unavailable.
        </p>
        <div className="sc-bar">
          <div className="sc-bar__nav">
            <IconButton
              icon="caret-left"
              label="Previous week"
              onPress={() => setWeek(addDays(week, -7))}
            />
            <Button
              variant="secondary"
              size="sm"
              onPress={() => setWeek(weekStart(today()))}
            >
              This week
            </Button>
            <IconButton
              icon="caret-right"
              label="Next week"
              onPress={() => setWeek(addDays(week, 7))}
            />
            <h2 className="sc-bar__label" aria-live="polite">
              {weekLabel(week)}
            </h2>
          </div>
          <Segmented
            id="availability-view"
            label="Availability view"
            value={view}
            onChange={setView}
            items={[
              { id: 'week', label: 'Week' },
              { id: 'list', label: 'List' },
            ]}
          />
        </div>
        <Panel flush aria-label="Availability">
          {view === 'week' ? (
            <>
              <EventCalendar
                date={week}
                view="week"
                label="My consultation availability"
                events={events}
                startHour={6}
                endHour={20}
                onEventPress={(event) =>
                  setSelectedSlot(slots.find((slot) => slot.id === event.id))
                }
              />
              {!weekSlots.length && (
                <Empty title="No availability posted this week">
                  Add open or unavailable times to fill it in.
                </Empty>
              )}
            </>
          ) : weekSlots.length ? (
            <ul className="sc-rows">
              <AnimatePresence initial={false}>
                {weekSlots.map((slot) => {
                  const locked = ['booked', 'requested'].includes(slot.state)
                  return (
                    <motion.li
                      key={slot.id}
                      layout={!reduce}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.24, ease }}
                    >
                      <div className="accs-row sc-slotrow">
                        <DateTile value={slot.date} />
                        <span>
                          <span className="accs-row__title">
                            {slotRange(slot)}
                          </span>
                          <span className="accs-row__sub">
                            {dayHeading(slot.date)}
                          </span>
                        </span>
                        <span className="sc-slotrow__actions">
                          <span
                            className="ec-badge"
                            data-etone={
                              slot.state === 'open'
                                ? 'open'
                                : slot.state === 'unavailable'
                                  ? 'unavailable'
                                  : 'consult'
                            }
                          >
                            {slotStateLabel[slot.state]}
                          </span>
                          {locked ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              onPress={() => setSelectedSlot(slot)}
                            >
                              View
                            </Button>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                variant="secondary"
                                isDisabled={action.isPending}
                                onPress={() => void changeSlot(slot)}
                              >
                                {slot.state === 'open'
                                  ? 'Mark unavailable'
                                  : 'Mark available'}
                              </Button>
                              <IconButton
                                icon="x"
                                label={`Delete ${slotTime(slot)}`}
                                onPress={() => void changeSlot(slot, true)}
                              />
                            </>
                          )}
                        </span>
                      </div>
                    </motion.li>
                  )
                })}
              </AnimatePresence>
            </ul>
          ) : (
            <Empty title="No availability posted this week">
              Add open or unavailable times to fill it in.
            </Empty>
          )}
        </Panel>
        <ActionError error={action.error} />
        {/* TBD(D-04): external calendar sync, recurrence and booking-change policy are not approved. */}
        <p className="accs-meta">
          Changes apply in ACCS only. Calendar sync and recurring times are not available yet.
        </p>
      </div>
      <Modal title="Add times" isOpen={addOpen} onOpenChange={setAddOpen}>
        <form onSubmit={saveTimes}>
          <ModalBody>
            <div className="app-page">
              <DatePicker
                label="Date"
                isRequired
                onChange={(value) => setDate(value?.toString() ?? '')}
              />
              <div className="sc-timepair">
                <Select
                  label="Start"
                  selectedKey={start}
                  onSelectionChange={(key) => setStart(String(key))}
                >
                  {times.map((time) => (
                    <SelectOption key={time} id={time}>
                      {formatClock(time)}
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
                      {formatClock(time)}
                    </SelectOption>
                  ))}
                </Select>
              </div>
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
                description="Recurring times are not available yet."
              >
                <Radio value="once">Once</Radio>
                <Radio value="weekly" isDisabled>
                  Weekly until the end of term
                </Radio>
              </RadioGroup>
              <Alert tone="neutral" title="Students see changes immediately">
                To change a requested or booked time, cancel the consultation first.
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
            ? 'This time is booked'
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
              <div className="sc-detail">
                <p>{slotTime(selectedSlot)}</p>
                <p>
                  The consultation stays on both calendars until you cancel it.
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
    return <ViewState kind="loading" title="Loading" />
  if (page.pageId === 'P13')
    return <CalendarPage page={page} session={session.data} />
  if (page.pageId === 'P14')
    return <ConsultationsPage page={page} session={session.data} />
  if (page.pageId === 'P15') return <FacultyTimesPage page={page} />
  if (page.pageId === 'P16')
    return <RequestPage page={page} session={session.data} />
  return <AvailabilityPage page={page} />
}
