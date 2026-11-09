import { Alert, Button, Icon, ViewState } from '@meetingat10/design-system/react'
import { useQuery } from '@tanstack/react-query'
import { useParams, useRouterState } from '@tanstack/react-router'
import { useState, type ReactNode } from 'react'

import { ApiError, type PageEnvelope } from '@/lib/api'
import { formatDate, initials, relativeTime } from '@/lib/format'
import { pageIdForPath, pageTitles } from '@/lib/page-catalog'
import { pageQuery, sessionQuery } from '@/lib/queries'
import { RequirePermission, RestrictedView, RetryView } from '@/components/app/guards'
import { GrievancePage } from '@/components/app/grievance'
import { AboutPanel, CommunityHeader, Composer, dashboardStats, isCommunityRole } from '@/components/app/community-home'
import { GettingStarted } from '@/components/app/getting-started'
import { ModulePicker } from '@/components/app/module-picker'
import { CommunityPage } from '@/components/app/community'
import { SchedulePage } from '@/components/app/schedule'
import { DateTile, Empty, Kpi, Kpis, PageHeader, Panel, StatusChip, toneFor } from '@/components/app/page-shell'
import { Counter, SlidePills, SwapView } from '@/components/app/portal-motion'
import { NavLink as Go } from '@/components/app/site-chrome'

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
  return allow(href) ? <Go className="accs-panel__link" href={href}>{children}</Go> : null
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
  if (/consult/i.test(label)) return '/consultations'
  if (/evaluation/i.test(label)) return '/evaluations'
  if (/unread|update|notification/i.test(label)) return '/notifications'
  if (/event|calendar/i.test(label)) return '/calendar'
  return undefined
}

/** `lead` goes at the top of the main column and `intro` at the top of the side column (the community Home puts the composer and About there). */
function DashboardPanel({ data, role, lead, intro }: { data: Item; role: string; lead?: ReactNode; intro?: ReactNode }) {
  const allow = useAllow()
  const session = useQuery(sessionQuery())
  const me = session.data?.user.id
  const community = isCommunityRole(role)
  const stats = dashboardStats(asItems(data.stats), role)
  const announcements = asItems(data.announcements)
  const posts = asItems(data.posts)
  const reports = asItems(data.reports)
  const cases = asItems(data.cases)
  const sections = asItems(data.sections)
  const consultations = asItems(data.consultations)
  const todos = asItems(data.todos)
  const assignments = asItems(data.assignments)
  const notes = asItems(data.notifications)
  const today = manilaToday()
  const events = asItems(data.events)
    .filter((event) => dayKey(event.date) >= today)
    .sort((a, b) => dayKey(a.date).localeCompare(dayKey(b.date)) || text(a.start).localeCompare(text(b.start)))
    .slice(0, 5)
  const submitted = assignments.filter((item) => /submitted/i.test(text(item.status))).length
  const caseTitle = role === 'professor' ? 'Assigned reports' : 'Case queue'
  const empty =
    reports.length + cases.length + sections.length + consultations.length + announcements.length + posts.length +
      events.length + assignments.length + todos.length + notes.length === 0

  // Students and faculty have no strip of summary cards; each count sits in the title of the card it counts.
  const counted = (title: string, label: RegExp): ReactNode => {
    const stat = community ? stats.find((entry) => label.test(text(entry.label))) : undefined
    return stat ? <>{title} <span className="accs-tag">{text(stat.value)}</span></> : title
  }

  const recordRows = (items: Item[], route: string) => (
    <Rows>
      {items.map((item, index) => (
        <Entry key={text(item.id, route + index)} href={route + encodeURIComponent(text(item.id))}>
          <p className="pt-row__title">{text(item.title, text(item.category, 'General concern'))}</p>
          <Sub>
            <span className="accs-mono">{text(item.reference, text(item.id, '—'))}</span>
            <StatusChip tone={toneFor(text(item.status, 'Submitted'))}>{text(item.status, 'Submitted')}</StatusChip>
            {text(item.updatedAt) && <span>Updated {relativeTime(item.updatedAt)}</span>}
          </Sub>
        </Entry>
      ))}
    </Rows>
  )

  return (
    <div className="accs-stack">
      {stats.length > 0 && !community && (
        <Kpis label="Overview">
          {stats.map((stat, index) => {
            const label = text(stat.label, 'Overview')
            const target = kpiTarget(label)
            const note = text(stat.note, text(stat.change))
            return (
              <Kpi
                key={text(stat.id, label + index)}
                label={label}
                value={<Counter value={stat.value} />}
                note={/synthetic|demo|sample|prototype/i.test(note) ? undefined : note || undefined}
                href={target && allow(target) ? target : undefined}
              />
            )
          })}
        </Kpis>
      )}
      {empty ? (
        <div className={lead || intro ? 'accs-split' : undefined}>
          <div className="accs-stack">
            {lead}
            <Panel>
              <Empty title="Nothing here yet">Reports, events, and announcements for your role show up here once they exist.</Empty>
            </Panel>
          </div>
          {intro && <aside className="accs-stack">{intro}</aside>}
        </div>
      ) : (
        <div className="accs-split">
          <div className="accs-stack accs-stagger">
            {lead}
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
                      <Entry key={text(item.id, 'event-' + index)} lead={<DateTile value={item.date} />} href="/calendar">
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
            {announcements.length > 0 && (
              <Panel flush title="Announcements" action={<PanelLink href="/feed">View feed</PanelLink>}>
                <Rows>
                  {announcements.map((item, index) => {
                    const urgent = text(item.priority) === 'high'
                    return (
                      <Entry key={text(item.id, 'announcement-' + index)} href={text(item.id) ? '/feed/' + encodeURIComponent(text(item.id)) : '/feed'}>
                        <p className="pt-row__title">{text(item.title, 'Announcement')}</p>
                        <Sub>
                          <StatusChip tone={urgent ? 'warn' : 'neutral'}>{urgent ? 'Priority' : text(item.label, 'Announcement')}</StatusChip>
                          {nameOf(item.author, text(item.source)) && <span>{nameOf(item.author, text(item.source))}</span>}
                          {text(item.at, text(item.date)) && <span>{relativeTime(item.at ?? item.date)}</span>}
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
          <aside className="accs-stack accs-stagger">
            {intro}
            {reports.length > 0 && (
              <Panel flush title={counted('My reports', /report/i)} action={<PanelLink href="/reports">View all</PanelLink>}>
                {recordRows(reports, '/reports/')}
              </Panel>
            )}
            {cases.length > 0 && (
              <Panel flush title={caseTitle} action={<PanelLink href="/cases">Open queue</PanelLink>}>
                {recordRows(cases, '/cases/')}
              </Panel>
            )}
            {consultations.length > 0 && (
              <Panel flush title={counted('Consultations', /consult/i)} action={<PanelLink href="/consultations">View all</PanelLink>}>
                <Rows>
                  {consultations.map((item, index) => {
                    const student = asItem(item.student)
                    const other = student && text(student.id) === me ? asItem(item.faculty) : student ?? asItem(item.faculty)
                    const slot = asItem(item.slot)
                    const status = text(item.status, 'Requested')
                    return (
                      <Entry key={text(item.id, 'consultation-' + index)} href={'/consultations/requests/' + encodeURIComponent(text(item.id))}>
                        <p className="pt-row__title">{text(item.title) || (other?.name ? 'With ' + text(other.name) : text(item.purpose, 'Consultation'))}</p>
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
              <Panel flush title={counted('Evaluations due', /evaluation/i)} action={<PanelLink href="/evaluations">Open evaluations</PanelLink>}>
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
            {todos.length > 0 && (
              <Panel flush title="To do" action={<PanelLink href="/calendar">Open calendar</PanelLink>}>
                <Rows>
                  {todos.map((item, index) => {
                    const done = item.done === true || /done|complete/i.test(text(item.status))
                    return (
                      <Entry
                        key={text(item.id, 'todo-' + index)}
                        className={done ? 'pt-row--done' : undefined}
                        lead={<span className="pt-check" data-done={done} aria-hidden>{done && <Icon name="check" size={16} />}</span>}
                        side={text(item.date, text(item.dueDate)) ? <span className="pt-row__side">{formatDate(item.date ?? item.dueDate)}</span> : <span />}
                      >
                        <p className="pt-row__title">{text(item.title, 'Task')}<span className="pt-sr">{done ? ' (done)' : ''}</span></p>
                      </Entry>
                    )
                  })}
                </Rows>
              </Panel>
            )}
            {notes.length > 0 && (
              <Panel title="Recent updates" action={<PanelLink href="/notifications">View all</PanelLink>}>
                <ol className="accs-timeline">
                  {notes.map((item, index) => (
                    <li key={text(item.id, 'notice-' + index)}>
                      {allow('/notifications') ? <Go href="/notifications" className="pt-timeline__link">{text(item.title, 'Account update')}</Go> : <span className="pt-timeline__link">{text(item.title, 'Account update')}</span>}
                      <span className="accs-timeline__time">{relativeTime(item.at)}</span>
                    </li>
                  ))}
                </ol>
              </Panel>
            )}
            {/* Staff content beyond CCS-wide material is still being defined (D-06). */}
            {role === 'staff' && (
              <Alert tone="neutral" title="Staff view">
                Staff see CCS-wide material.
              </Alert>
            )}
          </aside>
        </div>
      )}
    </div>
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

  const shortcuts: { label: string; href: string; icon: 'plus' | 'calendar' | 'megaphone' | 'list-checks' | 'clock'; when?: string[] }[] = [
    { label: 'New report', href: '/reports/new', icon: 'plus', when: ['student'] },
    { label: 'Book consultation', href: '/consultations', icon: 'calendar', when: ['student'] },
    { label: 'Post announcement', href: '/feed/new', icon: 'megaphone' },
    { label: 'Manage availability', href: '/consultations/availability', icon: 'clock', when: ['professor'] },
    { label: 'Open case queue', href: '/cases', icon: 'list-checks', when: ['chair', 'dean', 'guidance', 'osas', 'president'] },
  ]
  const actions = shortcuts
    .filter((item) => (!item.when || item.when.some((entry) => roles.some((r) => r === entry))) && allow(item.href))
    .slice(0, 2)
  const name = firstName(session.data?.user.name ?? '')
  const date = new Date().toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'Asia/Manila' })

  const community = isCommunityRole(role) && Boolean(session.data)
  const communityLead = community && session.data ? <Composer session={session.data} /> : undefined
  const communityIntro = community && session.data ? <AboutPanel session={session.data} /> : undefined

  return (
    <div className="accs-stack">
      {community && session.data ? (
        <CommunityHeader session={session.data} greeting={name ? `${greeting()}, ${name}` : greeting()} date={date} />
      ) : (
      <PageHeader
        title={name ? `${greeting()}, ${name}` : greeting()}
        description={[date, page.scope].filter(Boolean).join(' · ')}
        actions={
          actions.length > 0 && (
            <>
              {actions.map((item, index) => (
                <Button key={item.href} href={item.href} icon={item.icon} variant={index === 0 ? 'primary' : 'secondary'}>
                  {item.label}
                </Button>
              ))}
            </>
          )
        }
      />
      )}
      {!community && session.data && <ModulePicker session={session.data} />}
      {!community && session.data && <GettingStarted session={session.data} />}
      {tabbed && (
        <SlidePills
          label="Dashboard role views"
          value={text(panel.role)}
          onChange={setSelected}
          options={panels.map((entry) => ({ id: text(entry.role), label: 'As ' + text(entry.label, text(entry.role)) }))}
        />
      )}
      {tabbed && text(panel.description) && <p className="pt-scope">{text(panel.description)}</p>}
      {tabbed ? (
        <SwapView id={role}>
          <DashboardPanel data={panel} role={role} lead={communityLead} intro={communityIntro} />
        </SwapView>
      ) : (
        <DashboardPanel data={panel} role={role} lead={communityLead} intro={communityIntro} />
      )}
      {community && session.data && <GettingStarted session={session.data} />}
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
  const page = useQuery(pageQuery(pageId, pageId === 'P03' ? undefined : recordId, filters))
  return (
    <RequirePermission pageId={pageId}>
      <div className="app-page">
        {page.isPending ? (
          <ViewState kind="loading" title="Loading page" />
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
