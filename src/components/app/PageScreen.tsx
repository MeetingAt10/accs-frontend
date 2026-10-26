import {
  Alert,
  AnnouncementCard,
  Agenda,
  AgendaItem,
  Badge,
  Card,
  CardBody,
  CardMeta,
  CardTitle,
  EmptyState,
  Grid,
  Link,
  ReportRecord,
  SectionHeader,
  Tabs,
  Tab,
  TabList,
  TabPanel,
  ForumCard,
  ViewState,
} from '@meetingat10/design-system/react'
import { useQuery } from '@tanstack/react-query'
import { useParams, useRouterState } from '@tanstack/react-router'

import { ApiError, type PageEnvelope } from '@/lib/api'
import { pageQuery } from '@/lib/queries'
import { sessionQuery } from '@/lib/queries'
import { pageTitles } from '@/lib/page-catalog'
import { Stat } from '@/components/ds-next'
import { RequirePermission, RestrictedView, RetryView } from '@/components/app/guards'
import { GrievancePage } from '@/components/app/grievance'
import { CommunityPage } from '@/components/app/community'
import { SchedulePage } from '@/components/app/schedule'

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

function DashboardRecords({ items, kind }: { items: Item[]; kind: 'reports' | 'cases' }) {
  const route = kind === 'reports' ? '/reports/' : '/cases/'
  return (
    <div className="app-record-list">
      {items.map((item, index) => (
        <ReportRecord
          key={text(item.id, kind + '-' + index)}
          reference={text(item.reference, 'RPT-SAMPLE')}
          status={text(item.status, 'Submitted')}
          title={text(item.title, 'General concern')}
          facts={[
            { label: 'Updated', value: text(item.updatedAt, '—') },
            { label: 'Stage', value: text(item.stage, 'In review') },
          ]}
          href={route + encodeURIComponent(text(item.id))}
        />
      ))}
    </div>
  )
}

function DashboardPanel({ data, role }: { data: Item; role: string }) {
  const stats = asItems(data.stats)
  const announcements = asItems(data.announcements)
  const posts = asItems(data.posts)
  const reports = asItems(data.reports)
  const cases = asItems(data.cases)
  const sections = asItems(data.sections)
  const consultations = asItems(data.consultations)
  const events = asItems(data.events)
  const todos = asItems(data.todos)
  const assignments = asItems(data.assignments)
  const notes = asItems(data.notifications)
  const description = text(data.description)
  return (
    <div className="app-page">
      {description && <p className="app-lead">{description}</p>}
      {stats.length > 0 && (
        <Grid columns={4} className="app-stat-grid">
          {stats.map((stat, index) => (
            <Stat
              key={text(stat.id, text(stat.label, 'stat-' + index))}
              label={text(stat.label, 'Overview')}
              value={text(stat.value, '—')}
              change={text(stat.note, text(stat.change))}
              scopeNote={text(stat.scopeNote)}
            />
          ))}
        </Grid>
      )}
      <Grid columns="main">
        <div className="app-dashboard-main">
          {events.length > 0 && (
            <section className="app-region">
              <SectionHeader level={2} split title="Today" actions={<Link href="/calendar">Open calendar</Link>} />
              <Agenda>
                {events.map((item, index) => (
                  <AgendaItem
                    key={text(item.id, 'event-' + index)}
                    chip={text(item.time, text(item.date, 'Today'))}
                    lane="schedule"
                    title={text(item.title, 'Campus event')}
                    href="/calendar"
                    linkLabel="View calendar"
                  >
                    {text(item.summary, text(item.location))}
                  </AgendaItem>
                ))}
              </Agenda>
            </section>
          )}
          {announcements.length > 0 && (
            <section className="app-region">
              <SectionHeader level={2} split title="Announcements" actions={<Link href="/feed">View feed</Link>} />
              <div className="app-card-list">
            {announcements.map((item, index) => (
              <AnnouncementCard
                key={text(item.id, 'announcement-' + index)}
                title={text(item.title, 'Announcement')}
                tag={text(item.type, 'Announcement')}
                when={text(item.date)}
                meta={text(item.source)}
                href="/feed"
                demo
              >
                {text(item.summary)}
              </AnnouncementCard>
            ))}
              </div>
            </section>
          )}
          {posts.length > 0 && (
            <section className="app-region">
              <SectionHeader level={2} split title={role === 'organization' ? 'Discussion' : 'From your spaces'} actions={<Link href={role === 'organization' ? '/organizations' : '/feed'}>View all</Link>} />
              <div className="app-card-list">
                {posts.map((item, index) => (
                  <ForumCard
                    key={text(item.id, 'post-' + index)}
                    topic={text(item.label, 'Discussion')}
                    title={text(item.title, 'Class discussion')}
                    excerpt={text(item.summary)}
                    author={text(item.author, 'ACCS member')}
                    replies={Number(item.replies ?? 0)}
                    status={text(item.status, 'Open discussion')}
                    href={'/feed/' + encodeURIComponent(text(item.id))}
                    demo
                  />
                ))}
              </div>
            </section>
          )}
          {cases.length > 0 && (
            <section className="app-region">
              <SectionHeader level={2} split title={role === 'professor' ? 'Assigned reports' : 'Case queue'} actions={<Link href="/cases">Open queue</Link>} />
              <DashboardRecords items={cases} kind="cases" />
            </section>
          )}
          {sections.length > 0 && (
            <section className="app-region">
              <SectionHeader level={2} split title="Your sections" actions={<Link href="/spaces">View sections</Link>} />
              <div className="app-card-list">
                {sections.map((item, index) => (
                  <Card key={text(item.id, 'section-' + index)}>
                    <CardTitle>{text(item.title, text(item.name, 'Class section'))}</CardTitle>
                    <CardBody>{text(item.detail, text(item.subject))}</CardBody>
                    <CardMeta><Link href={'/spaces/' + encodeURIComponent(text(item.id))}>Open space</Link></CardMeta>
                  </Card>
                ))}
              </div>
            </section>
          )}
        </div>
        <aside className="app-dashboard-rail">
          {reports.length > 0 && (
            <section className="app-region">
              <SectionHeader level={2} title="My reports" actions={<Link href="/reports">View all</Link>} />
              <DashboardRecords items={reports} kind="reports" />
            </section>
          )}
          {consultations.length > 0 && (
            <section className="app-region">
              <SectionHeader level={2} title="Consultations" actions={<Link href="/consultations">View all</Link>} />
              <Agenda>
                {consultations.map((item, index) => (
                  <AgendaItem
                    key={text(item.id, 'consultation-' + index)}
                    chip={text(item.status, 'Requested')}
                    lane="consult"
                    title={text(item.title, 'Consultation request')}
                    href="/consultations"
                  >
                    {text(item.when, text(item.date))}
                  </AgendaItem>
                ))}
              </Agenda>
            </section>
          )}
          {assignments.length > 0 && (
            <section className="app-region">
              <SectionHeader level={2} title="Evaluations" actions={<Link href="/evaluations">Open evaluations</Link>} />
              {assignments.map((item, index) => (
                <Card key={text(item.id, 'assignment-' + index)}>
                  <CardTitle>{text(item.title, 'Evaluation due')}</CardTitle>
                  <CardBody>{text(item.due, text(item.dueDate))}</CardBody>
                  <CardMeta><Badge tone="info" form="pending">{text(item.status, 'Not started')}</Badge></CardMeta>
                </Card>
              ))}
            </section>
          )}
          {todos.length > 0 && (
            <section className="app-region">
              <SectionHeader level={2} title="To do" actions={<Link href="/calendar">Open calendar</Link>} />
              <Agenda>
                {todos.map((item, index) => (
                  <AgendaItem key={text(item.id, 'todo-' + index)} chip={text(item.dueDate, 'Personal')} title={text(item.title, 'Task')}>
                    {text(item.status, 'Open')}
                  </AgendaItem>
                ))}
              </Agenda>
            </section>
          )}
          {notes.length > 0 && (
            <section className="app-region">
              <SectionHeader level={2} title="Recent updates" actions={<Link href="/notifications">View notifications</Link>} />
              <Agenda>
                {notes.map((item, index) => (
                  <AgendaItem key={text(item.id, 'notice-' + index)} chip={text(item.type, 'Update')} title={text(item.title, 'Account update')} href="/notifications" />
                ))}
              </Agenda>
            </section>
          )}
          {/* TBD(D-06): CCS Staff capabilities beyond CCS-wide content. */}
          {role === 'staff' && (
            <Alert tone="neutral" title="Staff access is limited">
              Staff content beyond CCS-wide material is still being defined. <span className="tbd-comment">TBD(D-06)</span>
            </Alert>
          )}
          {reports.length + cases.length + sections.length + consultations.length + announcements.length + posts.length + events.length + assignments.length + todos.length + notes.length === 0 && (
            <EmptyState title="Nothing to show yet" description="Items for your role and scope will appear here when available." />
          )}
        </aside>
      </Grid>
    </div>
  )
}

function HomeDashboard({ page }: { page: PageEnvelope }) {
  const session = useQuery(sessionQuery())
  const variants = asItems(page.data.roleSections)
  const roles = session.data?.user.roles ?? []
  const panels = variants.filter((variant) => roles.some((role) => role === variant.role))
  if (roles.length > 1 && panels.length > 1) {
    return (
      <Tabs defaultSelectedKey={text(panels[0].role)}>
        <TabList aria-label="Dashboard role views" items={panels}>
          {(panel) => <Tab id={text(panel.role)}>As {text(panel.label, text(panel.role))}</Tab>}
        </TabList>
        {panels.map((panel) => (
          <TabPanel key={text(panel.role)} id={text(panel.role)}>
            <DashboardPanel data={panel} role={text(panel.role)} />
          </TabPanel>
        ))}
      </Tabs>
    )
  }
  const panel = panels[0] ?? page.data
  return <DashboardPanel data={panel as Item} role={roles[0] ?? 'student'} />
}

function BasicPage({ page }: { page: PageEnvelope }) {
  const entries = Object.entries(page.data).filter(([, value]) => Array.isArray(value) && value.length > 0)
  if (!entries.length) {
    return <EmptyState title="No items to show" description="There are no matching items in the available sample data." />
  }
  return (
    <div className="app-page">
      {entries.map(([key, value]) => (
        <section className="app-region" key={key}>
          <SectionHeader level={2} title={key.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase())} />
          <div className="app-card-list">
            {asItems(value).map((item, index) => {
              const id = text(item.id, key + '-' + index)
              const title = text(item.title, text(item.name, text(item.reference, 'Sample item')))
              return (
                <Card key={id}>
                  <CardTitle>{title}</CardTitle>
                  {text(item.summary) && <CardBody>{text(item.summary)}</CardBody>}
                  {text(item.status) && <CardMeta><Badge tone="info" form="pending">{text(item.status)}</Badge></CardMeta>}
                </Card>
              )
            })}
          </div>
        </section>
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
            <SectionHeader
              level={1}
              title={page.data.title || pageTitles[pageId] || 'ACCS'}
              description={page.data.scope}
              actions={<Badge outline marker={false}>Sample data</Badge>}
            />
            {pageId === 'P03'
              ? <HomeDashboard page={page.data} />
              : <BasicPage page={page.data} />}
          </>
        )}
      </div>
    </RequirePermission>
  )
}
