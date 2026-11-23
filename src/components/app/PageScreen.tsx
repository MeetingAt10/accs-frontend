import { Icon, type IconName } from '@meetingat10/design-system/react'
import { useQuery } from '@tanstack/react-query'
import { useParams, useRouterState } from '@tanstack/react-router'
import { useState, type ReactNode } from 'react'

import { ApiError, type PageEnvelope } from '@/lib/api'
import { categoryText } from '@/lib/concern-categories'
import { formatDate, initials, relativeTime } from '@/lib/format'
import { pageIdForPath, pageTitles } from '@/lib/page-catalog'
import { keepFilteredPage, pageQuery, sessionQuery } from '@/lib/queries'
import { RequirePermission, RestrictedView, RetryView } from '@/components/app/guards'
import { GrievancePage } from '@/components/app/grievance'
import { dashboardStats } from '@/components/app/community-home'
import { GettingStarted } from '@/components/app/getting-started'
import { QuickAccess } from '@/components/app/module-picker'
import { CommunityPage } from '@/components/app/community'
import { SchedulePage } from '@/components/app/schedule'
import { DateTile, Empty, Kpi, Kpis, PageHeader, Panel, StatusChip, toneFor } from '@/components/app/page-shell'
import { Counter, SlidePills, SwapView } from '@/components/app/portal-motion'
import { NavLink as Go } from '@/components/app/site-chrome'
import { PageSkeleton } from '@/components/app/skeleton-page'
import { StageChip, StageProgress } from '@/components/app/stage-chip'
import { roleLabelOf } from '@/lib/role-labels'

import './home.css'

type Item = Record<string, unknown>

function asItem(value: unknown): Item | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Item : undefined
}

function asItems(value: unknown): Item[] {
  return Array.isArray(value) ? value.map(asItem).filter((item): item is Item => Boolean(item)) : []
}

function text(value: unknown, fallback = '') {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : fallback
}

/** Name from a string or a { name } author object. */
function nameOf(value: unknown, fallback = '') {
  return text(asItem(value)?.name, text(value, fallback))
}

/** "08:00" -> "8:00 AM". */
function clock(value: unknown) {
  const match = /^(\d{1,2}):(\d{2})/.exec(text(value))
  if (!match) return ''
  const hour = Number(match[1])
  return `${hour % 12 || 12}:${match[2]} ${hour < 12 ? 'AM' : 'PM'}`
}

const dayKey = (value: unknown) => text(value).slice(0, 10)
const manilaToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })

function greeting() {
  const hour = Number(new Intl.DateTimeFormat('en-PH', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Manila' }).format(new Date()))
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
}

function firstName(name: string) {
  return name.replace(/^(Prof\.|Dr\.)\s+/, '').split(/\s+/)[0] ?? ''
}

/** True when the signed-in role may open the page that owns this path. Never link to pages a role cannot open. */
function useAllow() {
  const session = useQuery(sessionQuery())
  const pages = session.data?.allowedPages ?? []
  return (href: string) => {
    const id = pageIdForPath(href.split(/[?#]/)[0])
    return Boolean(id) && pages.includes(id as string)
  }
}

/** Panel header link, only when the role may open the target. */
function PanelLink({ href, children }: { href: string; children: ReactNode }) {
  const allow = useAllow()
  return allow(href) ? <Go className="accs-panel__link hm-link" href={href}>{children}<Icon name="caret-right" size={16} /></Go> : null
}

/** One list row. Becomes a link only when the role may open `href`. */
function Entry({
  href,
  lead,
  side,
  className,
  children,
}: {
  href?: string
  lead?: ReactNode
  side?: ReactNode
  className?: string
  children: ReactNode
}) {
  const allow = useAllow()
  const linked = Boolean(href && allow(href))
  const classes = ['accs-row', !lead && 'pt-row--2', className].filter(Boolean).join(' ')
  const body = (
    <>
      {lead}
      <div className="pt-row__body">{children}</div>
      {side ?? (linked ? <span className="pt-row__go"><Icon name="caret-right" size={16} /></span> : null)}
    </>
  )
  return <li>{linked ? <Go className={classes} href={href as string}>{body}</Go> : <div className={classes}>{body}</div>}</li>
}

const Rows = ({ children }: { children: ReactNode }) => <ul className="accs-rows">{children}</ul>

function Sub({ children }: { children: ReactNode }) {
  return <p className="pt-row__sub">{children}</p>
}

function kpiTarget(label: string) {
  if (/queue/i.test(label)) return '/cases'
  if (/report|case/i.test(label)) return '/reports'
  if (/appoint|consult/i.test(label)) return '/consultations'
  if (/evaluation/i.test(label)) return '/evaluations'
  if (/unread|update|notification/i.test(label)) return '/notifications'
  if (/event|calendar/i.test(label)) return '/calendar'
  return undefined
}

/** The office a role works a case as, so Home can mark the cases waiting on this person. */
const ownStage: Record<string, string> = { professor: 'adviser', chair: 'chair', dean: 'dean', guidance: 'guidance', osas: 'osas' }

/** "Today", "Oct 20", or "Oct 20, 2025" for another year, in Manila time. */
function shortDay(value: unknown) {
  const date = new Date(text(value))
  if (Number.isNaN(date.getTime())) return ''
  const day = date.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
  const today = manilaToday()
  if (day === today) return 'Today'
  return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', ...(day.slice(0, 4) === today.slice(0, 4) ? {} : { year: 'numeric' }), timeZone: 'Asia/Manila' })
}

/** Severity as the design's colored "High priority" text; nothing when the record does not carry one. */
function Priority({ value }: { value: unknown }) {
  const level = text(value).toLowerCase()
  if (!['low', 'medium', 'high'].includes(level)) return null
  return <span className="hm-case__priority" data-level={level}>{level[0].toUpperCase() + level.slice(1)} priority</span>
}

/**
 * One case-queue row (Figma "Case queue"): title, reference and priority, then the five-office progress, the office chip,
 * the last update and a chevron. A row for a case waiting on this person is tinted. Students' own reports pass `status`
 * instead, since their progress is told in steps, not offices.
 */
function CaseRow({ item, route, mine, status }: { item: Item; route: string; mine?: boolean; status?: boolean }) {
  const allow = useAllow()
  const id = text(item.id)
  const href = route + encodeURIComponent(id)
  const linked = Boolean(id) && allow(href)
  const stage = /^(resolved|closed)$/i.test(text(item.status)) ? 'resolved' : text(item.stage, 'adviser')
  const when = item.updatedAt ?? item.createdAt
  const body = (
    <>
      <span className="hm-case__main">
        <span className="hm-case__title">{categoryText(item)}</span>
        <span className="hm-case__meta">
          <span>{text(item.caseFileId, id || '—')}</span>
          {text(item.severity) && <span aria-hidden>·</span>}
          <Priority value={item.severity} />
          {mine && <span className="pt-sr"> · waiting on you</span>}
        </span>
      </span>
      {status ? (
        <span className="hm-case__chip"><StatusChip tone={toneFor(text(item.status, 'Submitted'))}>{text(item.status, 'Submitted')}</StatusChip></span>
      ) : (
        <>
          <span className="hm-case__progress"><StageProgress stage={stage} /></span>
          <span className="hm-case__chip"><StageChip stage={stage} /></span>
        </>
      )}
      <span className="hm-case__date">{shortDay(when) && <time dateTime={text(when)}>{shortDay(when)}</time>}</span>
      <span className="hm-case__go" aria-hidden>{linked && <Icon name="caret-right" size={16} />}</span>
    </>
  )
  return (
    <li>
      {linked ? <Go className="hm-case" data-mine={mine || undefined} href={href}>{body}</Go> : <div className="hm-case" data-mine={mine || undefined}>{body}</div>}
    </li>
  )
}

/** The Home summary-card labels, worded for what each count is. */
const statLabels: Record<string, string> = { Appointments: 'Open appointments' }

/** Both Home columns: the main one (cases, events, posts) and the 380px side one (announcements, quick access, the rest). */
function DashboardPanel({ data, role, quick }: { data: Item; role: string; quick?: ReactNode }) {
  const allow = useAllow()
  const session = useQuery(sessionQuery())
  const me = session.data?.user.id
  const stats = dashboardStats(asItems(data.stats), role)
  // Each list on the home shows its five newest items; "View all" opens the rest.
  const top = (items: Item[]) => items.slice(0, 5)
  const announcements = top(asItems(data.announcements))
  // A post already listed as an announcement is not repeated under "From your spaces".
  const announced = new Set(asItems(data.announcements).map((item) => text(item.id)))
  const posts = top(asItems(data.posts).filter((item) => !announced.has(text(item.id))))
  const reports = top(asItems(data.reports))
  const cases = top(asItems(data.cases))
  const sections: Item[] = []
  const consultations = top(asItems(data.consultations))
  const assignments = asItems(data.assignments)
  const today = manilaToday()
  const events = asItems(data.events)
    .filter((event) => dayKey(event.date) >= today)
    .sort((a, b) => dayKey(a.date).localeCompare(dayKey(b.date)) || text(a.start).localeCompare(text(b.start)))
    .slice(0, 3)
  const submitted = assignments.filter((item) => /submitted/i.test(text(item.status))).length
  const caseTitle = role === 'professor' ? 'Assigned reports' : 'Case queue'
  const empty =
    reports.length + cases.length + sections.length + consultations.length + announcements.length + posts.length +
      events.length + assignments.length === 0

  return (
    <div className="hm-body">
      {stats.length > 0 && (
        <Kpis label="Overview">
          {stats.map((stat, index) => {
            const label = text(stat.label, 'Overview')
            const target = kpiTarget(label)
            const note = text(stat.note, text(stat.change))
            return (
              <Kpi
                key={text(stat.id, label + index)}
                label={statLabels[label] ?? label}
                value={<Counter value={stat.value} />}
                note={note || undefined}
                href={target && allow(target) ? target : undefined}
              />
            )
          })}
        </Kpis>
      )}
      <div className="hm-cols">
        <div className="hm-col accs-stagger">
          {empty && (
            <Panel>
              <Empty title="Nothing here yet">Reports, events, and announcements for your role show up here once they exist.</Empty>
            </Panel>
          )}
          {cases.length > 0 && (
            <Panel flush className="hm-queue" title={caseTitle} action={<PanelLink href="/cases">Open queue</PanelLink>}>
              <p className="hm-queue__lede">Where each concern in your queue stands right now.</p>
              <ul className="hm-cases" role="list">
                {cases.map((item, index) => (
                  <CaseRow key={text(item.id, 'case-' + index)} item={item} route="/cases/" mine={Boolean(ownStage[role]) && text(item.stage) === ownStage[role] && !/^(resolved|closed)$/i.test(text(item.status))} />
                ))}
              </ul>
            </Panel>
          )}
          {reports.length > 0 && (
            <Panel flush className="hm-queue" title="My reports" action={<PanelLink href="/reports">View all</PanelLink>}>
              <ul className="hm-cases" role="list">
                {reports.map((item, index) => (
                  <CaseRow key={text(item.id, 'report-' + index)} item={item} route="/reports/" status />
                ))}
              </ul>
            </Panel>
          )}
          {events.length > 0 && (
            <Panel
              flush
              title={events.every((event) => dayKey(event.date) === today) ? 'Today' : 'Coming up'}
              action={<PanelLink href="/calendar">Open calendar</PanelLink>}
            >
              <Rows>
                {events.map((item, index) => {
                  const time = [clock(item.start), clock(item.end)].filter(Boolean).join(' – ')
                  return (
                    // An appointment schedule opens Appointments, not the calendar (QA 17 November).
                    <Entry key={text(item.id, 'event-' + index)} lead={<DateTile value={item.date} />} href={/appoint|consult/i.test(`${text(item.title)} ${text(item.category)} ${text(item.kind)}`) && allow('/consultations') ? '/consultations' : '/calendar'}>
                      <p className="pt-row__title">{text(item.title, 'Campus event')}</p>
                      <Sub>
                        {time && <span className="pt-time">{time}</span>}
                        {text(item.place, text(item.location)) && <span>{text(item.place, text(item.location))}</span>}
                      </Sub>
                    </Entry>
                  )
                })}
              </Rows>
            </Panel>
          )}
          {posts.length > 0 && (
            <Panel
              flush
              title={role === 'organization' ? 'Discussion' : 'From your spaces'}
              action={<PanelLink href={role === 'organization' ? '/organizations' : '/feed'}>View all</PanelLink>}
            >
              <Rows>
                {posts.map((item, index) => {
                  const author = nameOf(item.author, 'ACCS member')
                  const replies = Number(item.commentCount ?? item.replies ?? 0)
                  return (
                    <Entry
                      key={text(item.id, 'post-' + index)}
                      lead={<span className="accs-avatar" aria-hidden>{initials(author)}</span>}
                      href={'/feed/' + encodeURIComponent(text(item.id))}
                      side={
                        <span className="pt-row__side">
                          <span>{relativeTime(item.at)}</span>
                          <span className="pt-row__count"><Icon name="chat" size={16} />{replies}<span className="pt-sr"> replies</span></span>
                        </span>
                      }
                    >
                      <p className="pt-row__title">{text(item.title, 'Class discussion')}</p>
                      <Sub>
                        <span>{author}</span>
                        {text(item.label) && <span className="accs-tag">{text(item.label)}</span>}
                      </Sub>
                    </Entry>
                  )
                })}
              </Rows>
            </Panel>
          )}
          {sections.length > 0 && (
            <Panel flush title="Your sections" action={<PanelLink href="/spaces">View sections</PanelLink>}>
              <Rows>
                {sections.map((item, index) => (
                  <Entry
                    key={text(item.id, 'section-' + index)}
                    lead={<span className="accs-avatar" aria-hidden><Icon name="chalkboard" size={16} /></span>}
                    href={'/spaces/' + encodeURIComponent(text(item.id))}
                  >
                    <p className="pt-row__title">{text(item.title, text(item.name, 'Class section'))}</p>
                    <Sub>{[text(item.subject, text(item.detail)), text(item.program)].filter(Boolean).join(' · ')}</Sub>
                  </Entry>
                ))}
              </Rows>
            </Panel>
          )}
        </div>
        <aside className="hm-col hm-side accs-stagger">
          {announcements.length > 0 && (
            <Panel title="Announcements" className="hm-news" action={<PanelLink href="/feed">View feed</PanelLink>}>
              <ul className="hm-news__list" role="list">
                {announcements.map((item, index) => {
                  // Urgent and Important show their own colored tag (QA 19 November).
                  const priority = text(item.priority)
                  const href = text(item.id) ? '/feed/' + encodeURIComponent(text(item.id)) : '/feed'
                  const author = nameOf(item.author, text(item.source))
                  const when = item.at ?? item.date
                  const body = (
                    <>
                      <span className="hm-news__icon" aria-hidden><Icon name="megaphone" size={16} /></span>
                      <span className="hm-news__body">
                        <span className="hm-news__title">{text(item.title, 'Announcement')}</span>
                        <span className="hm-news__meta">
                          {(priority === 'urgent' || priority === 'high') && <StatusChip tone="danger">Urgent</StatusChip>}
                          {priority === 'important' && <StatusChip tone="warn">Important</StatusChip>}
                          <span>{[author, shortDay(when)].filter(Boolean).join(' · ')}</span>
                        </span>
                      </span>
                    </>
                  )
                  return (
                    <li key={text(item.id, 'announcement-' + index)}>
                      {allow(href) ? <Go className="hm-news__row" href={href}>{body}</Go> : <div className="hm-news__row">{body}</div>}
                    </li>
                  )
                })}
              </ul>
            </Panel>
          )}
          {quick}
          {consultations.length > 0 && (
            <Panel flush title="Appointments" action={<PanelLink href="/consultations">View all</PanelLink>}>
              <Rows>
                {consultations.map((item, index) => {
                  const student = asItem(item.student)
                  const other = student && text(student.id) === me ? asItem(item.faculty) : student ?? asItem(item.faculty)
                  const slot = asItem(item.slot)
                  const status = text(item.status, 'Requested')
                  return (
                    <Entry key={text(item.id, 'appointment-' + index)} href={'/consultations/requests/' + encodeURIComponent(text(item.id))}>
                      <p className="pt-row__title">{text(item.title) || (other?.name ? 'With ' + text(other.name) : text(item.purpose, 'Appointment'))}</p>
                      <Sub>
                        <StatusChip tone={toneFor(status)}>{status}</StatusChip>
                        {slot && <span>{[formatDate(slot.date), clock(slot.start)].filter(Boolean).join(', ')}</span>}
                      </Sub>
                    </Entry>
                  )
                })}
              </Rows>
            </Panel>
          )}
          {assignments.length > 0 && (
            <Panel flush title="Evaluations due" action={<PanelLink href="/evaluations">Open evaluations</PanelLink>}>
              <div className="pt-progress">
                <p><strong>{submitted} of {assignments.length} submitted</strong><span className="accs-num">{Math.round((submitted / assignments.length) * 100)}%</span></p>
                <div className="accs-progress" role="progressbar" aria-label="Evaluations submitted" aria-valuemin={0} aria-valuemax={assignments.length} aria-valuenow={submitted}>
                  <span style={{ width: (submitted / assignments.length) * 100 + '%' }} />
                </div>
              </div>
              <Rows>
                {assignments.map((item, index) => {
                  const status = text(item.status, 'Not started')
                  return (
                    <Entry key={text(item.id, 'assignment-' + index)} href="/evaluations">
                      <p className="pt-row__title">{text(item.cycleTitle, text(item.title, 'Evaluation'))}</p>
                      <Sub>
                        <StatusChip tone={toneFor(status)}>{status}</StatusChip>
                        {nameOf(item.faculty) && <span>{nameOf(item.faculty)}</span>}
                        {text(item.due, text(item.dueDate)) && <span>Due {formatDate(item.due ?? item.dueDate)}</span>}
                      </Sub>
                    </Entry>
                  )
                })}
              </Rows>
            </Panel>
          )}
        </aside>
      </div>
    </div>
  )
}

/** One line under the greeting, from the counts the page already has: the first two that are not zero. */
function summaryLine(stats: Item[]) {
  const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`
  const parts = stats.flatMap((stat) => {
    const count = Number(stat.value)
    if (!Number.isFinite(count) || count <= 0) return []
    const label = text(stat.label)
    if (/queue/i.test(label)) return [plural(count, 'report in your queue', 'reports in your queue')]
    if (/report/i.test(label)) return [plural(count, 'active report', 'active reports')]
    if (/appoint|consult/i.test(label)) return [plural(count, 'open appointment', 'open appointments')]
    if (/evaluation/i.test(label)) return [plural(count, 'evaluation due', 'evaluations due')]
    if (/unread|update|notification/i.test(label)) return [plural(count, 'unread update', 'unread updates')]
    return []
  })
  if (!parts.length) return 'Nothing open right now.'
  const line = parts.slice(0, 2).join(' and ')
  return line[0].toUpperCase() + line.slice(1) + '.'
}

type Shortcut = { label: string; short: string; href: string; icon: IconName; when?: string[]; permission?: string }

const shortcuts: Shortcut[] = [
  { label: 'New report', short: 'Report', href: '/reports/new', icon: 'plus', when: ['student'] },
  { label: 'Book appointment', short: 'Book', href: '/consultations', icon: 'calendar', when: ['student'] },
  { label: 'Post announcement', short: 'Announce', href: '/feed/new', icon: 'megaphone', permission: 'announcement.publish' },
  { label: 'Manage availability', short: 'Availability', href: '/consultations/availability', icon: 'clock', when: ['professor'] },
  { label: 'Open case queue', short: 'Cases', href: '/cases', icon: 'list-checks', when: ['chair', 'dean', 'guidance', 'osas'] },
]

/**
 * The Home hero (Figma 02 Home "Hero", 08 Mobile Home): the program and role, the greeting, the date and a one-line summary,
 * and the role's two main actions. The first action is the white one; it sits on the right, so it comes last in the
 * markup and the tab order follows what the eye reads.
 */
function HomeHero({ pill, title, date, summary, actions }: { pill: string; title: string; date: string; summary: string; actions: Shortcut[] }) {
  return (
    <section className="hm-hero" aria-labelledby="home-title">
      <div className="hm-hero__text">
        {pill && <p className="hm-hero__pill">{pill}</p>}
        <h1 className="hm-hero__title" id="home-title">{title}</h1>
        <p className="hm-hero__line">
          <span className="hm-hero__date">{date}<span aria-hidden>  ·  </span></span>
          <span>{summary}</span>
        </p>
      </div>
      {actions.length > 0 && (
        <div className="hm-hero__actions" role="group" aria-label="Quick actions">
          {actions.map((item, index) => ({ item, primary: index === 0 })).reverse().map(({ item, primary }) => (
            <Go key={item.href} href={item.href} className="hm-hero__btn" data-primary={primary || undefined}>
              <Icon name={item.icon} size={16} />
              <span className="hm-hero__btn-long">{item.label}</span>
              <span className="hm-hero__btn-short" aria-hidden>{item.short}</span>
            </Go>
          ))}
        </div>
      )}
    </section>
  )
}

function HomeDashboard({ page }: { page: PageEnvelope }) {
  const session = useQuery(sessionQuery())
  const allow = useAllow()
  const variants = asItems(page.data.roleSections)
  const roles = session.data?.user.roles ?? []
  const panels = variants.filter((variant) => roles.some((role) => role === variant.role))
  const tabbed = roles.length > 1 && panels.length > 1
  const [selected, setSelected] = useState('')
  const active = panels.find((panel) => text(panel.role) === selected) ?? panels[0]
  const panel = (tabbed ? active : panels[0]) ?? (page.data as Item)
  const role = tabbed ? text(panel.role) : (roles[0] ?? 'student')

  const actions = shortcuts
    .filter((item) => (!item.when || item.when.some((entry) => roles.some((r) => r === entry))) && allow(item.href) && (!item.permission || session.data?.permissions.includes(item.permission) === true))
    .slice(0, 2)
  const name = firstName(session.data?.user.name ?? '')
  const date = new Date().toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'Asia/Manila' })
  const user = session.data?.user
  const pill = [user?.program ?? (role === 'dean' ? 'CCS' : ''), roleLabelOf(role)].filter(Boolean).join(' · ')
  const quick = session.data ? <QuickAccess session={session.data} /> : undefined

  return (
    <div className="hm">
      <HomeHero
        pill={pill}
        title={name ? `${greeting()}, ${name}` : greeting()}
        date={date}
        summary={summaryLine(dashboardStats(asItems(panel.stats), role))}
        actions={actions}
      />
      {tabbed && (
        <div className="hm-views">
          <SlidePills
            label="Dashboard role views"
            value={text(panel.role)}
            onChange={setSelected}
            options={panels.map((entry) => ({ id: text(entry.role), label: 'As ' + text(entry.label, text(entry.title, text(entry.role))) }))}
          />
          {text(panel.description) && <p className="pt-scope">{text(panel.description)}</p>}
        </div>
      )}
      {tabbed ? (
        <SwapView id={role}>
          <DashboardPanel data={panel} role={role} quick={quick} />
        </SwapView>
      ) : (
        <DashboardPanel data={panel} role={role} quick={quick} />
      )}
      {session.data && <GettingStarted session={session.data} />}
    </div>
  )
}

function BasicPage({ page }: { page: PageEnvelope }) {
  const entries = Object.entries(page.data).filter(([, value]) => Array.isArray(value) && value.length > 0)
  if (!entries.length) {
    return (
      <Panel>
        <Empty title="Nothing to show">No records have been added to this page.</Empty>
      </Panel>
    )
  }
  return (
    <div className="accs-stack accs-stagger">
      {entries.map(([key, value]) => (
        <Panel flush key={key} title={key.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase())}>
          <Rows>
            {asItems(value).map((item, index) => {
              const status = text(item.status)
              return (
                <Entry key={text(item.id, key + '-' + index)}>
                  <p className="pt-row__title">{text(item.title, text(item.name, text(item.reference, '—')))}</p>
                  {(status || text(item.summary)) && (
                    <Sub>
                      {status && <StatusChip tone={toneFor(status)}>{status}</StatusChip>}
                      {text(item.summary) && <span>{text(item.summary)}</span>}
                    </Sub>
                  )}
                </Entry>
              )
            })}
          </Rows>
        </Panel>
      ))}
    </div>
  )
}

export function PageScreen({ pageId }: { pageId: string }) {
  const params = useParams({ strict: false }) as Record<string, string>
  const recordId = Object.values(params).at(-1)
  const filters = useRouterState({ select: (state) => state.location.searchStr.slice(1) })
  const record = pageId === 'P03' ? undefined : recordId
  // Typing in a search box or changing a filter only changes `filters`: keep showing the page while the new results load.
  // It used to swap the whole page for "Loading page" on every key, which also threw away the search box. Another page
  // or record still starts from the loading state.
  const page = useQuery({
    ...pageQuery(pageId, record, filters),
    placeholderData: (previous, previousQuery) => keepFilteredPage(previousQuery?.queryKey, pageId, record) ? previous : undefined,
  })
  return (
    <RequirePermission pageId={pageId}>
      <div className="app-page">
        {page.isPending ? (
          <PageSkeleton pageId={pageId} />
        ) : page.isError ? (
          page.error instanceof ApiError && [403, 404].includes(page.error.status) ? (
            <RestrictedView record />
          ) : (
            <RetryView onRetry={() => void page.refetch()} />
          )
        ) : (
          ['P04', 'P05', 'P06', 'P07', 'P08', 'P09', 'P10'].includes(pageId) ? (
            <CommunityPage page={page.data} />
          ) : ['P13', 'P14', 'P15', 'P16', 'P17'].includes(pageId) ? (
            <SchedulePage page={page.data} />
          ) : ['P18', 'P19', 'P20', 'P21', 'P22'].includes(pageId) ? <GrievancePage page={page.data} /> : <>
            {pageId === 'P03'
              ? <HomeDashboard page={page.data} />
              : <div className="accs-stack">
                  <PageHeader title={page.data.title || pageTitles[pageId] || 'ACCS'} description={page.data.scope} />
                  <BasicPage page={page.data} />
                </div>}
          </>
        )}
      </div>
    </RequirePermission>
  )
}
