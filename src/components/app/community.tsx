import { AvatarFill, photoSrc } from '@/components/app/photo'
import { roleLabelOf } from '@/lib/role-labels'
import {
  Alert,
  Button,
  Checkbox,
  DatePicker,
  Icon,
  Link,
  MenuButton,
  MenuItem,
  Modal,
  ModalActions,
  ModalBody,
  Pagination,
  Radio,
  RadioGroup,
  Row,
  Search,
  Segment,
  SegmentedControl,
  Select,
  SelectOption,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  TextArea,
  TextField,
  ViewState,
  toast,
  EmptyState,
  type IconName,
} from '@meetingat10/design-system/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useBlocker, useRouter, useRouterState } from '@tanstack/react-router'
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'motion/react'
import { useRef, useState, type FormEvent, type ReactNode } from 'react'

import { IdentityChoice } from '@/components/app/grievance'
import { RestrictedView } from '@/components/app/guards'
import { PagedList } from '@/components/app/paging'
import {
  DateTile,
  Empty,
  PageHeader,
  Panel,
  StatusChip,
  toneFor,
} from '@/components/app/page-shell'
import { Comment, CommentThread } from '@/components/ds-next'
import { SubjectList, SubjectMaterials } from '@/components/app/materials'
import { QueryProblem } from '@/components/app/query-problem'
import { ReactionBar, readReactions, topReactions } from '@/components/app/reactions'
import {
  performPageAction,
  type PageAction,
  type PageEnvelope,
  type Session,
} from '@/lib/api'
import { formatDate, formatDateTime, initials, relativeTime } from '@/lib/format'
import { pageQuery, sessionQuery } from '@/lib/queries'
import './community.css'

interface Person {
  id?: string
  name: string
  roles?: string[]
  program?: string
  studentId?: string
  organizationRole?: string
  role?: string
  title?: string
}

interface PostComment {
  id: string
  author: Person
  body: string
  at: string
  /** Flagged and hidden from others until a moderator reviews it; only its author sees it. */
  underReview?: boolean
}

export interface CommunityPost {
  id: string
  title: string
  body: string
  underReview?: boolean
  audience: string
  kind: 'discussion' | 'announcement'
  label: string
  priority: string
  at: string
  author: Person
  anonymous: boolean
  private: boolean
  owned: boolean
  reactionCount: number
  reacted: boolean
  commentCount: number
  comments: PostComment[]
  removed: boolean
  eventDate?: string
  eventTime?: string
  eventPlace?: string
  eventContact?: string
}

interface Space {
  id: string
  title: string
  program: string
  subject: string
  section?: string
  year?: number
  professors?: Person[]
  professorIds?: string[]
  studentCount?: number
  studentIds?: string[]
  students?: Person[]
  threadId?: string
  /** A section space lists its subjects; a subject space carries its own materials. */
  subjects?: Array<Record<string, unknown>>
  materials?: Array<Record<string, unknown>>
  canManageMaterials?: boolean
}

/** The section code a space belongs to (SBIT3A). A subject space is titled "Data Structures, SBIT3A"; a section group is "SBIT3A". */
export function sectionCode(space: { title: string }) {
  const parts = space.title.split(',')
  return (parts.length > 1 ? parts[parts.length - 1] : space.title).trim()
}
/** True for a section's own group space, as opposed to one of its subjects. */
export const isSectionGroup = (space: { title: string; subject: string }) => !space.title.includes(',') || /^section group$/i.test(space.subject)
/** Spaces in one order: by section code, the section group first, then its subjects by name. */
export function sortBySection<T extends { title: string; subject: string }>(spaces: T[]) {
  return [...spaces].sort((a, b) => sectionCode(a).localeCompare(sectionCode(b)) || Number(isSectionGroup(b)) - Number(isSectionGroup(a)) || a.subject.localeCompare(b.subject))
}

interface Organization {
  id: string
  name: string
  description: string
  member: boolean
  memberCount?: number
  representative?: Person
  members?: Person[]
}

interface CommunityEvent {
  id: string
  title: string
  date: string
  start: string
  end?: string
  description?: string
  location?: string
  place?: string
  contact?: string
}

interface ScopeOption {
  id: string
  label: string
}

const postLabels = ['Discussion', 'Rant', 'Assistance', 'Support']
/** The label as a key for its colour (Announcement, Discussion, Rant, Assistance, Support). */
export const labelKey = (label: string) => label.toLowerCase().replace(/s$/, '').replace(/[^a-z]/g, '') || 'discussion'
const participatingRoles = [
  'student',
  'organization',
  'professor',
  'chair',
  'dean',
  'guidance',
  'osas',
]
const roleNames: Record<string, string> = {
  student: 'Student',
  organization: 'Organization',
  professor: 'Professor',
  chair: 'Program Chair',
  dean: 'Dean',
  guidance: 'Guidance',
  osas: 'OSAS',
  administrator: 'System Administrator',
}

function list<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

function record<T>(value: unknown): T | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as T)
    : undefined
}

function personRole(person: Person) {
  return (person.roles ?? []).map((role) => roleLabelOf(role) || roleNames[role] || role).join(' · ')
}

function audienceName(
  audience: string,
  spaces: Space[] = [],
  organizations: Organization[] = [],
) {
  if (audience === 'college') return 'College of Computer Studies'
  if (audience === 'faculty') return 'Faculty'
  const [kind, id] = audience.split(':')
  if (kind === 'program') return `${id} program`
  if (kind === 'space') {
    const space = spaces.find((entry) => entry.id === id)
    return space ? (isSectionGroup(space) ? sectionCode(space) : `${sectionCode(space)} · ${space.subject}`) : 'Class space'
  }
  if (kind === 'organization')
    return (
      organizations.find((organization) => organization.id === id)?.name ??
      'Organization members'
    )
  return audience
}

function useFilters() {
  const router = useRouter()
  const location = useRouterState({ select: (state) => state.location })
  const params = new URLSearchParams(location.searchStr)

  function update(values: Record<string, string | undefined>) {
    const next = new URLSearchParams(location.searchStr)
    if (!('page' in values)) next.delete('page')
    for (const [key, value] of Object.entries(values)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    const search = next.toString()
    router.history.push(location.pathname + (search ? `?${search}` : ''))
  }

  return { params, update }
}

function useCommunityAction(pageId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (action: PageAction) => performPageAction(pageId, action),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['page'] })
      toast(result.message, { tone: 'success' })
    },
  })
}

function ActionError({ error }: { error: unknown }) {
  if (!error) return null
  return (
    <Alert tone="danger" title="The change couldn't be saved">
      {error instanceof Error
        ? error.message
        : 'Try again. Your text is still in the form.'}
    </Alert>
  )
}

const ease = [0.16, 1, 0.3, 1] as const
const priorityRank = ['urgent', 'important', 'general']

function Initials({ name, small, photo }: { name: string; small?: boolean; photo?: unknown }) {
  return (
    <span className={`accs-avatar fx-av${small ? ' fx-av--sm' : ''}`} aria-hidden>
      <AvatarFill photo={photo} fallback={initials(name) || '?'} />
    </span>
  )
}

function authorName(post: CommunityPost) {
  return post.anonymous ? 'Anonymous' : (post.author?.name ?? 'College member')
}

function priorityLabel(priority: string) {
  const value = priority || 'general'
  return value.charAt(0).toUpperCase() + value.slice(1)
}

/** Comment on a post straight from the feed, without opening it. To comment anonymously, open the post. */
function RowComment({ post }: { post: CommunityPost }) {
  const [open, setOpen] = useState(false)
  const [body, setBody] = useState('')
  const queryClient = useQueryClient()
  const send = useMutation({
    mutationFn: () => performPageAction('P06', { action: 'comment', recordId: post.id, payload: { body: body.trim() } }),
    onSuccess: async (result) => {
      setBody('')
      setOpen(false)
      await queryClient.invalidateQueries({ queryKey: ['page'] })
      toast(result.message, { tone: 'success' })
    },
  })
  return (
    <div className="fx-row-comment">
      {!open ? (
        <button type="button" className="fx-row-comment__toggle" onClick={() => { send.reset(); setOpen(true) }}>
          <Icon name="chat" size={16} />
          Comment
        </button>
      ) : (
        <form className="fx-row-comment__form" onSubmit={(event) => { event.preventDefault(); if (body.trim() && !send.isPending) send.mutate() }}>
          <TextArea label={`Comment on ${post.title}`} value={body} onChange={setBody} maxLength={4000} autoFocus />
          <div className="fx-row-comment__actions">
            <Button type="submit" size="sm" loading={send.isPending} isDisabled={!body.trim()}>Post comment</Button>
            <Button size="sm" variant="tertiary" onPress={() => { setOpen(false); setBody('') }}>Cancel</Button>
          </div>
          {send.error && <Alert tone="danger" title="The comment was not posted">{send.error.message}</Alert>}
        </form>
      )}
    </div>
  )
}

function ThreadList({
  posts,
  spaces,
  organizations,
}: {
  posts: CommunityPost[]
  spaces?: Space[]
  organizations?: Organization[]
}) {
  const reduce = useReducedMotion()
  const announcements = posts
    .filter((post) => post.kind === 'announcement')
    .sort(
      (a, b) => priorityRank.indexOf(a.priority) - priorityRank.indexOf(b.priority),
    )
  const ordered = [
    ...announcements,
    ...posts.filter((post) => post.kind !== 'announcement'),
  ]

  return (
    <Panel flush className="fx-threads-panel">
      <ul className="fx-threads" aria-label="Posts">
        <AnimatePresence initial mode="popLayout">
          {ordered.map((post, index) => {
            const name = authorName(post)
            const announcement = post.kind === 'announcement'
            return (
              <motion.li
                key={post.id}
                className="fx-thread"
                layout={!reduce}
                initial={reduce ? false : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0, x: -16 }}
                transition={{
                  duration: 0.36,
                  ease,
                  delay: reduce ? 0 : Math.min(index, 8) * 0.04,
                }}
              >
                <div className="fx-vote" title={`${readReactions(post as unknown as Record<string, unknown>).total} reactions`}>
                  <span aria-hidden className="fx-vote__emoji">{topReactions(readReactions(post as unknown as Record<string, unknown>).counts, 1)[0]?.emoji ?? '👍'}</span>
                  <span className="accs-num">{readReactions(post as unknown as Record<string, unknown>).total}</span>
                  <span className="fx-sr">reactions</span>
                </div>
                <div className="fx-thread__body">
                  <div className="fx-thread__tags">
                    <span className="accs-tag fx-tag--label" data-label={labelKey(announcement ? 'Announcement' : post.label)}>
                      {announcement ? 'Announcement' : post.label}
                    </span>
                    <span className="accs-tag">
                      {post.audience === 'college'
                        ? 'CCS'
                        : audienceName(post.audience, spaces, organizations)}
                    </span>
                    {announcement && (
                      <StatusChip tone={toneFor(post.priority || 'general')}>
                        {priorityLabel(post.priority)}
                      </StatusChip>
                    )}
                  </div>
                  <h3 className="fx-thread__title">
                    <Link
                      variant="quiet"
                      className="fx-title-link"
                      href={`/feed/${encodeURIComponent(post.id)}`}
                    >
                      {post.title}
                    </Link>
                  </h3>
                  <p className="fx-thread__excerpt">{post.body}</p>
                  {post.underReview && <span className="fx-review" role="note">Under review. Only you can see this until a moderator reviews it.</span>}
                  <p className="fx-thread__meta">
                    <Initials name={name} small photo={post.anonymous ? undefined : (post.author as { photo?: unknown } | undefined)?.photo} />
                    <span className="fx-thread__author">{name}</span>
                    <span aria-hidden>·</span>
                    <time dateTime={post.at} title={formatDateTime(post.at)}>
                      {relativeTime(post.at)}
                    </time>
                    <span className="fx-thread__replies">
                      <Icon name="chat" size={16} />
                      <span className="accs-num">{post.commentCount}</span>
                      <span className="fx-sr">replies</span>
                    </span>
                  </p>
                  {!post.removed && <RowComment post={post} />}
                </div>
              </motion.li>
            )
          })}
        </AnimatePresence>
      </ul>
    </Panel>
  )
}

/** A rail section's heading: its icon, its name and how many items it lists. */
function RailTitle({ icon, children, count }: { icon: IconName; children: string; count?: number }) {
  return (
    <span className="fx-rail-title">
      <span className="fx-rail-mark" aria-hidden><Icon name={icon} size={16} /></span>
      {children}
      {count ? <span className="fx-rail-count" aria-label={`${count} shown`}>{count}</span> : null}
    </span>
  )
}

/** One rail row: a tinted icon, then the title and a line under it. */
function RailRow({ href, icon, title, sub }: { href: string; icon: IconName; title: ReactNode; sub: ReactNode }) {
  return (
    <Link variant="quiet" className="fx-mini__row" href={href}>
      <span className="fx-mini__mark" aria-hidden><Icon name={icon} size={16} /></span>
      <span className="fx-mini__text">
        <span className="fx-mini__title">{title}</span>
        <span className="fx-mini__sub">{sub}</span>
      </span>
    </Link>
  )
}

function RailLink({ href, children }: { href: string; children: string }) {
  return (
    <Link variant="quiet" className="accs-panel__link fx-rail-link" href={href}>
      {children}
    </Link>
  )
}

type Retry = { failed: boolean; retry: () => void; retrying: boolean }

function FeedRail({
  posts,
  spaces,
  organizations,
  spacesLoad,
  organizationsLoad,
}: {
  posts: CommunityPost[]
  spaces: Space[]
  organizations: Organization[]
  spacesLoad?: Retry
  organizationsLoad?: Retry
}) {
  const announcements = posts
    .filter((post) => post.kind === 'announcement')
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 4)
  const orgs = [...organizations]
    .sort((a, b) => Number(b.member) - Number(a.member))
    .slice(0, 5)
  return (
    <aside className="fx-rail accs-stagger" aria-label="Forum sidebar">
      {announcements.length > 0 && (
        <Panel title={<RailTitle icon="megaphone" count={announcements.length}>Announcements</RailTitle>} flush className="fx-rail-sec" data-tone="warn">
          <ul className="fx-mini">
            {announcements.map((post) => (
              <li key={post.id}>
                <RailRow
                  href={`/feed/${encodeURIComponent(post.id)}`}
                  icon="megaphone"
                  title={post.title}
                  sub={<>{priorityLabel(post.priority)} · {relativeTime(post.at)}</>}
                />
              </li>
            ))}
          </ul>
        </Panel>
      )}
      {spacesLoad?.failed && (
        <Panel title="Your spaces">
          <QueryProblem what="your class spaces" onRetry={spacesLoad.retry} retrying={spacesLoad.retrying} />
        </Panel>
      )}
      {organizationsLoad?.failed && (
        <Panel title="Organizations">
          <QueryProblem what="organizations" onRetry={organizationsLoad.retry} retrying={organizationsLoad.retrying} />
        </Panel>
      )}
      {spaces.length > 0 && (
        <Panel
          title={<RailTitle icon="graduation-cap" count={Math.min(spaces.length, 5)}>Your spaces</RailTitle>}
          flush
          className="fx-rail-sec"
          data-tone="info"
          action={<RailLink href="/spaces">View all</RailLink>}
        >
          <ul className="fx-mini">
            {spaces.slice(0, 5).map((space) => {
              // The section group is the whole class; a subject space is one subject of it, named by the subject.
              const group = isSectionGroup(space)
              return (
                <li key={space.id}>
                  <RailRow
                    href={`/spaces/${encodeURIComponent(space.id)}`}
                    icon={group ? 'chalkboard' : 'books'}
                    title={group ? sectionCode(space) : space.subject}
                    sub={group ? 'Whole section' : `${sectionCode(space)} · Subject`}
                  />
                </li>
              )
            })}
          </ul>
        </Panel>
      )}
      {orgs.length > 0 && (
        <Panel
          title={<RailTitle icon="users" count={orgs.length}>Organizations</RailTitle>}
          flush
          className="fx-rail-sec"
          data-tone="ok"
          action={<RailLink href="/organizations">Browse</RailLink>}
        >
          <ul className="fx-mini">
            {orgs.map((organization) => {
              const count = organization.memberCount ?? 0
              return (
                <li key={organization.id}>
                  <RailRow
                    href={`/organizations/${encodeURIComponent(organization.id)}`}
                    icon="users"
                    title={organization.name}
                    sub={<>
                      {count} {count === 1 ? 'member' : 'members'}
                      {organization.member && <span className="fx-mini__badge">Member</span>}
                    </>}
                  />
                </li>
              )
            })}
          </ul>
        </Panel>
      )}
    </aside>
  )
}

function FeedPage({ page, session }: { page: PageEnvelope; session: Session }) {
  const { params, update } = useFilters()
  const organizationsQuery = useQuery(pageQuery('P09'))
  const spacesQuery = useQuery({
    ...pageQuery('P07'),
    enabled: session.allowedPages.includes('P07'),
  })
  const organizations = list<Organization>(
    organizationsQuery.data?.data.organizations,
  )
  const spaces = list<Space>(spacesQuery.data?.data.spaces)
  const query = params.get('q') ?? ''
  const scope = params.get('scope') ?? 'college'
  const labels = (params.get('label') ?? '').split(',').filter(Boolean)
  const sort = params.get('sort') ?? 'newest'
  const scopes: ScopeOption[] = [{ id: 'college', label: 'CCS' }]
  const roles = session.user.roles

  if (
    session.user.program &&
    roles.some((role) => ['student', 'chair'].includes(role))
  ) {
    scopes.push({ id: `program:${session.user.program}`, label: 'My program' })
  }
  if (roles.includes('dean')) {
    scopes.push(
      ...['BSIT', 'BSCS', 'BSIS'].map((program) => ({
        id: `program:${program}`,
        label: program,
      })),
    )
  }
  if (roles.some((role) => ['student', 'professor'].includes(role))) {
    scopes.push(
      ...spaces
        .filter(
          (space) =>
            roles.includes('student') ||
            space.professorIds?.includes(session.user.id),
        )
        .map((space) => ({ id: `space:${space.id}`, label: isSectionGroup(space) ? sectionCode(space) : `${sectionCode(space)} · ${space.subject}` })),
    )
  }
  if (roles.some((role) => ['professor', 'chair', 'dean'].includes(role))) {
    scopes.push({ id: 'faculty', label: 'Faculty' })
  }
  scopes.push(
    ...organizations
      .filter((organization) => organization.member)
      .map((organization) => ({
        id: `organization:${organization.id}`,
        label: organization.name,
      })),
  )
  const uniqueScopes = scopes.filter(
    (option, index) =>
      scopes.findIndex((candidate) => candidate.id === option.id) === index,
  )
  const allPosts = list<CommunityPost>(page.data.posts)
  const posts = allPosts
    .filter((post) => post.audience === scope)
    .filter(
      (post) =>
        !labels.length ||
        labels.includes(
          post.kind === 'announcement' ? 'Announcements' : post.label,
        ),
    )
    .sort((a, b) =>
      sort === 'active'
        ? b.commentCount + b.reactionCount - a.commentCount - a.reactionCount
        : b.at.localeCompare(a.at),
    )
  const pageCount = Math.max(1, Math.ceil(posts.length / 10))
  const pageNumber = Math.min(
    pageCount,
    Math.max(1, Number(params.get('page')) || 1),
  )
  const pagePosts = posts.slice((pageNumber - 1) * 10, pageNumber * 10)
  const canParticipate = roles.some((role) => participatingRoles.includes(role))
  const canPost = canParticipate && page.data.canPost === true
  const filtered = Boolean(query || labels.length)
  const composeHref = `/feed/new${scope === 'college' ? '' : `?space=${encodeURIComponent(scope)}`}`

  function toggleLabel(label: string) {
    const next = labels.includes(label)
      ? labels.filter((item) => item !== label)
      : [...labels, label]
    update({ label: next.join(',') || undefined })
  }

  function clearFilters() {
    update({ q: undefined, label: undefined, sort: undefined, page: undefined })
  }

  return (
    <div className="fx-page accs-stack accs-stagger">
      <PageHeader
        title="Feed"
        description="Posts and announcements from the audiences you belong to."
        actions={
          canParticipate && (
            <Button
              icon="plus"
              href="/feed/new"
              isDisabled={page.data.canPost !== true}
            >
              Start a discussion
            </Button>
          )
        }
      />
      <div className="accs-split fx-split">
        <div className="fx-main">
          {canPost && (
            <Link href={composeHref} className="fx-compose" variant="quiet">
              <Initials name={session.user.name} />
              <span className="fx-compose__hint">Start a discussion…</span>
              <span className="fx-compose__cta">
                <Icon name="pencil" size={16} />
                Write
              </span>
            </Link>
          )}
          <div className="fx-toolbar">
            <div className="fx-toolbar__row">
              <div className="fx-toolbar__search">
                <Search
                  label="Search posts"
                  size="sm"
                  value={query}
                  onChange={(q) => update({ q })}
                />
              </div>
              {uniqueScopes.length > 1 && (
                <Select
                  label="Audience"
                  selectedKey={scope}
                  onSelectionChange={(key) => update({ scope: String(key) })}
                >
                  {uniqueScopes.map((option) => (
                    <SelectOption id={option.id} key={option.id}>
                      {option.label}
                    </SelectOption>
                  ))}
                </Select>
              )}
            </div>
            <div className="fx-toolbar__row fx-toolbar__row--pills">
              <LayoutGroup id="fx-sort">
                <div className="fx-seg" role="group" aria-label="Sort posts">
                  {[
                    { id: 'newest', label: 'Latest' },
                    { id: 'active', label: 'Most active' },
                  ].map((option) => (
                    <button
                      type="button"
                      key={option.id}
                      className="fx-seg__item"
                      aria-pressed={sort === option.id}
                      onClick={() => update({ sort: option.id })}
                    >
                      {sort === option.id && (
                        <motion.span
                          layoutId="fx-sort-indicator"
                          className="fx-seg__thumb"
                          transition={{ type: 'spring', stiffness: 520, damping: 38 }}
                        />
                      )}
                      <span className="fx-seg__label">{option.label}</span>
                    </button>
                  ))}
                </div>
              </LayoutGroup>
              <div className="accs-pills fx-cats" role="group" aria-label="Post labels">
                <button
                  type="button"
                  className="accs-pill fx-cat"
                  aria-pressed={!labels.length}
                  onClick={() => update({ label: undefined })}
                >
                  All
                </button>
                {['Announcements', ...postLabels].map((label) => (
                  <button
                    type="button"
                    key={label}
                    className="accs-pill fx-cat"
                    data-label={labelKey(label)}
                    aria-pressed={labels.includes(label)}
                    onClick={() => toggleLabel(label)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {posts.length ? (
            <>
              <ThreadList
                posts={pagePosts}
                spaces={spaces}
                organizations={organizations}
              />
              {pageCount > 1 && (
                <Pagination
                  page={pageNumber}
                  pageCount={pageCount}
                  onPageChange={(next) => update({ page: String(next) })}
                  summary={`Showing ${(pageNumber - 1) * 10 + 1}–${Math.min(pageNumber * 10, posts.length)} of ${posts.length} posts`}
                />
              )}
            </>
          ) : (
            <Panel>
              <Empty
                title={
                  query
                    ? `No posts match '${query}'`
                    : labels.length
                      ? 'No posts match these filters'
                      : 'No posts here yet'
                }
                action={
                  filtered ? (
                    <Button variant="secondary" onPress={clearFilters}>
                      Clear filters
                    </Button>
                  ) : canPost ? (
                    <Button href={composeHref}>Start a discussion</Button>
                  ) : undefined
                }
              >
                Posts appear here when someone in this audience publishes one.
              </Empty>
            </Panel>
          )}
        </div>
        <FeedRail
          posts={allPosts}
          spaces={spaces}
          organizations={organizations}
          spacesLoad={{ failed: spacesQuery.isError, retry: () => void spacesQuery.refetch(), retrying: spacesQuery.isFetching }}
          organizationsLoad={{ failed: organizationsQuery.isError, retry: () => void organizationsQuery.refetch(), retrying: organizationsQuery.isFetching }}
        />
      </div>
    </div>
  )
}


export function PostComposer({
  page,
  session,
}: {
  page: PageEnvelope
  session: Session
}) {
  const router = useRouter()
  const { params } = useFilters()
  const action = useCommunityAction('P05')
  const spacesQuery = useQuery({
    ...pageQuery('P07'),
    enabled: session.allowedPages.includes('P07'),
  })
  const organizationsQuery = useQuery(pageQuery('P09'))
  const spaces = list<Space>(spacesQuery.data?.data.spaces)
  const organizations = list<Organization>(
    organizationsQuery.data?.data.organizations,
  )
  const audiences = list<string>(page.data.audiences)
  const audienceListsFailed = spacesQuery.isError || organizationsQuery.isError
  const retryAudienceLists = () => { if (spacesQuery.isError) void spacesQuery.refetch(); if (organizationsQuery.isError) void organizationsQuery.refetch() }
  const announcementAudiences = list<string>(page.data.announcementAudiences)
  const requested = params.get('space') ?? ''
  const requestedAudience =
    requested === 'org'
      ? `organization:${session.user.organizationId}`
      : requested.startsWith('ORG-')
        ? `organization:${requested}`
        : requested.startsWith('SPACE-') || requested.startsWith('SUBJECT-')
          ? `space:${requested}`
          : requested
  const initialKind =
    params.get('type') === 'announcement' && announcementAudiences.length
      ? 'announcement'
      : 'discussion'
  const initialOptions =
    initialKind === 'announcement' ? announcementAudiences : audiences
  const [kind, setKind] = useState<'discussion' | 'announcement'>(initialKind)
  const [audience, setAudience] = useState(
    initialOptions.includes(requestedAudience) ? requestedAudience : '',
  )
  const [label, setLabel] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [identity, setIdentity] = useState<'named' | 'anonymous'>('named')
  const [priority, setPriority] = useState('general')
  const [eventDate, setEventDate] = useState('')
  const [eventTime, setEventTime] = useState('')
  const [eventPlace, setEventPlace] = useState('')
  const [eventContact, setEventContact] = useState('')
  const [notifyMembers, setNotifyMembers] = useState(true)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const allowLeave = useRef(false)
  const dirty = Boolean(title.trim() || body.trim())
  const blocker = useBlocker({
    shouldBlockFn: () => dirty && !allowLeave.current,
    enableBeforeUnload: () => dirty && !allowLeave.current,
    withResolver: true,
  })
  const options = kind === 'announcement' ? announcementAudiences : audiences
  const labels = list<string>(page.data.labels)
  const eventRequired =
    kind === 'announcement' &&
    (audience.startsWith('organization:') || audience.startsWith('space:'))
  const invalidRequestedAudience = Boolean(
    requested &&
    ![...audiences, ...announcementAudiences].includes(requestedAudience),
  )

  function changeKind(next: 'discussion' | 'announcement') {
    setKind(next)
    const nextOptions =
      next === 'announcement' ? announcementAudiences : audiences
    if (!nextOptions.includes(audience)) setAudience('')
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const nextErrors: Record<string, string> = {}
    if (!audience) nextErrors.audience = 'Choose an audience.'
    if (!title.trim()) nextErrors.title = 'Enter a title.'
    if (!body.trim()) nextErrors.body = 'Enter your post.'
    if (kind === 'discussion' && !label) nextErrors.label = 'Choose a label.'
    if (eventRequired) {
      if (!eventDate) nextErrors.eventDate = 'Choose an event date.'
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(eventTime))
        nextErrors.eventTime = 'Enter a time as HH:MM.'
      if (!eventPlace.trim()) nextErrors.eventPlace = 'Enter the event place.'
      if (!eventContact.trim()) nextErrors.eventContact = 'Enter a contact.'
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return

    try {
      const result = await action.mutateAsync({
        action: 'createPost',
        payload: {
          title: title.trim(),
          body: body.trim(),
          audience,
          kind,
          label: kind === 'announcement' ? 'Announcement' : label,
          anonymous: kind === 'discussion' && identity === 'anonymous',
          priority,
          private: audience.startsWith('organization:'),
          ...(eventRequired
            ? { eventDate, eventTime, eventPlace, eventContact, notifyMembers }
            : {}),
        },
      })
      const created = record<CommunityPost>(result.record)
      allowLeave.current = true
      router.history.push(
        created?.id ? `/feed/${encodeURIComponent(created.id)}` : '/feed',
      )
    } catch {
      // The mutation keeps the entered text and presents the API error below.
    }
  }

  return (
    <div className="fx-page fx-compose-page accs-stack accs-stagger">
      <PageHeader
        crumbs={[{ label: 'Feed', href: '/feed' }, { label: 'New post' }]}
        title={kind === 'announcement' ? 'New announcement' : 'Start a discussion'}
              />
      {invalidRequestedAudience && (
        <Alert tone="danger" title="You can't post there">
          Choose one of the audiences listed below.
        </Alert>
      )}
      <Panel as="div" className="fx-form-panel">
        <form className="fx-form" onSubmit={submit} noValidate>
          <section className="fx-group" aria-labelledby="fx-group-where">
            <div className="fx-group__head">
              <h2 id="fx-group-where" className="fx-group__title">
                Where to post
              </h2>
              <p className="fx-group__hint">
                Only people in the audience can see this post.
              </p>
            </div>
            <div className="fx-group__body">
              {audienceListsFailed && (
                <QueryProblem what="the names of your spaces and organizations" onRetry={retryAudienceLists} retrying={spacesQuery.isFetching || organizationsQuery.isFetching} />
              )}
              {announcementAudiences.length > 0 && (
                <SegmentedControl
                  aria-label="Post type"
                  selectedKey={kind}
                  onSelectionChange={(key) =>
                    changeKind(String(key) as 'discussion' | 'announcement')
                  }
                >
                  <Segment id="discussion">Post</Segment>
                  <Segment id="announcement">Announcement</Segment>
                </SegmentedControl>
              )}
              <Select
                label="Post in"
                isRequired
                selectedKey={audience || null}
                onSelectionChange={(key) => setAudience(String(key ?? ''))}
                isInvalid={Boolean(errors.audience)}
                errorMessage={errors.audience}
                placeholder="Choose an audience"
              >
                {options.map((option) => (
                  <SelectOption
                    id={option}
                    key={option}
                    description={`Visible to ${audienceName(option, spaces, organizations)}`}
                  >
                    {audienceName(option, spaces, organizations)}
                  </SelectOption>
                ))}
              </Select>
              {kind === 'discussion' && (
                <RadioGroup
                  label="Label"
                  row
                  isRequired
                  value={label}
                  onChange={setLabel}
                  isInvalid={Boolean(errors.label)}
                  errorMessage={errors.label}
                >
                  {(labels.length ? labels : postLabels).map((option) => (
                    <Radio value={option} key={option}>
                      {option}
                    </Radio>
                  ))}
                </RadioGroup>
              )}
              {kind === 'announcement' && (
                <RadioGroup
                  label="Priority"
                  row
                  value={priority}
                  onChange={setPriority}
                >
                  <Radio value="general">General</Radio>
                  <Radio value="important">Important</Radio>
                  <Radio value="urgent">Urgent</Radio>
                </RadioGroup>
              )}
            </div>
          </section>
          {/* TBD(D-06): announcement priority levels and wider organization publishing await approval. */}
          <section className="fx-group" aria-labelledby="fx-group-content">
            <div className="fx-group__head">
              <h2 id="fx-group-content" className="fx-group__title">
                Your post
              </h2>
              <p className="fx-group__hint">
                Leave out personal details. The system screens posts for harmful words.
              </p>
            </div>
            <div className="fx-group__body">
              <TextField
                label="Title"
                value={title}
                onChange={setTitle}
                maxLength={160}
                isRequired
                isInvalid={Boolean(errors.title)}
                errorMessage={errors.title}
              />
              <TextArea
                label={kind === 'announcement' ? 'Announcement' : 'Post'}
                value={body}
                onChange={setBody}
                maxLength={5000}
                showCount
                isRequired
                isInvalid={Boolean(errors.body)}
                errorMessage={errors.body}
              />
              {session.user.roles.includes('student') &&
                kind === 'discussion' &&
                page.data.anonymityAllowed === true && (
                  <IdentityChoice
                    context="post"
                    value={identity}
                    onChange={setIdentity}
                  />
                )}
            </div>
          </section>
          <AnimatePresence initial={false}>
            {eventRequired && (
              <motion.section
                key="event"
                className="fx-group fx-group--event"
                aria-labelledby="fx-group-event"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.36, ease }}
              >
                <div className="fx-group__head">
                  <h2 id="fx-group-event" className="fx-group__title">
                    Event details
                  </h2>
                  <p className="fx-group__hint">
                    Members see this on the post and in the calendar.
                  </p>
                </div>
                <div className="fx-group__body fx-group__body--grid">
                  <DatePicker
                    label="Event date"
                    isRequired
                    onChange={(value) => setEventDate(value?.toString() ?? '')}
                    isInvalid={Boolean(errors.eventDate)}
                    errorMessage={errors.eventDate}
                  />
                  <TextField
                    label="Time"
                    value={eventTime}
                    onChange={setEventTime}
                    placeholder="14:00"
                    description="Use 24-hour time, HH:MM."
                    isRequired
                    isInvalid={Boolean(errors.eventTime)}
                    errorMessage={errors.eventTime}
                  />
                  <TextField
                    label="Place"
                    value={eventPlace}
                    onChange={setEventPlace}
                    isRequired
                    isInvalid={Boolean(errors.eventPlace)}
                    errorMessage={errors.eventPlace}
                  />
                  <TextField
                    label="Contact"
                    value={eventContact}
                    onChange={setEventContact}
                    isRequired
                    isInvalid={Boolean(errors.eventContact)}
                    errorMessage={errors.eventContact}
                  />
                  <div className="fx-group__wide">
                    <Checkbox isSelected={notifyMembers} onChange={setNotifyMembers}>
                      Notify members
                    </Checkbox>
                  </div>
                </div>
              </motion.section>
            )}
          </AnimatePresence>
          {/* TBD(D-08): attachment handling and retention are not approved. */}
          <p className="fx-note">
            <Icon name="paperclip" size={16} />
            You can't attach files yet. Write your post as text.
          </p>
          {session.user.roles.some((role) =>
            ['guidance', 'osas'].includes(role),
          ) && (
            <Alert
              tone="neutral"
              title="Keep case information in the case record"
            >
              Do not put case details in a post.
            </Alert>
          )}
          <ActionError error={action.error} />
          <div className="fx-form__actions">
            <Button
              variant="secondary"
              onPress={() => router.history.push('/feed')}
            >
              Cancel
            </Button>
            <Button type="submit" loading={action.isPending}>
              Publish
            </Button>
          </div>
        </form>
      </Panel>
      <Modal
        title="Discard this post?"
        role="alertdialog"
        isOpen={blocker.status === 'blocked'}
        onOpenChange={(open) => {
          if (!open && blocker.status === 'blocked') blocker.reset()
        }}
      >
        <ModalBody>The text you wrote will be lost.</ModalBody>
        <ModalActions>
          <Button
            variant="secondary"
            onPress={() => {
              if (blocker.status === 'blocked') blocker.reset()
            }}
          >
            Keep writing
          </Button>
          <Button
            variant="destructive"
            onPress={() => {
              if (blocker.status === 'blocked') blocker.proceed()
            }}
          >
            Discard post
          </Button>
        </ModalActions>
      </Modal>
    </div>
  )
}

export function PostView({
  post,
  spaces,
  organizations,
}: {
  post: CommunityPost
  spaces?: Space[]
  organizations?: Organization[]
}) {
  const name = authorName(post)
  const role = personRole(post.author ?? { name: '' })
  const announcement = post.kind === 'announcement'
  return (
    <article className="fx-post">
      <div className="fx-thread__tags">
        <span className="accs-tag fx-tag--label" data-label={labelKey(announcement ? 'Announcement' : post.label)}>
          {announcement ? 'Announcement' : post.label}
        </span>
        <span className="accs-tag">
          {audienceName(post.audience, spaces, organizations)}
        </span>
        {announcement && (
          <StatusChip tone={toneFor(post.priority || 'general')}>
            {priorityLabel(post.priority)}
          </StatusChip>
        )}
        {post.private && <span className="accs-tag">Members only</span>}
      </div>
      <div className="fx-post__author">
        <Initials name={name} photo={post.anonymous ? undefined : (post.author as { photo?: unknown } | undefined)?.photo} />
        <div className="fx-post__who">
          <strong>{name}</strong>
          <span>
            {role && <>{role} · </>}
            <time dateTime={post.at}>{formatDateTime(post.at)}</time>
          </span>
        </div>
      </div>
      {post.underReview && <span className="fx-review" role="note">Under review. Only you can see this until a moderator reviews it.</span>}
      <div className="fx-post__body">{post.body}</div>
      {post.eventDate && (
        <dl className="fx-facts">
          <div>
            <dt>Event date</dt>
            <dd>{formatDate(post.eventDate)}</dd>
          </div>
          <div>
            <dt>Time</dt>
            <dd>{post.eventTime}</dd>
          </div>
          <div>
            <dt>Place</dt>
            <dd>{post.eventPlace}</dd>
          </div>
          <div>
            <dt>Contact</dt>
            <dd>{post.eventContact}</dd>
          </div>
        </dl>
      )}
    </article>
  )
}


function PostDetailPage({
  page,
  session,
}: {
  page: PageEnvelope
  session: Session
}) {
  const post = record<CommunityPost>(page.data.record)
  const action = useCommunityAction('P06')
  const router = useRouter()
  const [body, setBody] = useState('')
  const [identity, setIdentity] = useState<'named' | 'anonymous'>('named')
  const [shownComments, setShownComments] = useState(10)
  const [reportTarget, setReportTarget] = useState<{
    type: 'post' | 'comment'
    id: string
  }>()
  const [reportReason, setReportReason] = useState('')
  const [reportDetails, setReportDetails] = useState('')
  const [reportError, setReportError] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editBody, setEditBody] = useState('')
  const [editLabel, setEditLabel] = useState('')
  const [editPriority, setEditPriority] = useState('general')
  const [editError, setEditError] = useState('')
  const [promptDismissed, setPromptDismissed] = useState(false)
  const [composerOpen, setComposerOpen] = useState(false)
  const composerQuery = useQuery({
    ...pageQuery('P05'),
    enabled: Boolean(post?.owned && session.allowedPages.includes('P05')),
  })
  const isStudent = session.user.roles.includes('student')
  const ownReport = list<{ id: string; sourcePostId?: string }>(
    page.data.ownedReports,
  ).find((report) => report.sourcePostId === post?.id)

  if (!post) return <RestrictedView record />
  if (post.removed)
    return (
      <EmptyState
        title="This post was removed"
        description="Its content can no longer be viewed."
      />
    )

  function focusReply() {
    const field = document.querySelector<HTMLTextAreaElement>(
      '#community-comment-form textarea',
    )
    if (field) field.focus()
    else setComposerOpen(true)
  }

  function openReport(type: 'post' | 'comment', id: string) {
    setReportReason('')
    setReportDetails('')
    setReportError('')
    setReportTarget({ type, id })
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      toast('Link copied.', { tone: 'success' })
    } catch {
      toast('Copy the link from your browser address bar.', {
        tone: 'neutral',
      })
    }
  }

  function menuAction(key: string) {
    if (key === 'copy') void copyLink()
    if (key === 'report') openReport('post', post!.id)
    if (key === 'delete') setDeleteOpen(true)
    if (key === 'edit') {
      setEditTitle(post!.title)
      setEditBody(post!.body)
      setEditLabel(post!.label)
      setEditPriority(post!.priority)
      setEditError('')
      setEditOpen(true)
    }
    if (key === 'convert')
      router.history.push(`/reports/new?from=${encodeURIComponent(post!.id)}`)
  }

  async function sendComment(event: FormEvent) {
    event.preventDefault()
    if (!body.trim()) return
    try {
      await action.mutateAsync({
        action: 'comment',
        recordId: post!.id,
        payload: { body: body.trim(), anonymous: identity === 'anonymous' },
      })
      setBody('')
    } catch {
      // The entered comment stays available for another attempt.
    }
  }

  async function sendReport() {
    if (!reportTarget || !reportReason) {
      setReportError('Choose a reason for this report.')
      return
    }
    try {
      await action.mutateAsync({
        action: 'flag',
        recordId: post!.id,
        payload: {
          itemType: reportTarget.type,
          itemId: reportTarget.id,
          reason: [reportReason, reportDetails.trim()]
            .filter(Boolean)
            .join(': '),
        },
      })
      setReportTarget(undefined)
    } catch {
      // The reason and details stay in the dialog if the request fails.
    }
  }

  async function saveEdit(event: FormEvent) {
    event.preventDefault()
    if (
      !editTitle.trim() ||
      !editBody.trim() ||
      (post!.kind === 'discussion' && !editLabel)
    ) {
      setEditError('Add a title and text, and choose a label, then save again.')
      return
    }
    try {
      await action.mutateAsync({
        action: 'updatePost',
        recordId: post!.id,
        payload: {
          title: editTitle.trim(),
          body: editBody.trim(),
          label: editLabel,
          priority: editPriority,
        },
      })
      setEditOpen(false)
    } catch {
      // The edited text stays in the dialog if the request fails.
    }
  }

  async function deletePost() {
    try {
      await action.mutateAsync({
        action: 'deletePost',
        recordId: post!.id,
        payload: {},
      })
      setDeleteOpen(false)
      router.history.push('/feed')
    } catch {
      // Keep the confirmation open so the API error can be reviewed.
    }
  }

  const canConvert =
    post.owned && isStudent && post.kind === 'discussion' && !ownReport
  // TBD(D-07): the API enables engagement prompts only after a threshold is approved.
  const showConversionPrompt =
    canConvert && page.data.conversionSuggested === true && !promptDismissed

  return (
    <>
      <div className="fx-page accs-stack accs-stagger">
      <PageHeader
        crumbs={[{ label: 'Feed', href: '/feed' }, { label: 'Post' }]}
        title={post.title}
      />
      <div className="fx-thread-page">
        <Panel as="div" className="fx-post-panel">
          <PostView post={post} />
          <div className="fx-actions">
            <ReactionBar
              item={post as unknown as Record<string, unknown>}
              disabled={page.data.canReact !== true}
              pending={action.isPending && action.variables?.action === 'react'}
              onReact={(reaction) =>
                action.mutate({ action: 'react', recordId: post.id, payload: { reaction } })
              }
            />
            {page.data.canComment === true && (
              <Button variant="tertiary" icon="chat" onPress={focusReply}>
                Reply
              </Button>
            )}
            {ownReport && (
              <Link href={`/reports/${encodeURIComponent(ownReport.id)}`}>
                View your linked report
              </Link>
            )}
            <span className="fx-actions__spacer" />
            {post.owned && (
              <Button variant="tertiary" icon="trash" onPress={() => { action.reset(); setDeleteOpen(true) }}>
                Delete
              </Button>
            )}
            <MenuButton
              iconOnly
              icon="dots-three"
              label="Post actions"
              onAction={(key) => menuAction(String(key))}
            >
              <MenuItem id="copy">Copy link</MenuItem>
              <MenuItem id="report">Report post</MenuItem>
              {canConvert && <MenuItem id="convert">Start a report</MenuItem>}
              {post.owned && session.permissions.includes('post.create') && (
                <MenuItem id="edit">Edit post</MenuItem>
              )}
              {post.owned && (
                <MenuItem id="delete" danger>
                  Delete post
                </MenuItem>
              )}
            </MenuButton>
          </div>
        </Panel>
        {showConversionPrompt && (
          <Alert
            tone="info"
            title="Many people agree with this post. Do you want to file a report?"
            actions={
              <Row>
                <Button href={`/reports/new?from=${encodeURIComponent(post.id)}`}>
                  Start a report
                </Button>
                <Button
                  variant="tertiary"
                  onPress={() => setPromptDismissed(true)}
                >
                  Not now
                </Button>
              </Row>
            }
          >
            Nothing is filed unless you choose to file it.
          </Alert>
        )}
        <ActionError error={action.error} />
        <Panel
          as="section"
          className="fx-comments"
          aria-label="Comments"
          title={
            <>
              Comments <span className="fx-count accs-num">{post.commentCount}</span>
            </>
          }
        >
          {post.comments.length ? (
            <>
              <CommentThread>
                {post.comments.slice(0, shownComments).map((comment) => (
                  <Comment
                    key={comment.id}
                    photo={photoSrc((comment.author as { photo?: unknown } | undefined)?.photo)}
                    author={comment.author?.name ?? 'College member'}
                    role={personRole(comment.author ?? { name: '' })}
                    date={relativeTime(comment.at)}
                    fullDate={formatDateTime(comment.at)}
                    dateTime={comment.at}
                    actions={
                      <>
                        <ReactionBar
                          size="sm"
                          item={comment as unknown as Record<string, unknown>}
                          disabled={page.data.canReact !== true}
                          onReact={(reaction) =>
                            action.mutate({ action: 'reactComment', recordId: post.id, payload: { commentId: comment.id, reaction } })
                          }
                        />
                        {page.data.canComment === true && (
                          <Button
                            variant="tertiary"
                            size="sm"
                            onPress={focusReply}
                          >
                            Reply
                          </Button>
                        )}
                        <MenuButton
                          iconOnly
                          icon="dots-three"
                          label="Comment actions"
                          onAction={() => openReport('comment', comment.id)}
                        >
                          <MenuItem id="report">Report comment</MenuItem>
                        </MenuButton>
                      </>
                    }
                  >
                    {comment.body}
                    {comment.underReview && <span className="fx-review" role="note">Under review. Only you can see this until a moderator reviews it.</span>}
                  </Comment>
                ))}
              </CommentThread>
              {post.comments.length > shownComments && (
                <Button
                  variant="secondary"
                  onPress={() => setShownComments((count) => count + 10)}
                >
                  Show more comments
                </Button>
              )}
            </>
          ) : (
            <Empty title="No comments yet" />
          )}
          {page.data.canComment === true ? (
            <div className="fx-reply">
              <AnimatePresence initial={false} mode="wait">
                {composerOpen || body ? (
                  <motion.form
                    key="form"
                    id="community-comment-form"
                    className="fx-reply__form"
                    onSubmit={sendComment}
                    initial={{ opacity: 0, y: 8, scale: 0.985 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.985 }}
                    transition={{ duration: 0.26, ease }}
                  >
                    <TextArea
                      label="Add a comment"
                      value={body}
                      onChange={setBody}
                      isRequired
                      autoFocus
                      maxLength={4000}
                      showCount
                    />
                    {isStudent && (
                      <IdentityChoice
                        context="post"
                        value={identity}
                        onChange={setIdentity}
                      />
                    )}
                    <div className="fx-form__actions">
                      <Button
                        variant="tertiary"
                        onPress={() => {
                          setBody('')
                          setComposerOpen(false)
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        loading={action.isPending}
                        isDisabled={!body.trim()}
                      >
                        Comment
                      </Button>
                    </div>
                  </motion.form>
                ) : (
                  <motion.button
                    key="bar"
                    type="button"
                    className="fx-compose fx-compose--button"
                    onClick={() => setComposerOpen(true)}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.16 }}
                  >
                    <Initials name={session.user.name} />
                    <span className="fx-compose__hint">Add a comment…</span>
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          ) : session.user.restrictions.includes('post.comment') ? (
            <Alert tone="neutral" title="Commenting is paused">
              You can still read posts.{' '}
              <Link href="/standing">View account standing</Link>.
            </Alert>
          ) : null}
        </Panel>
      </div>
      </div>
      <Modal
        title={
          reportTarget?.type === 'comment'
            ? 'Report this comment?'
            : 'Report this post?'
        }
        isOpen={Boolean(reportTarget)}
        onOpenChange={(open) => {
          if (!open) setReportTarget(undefined)
        }}
      >
        <ModalBody>
          <div className="app-page">
            <p>Moderators review every report. A report does not decide the outcome.</p>
            <RadioGroup
              label="Reason"
              value={reportReason}
              onChange={setReportReason}
              isRequired
              isInvalid={Boolean(reportError)}
              errorMessage={reportError}
            >
              {[
                'Harassment',
                'Hate',
                'Spam',
                'Personal information',
                'Other',
              ].map((reason) => (
                <Radio value={reason} key={reason}>
                  {reason}
                </Radio>
              ))}
            </RadioGroup>
            <TextArea
              label="Details"
              value={reportDetails}
              onChange={setReportDetails}
              maxLength={1500}
              showCount
            />
            <ActionError error={action.error} />
          </div>
        </ModalBody>
        <ModalActions>
          <Button
            variant="secondary"
            onPress={() => setReportTarget(undefined)}
          >
            Cancel
          </Button>
          <Button onPress={() => void sendReport()} loading={action.isPending}>
            Send report
          </Button>
        </ModalActions>
      </Modal>
      <Modal
        title="Edit post"
        isOpen={editOpen}
        onOpenChange={setEditOpen}
        size="lg"
      >
        <form onSubmit={saveEdit}>
          <ModalBody>
            <div className="app-page">
              <TextField
                label="Title"
                value={editTitle}
                onChange={setEditTitle}
                isRequired
                maxLength={160}
              />
              <TextArea
                label="Post"
                value={editBody}
                onChange={setEditBody}
                isRequired
                maxLength={5000}
                showCount
              />
              {post.kind === 'discussion' ? (
                <RadioGroup
                  label="Label"
                  row
                  value={editLabel}
                  onChange={setEditLabel}
                  isRequired
                >
                  {(list<string>(composerQuery.data?.data.labels).length
                    ? list<string>(composerQuery.data?.data.labels)
                    : postLabels
                  ).map((label) => (
                    <Radio value={label} key={label}>
                      {label}
                    </Radio>
                  ))}
                </RadioGroup>
              ) : (
                <RadioGroup
                  label="Priority"
                  row
                  value={editPriority}
                  onChange={setEditPriority}
                >
                  <Radio value="general">General</Radio>
                  <Radio value="important">Important</Radio>
                  <Radio value="urgent">Urgent</Radio>
                </RadioGroup>
              )}
              {editError && (
                <Alert tone="danger" title="Check the post">
                  {editError}
                </Alert>
              )}
              <ActionError error={action.error} />
            </div>
          </ModalBody>
          <ModalActions>
            <Button variant="secondary" onPress={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={action.isPending}>
              Save changes
            </Button>
          </ModalActions>
        </form>
      </Modal>
      <Modal
        title="Delete this post?"
        role="alertdialog"
        isOpen={deleteOpen}
        onOpenChange={setDeleteOpen}
      >
        <ModalBody>
          <p>No one will be able to view this post after you delete it.</p>
          <ActionError error={action.error} />
        </ModalBody>
        <ModalActions>
          <Button variant="secondary" onPress={() => setDeleteOpen(false)}>
            Keep post
          </Button>
          <Button
            variant="destructive"
            loading={action.isPending}
            onPress={() => void deletePost()}
          >
            Delete post
          </Button>
        </ModalActions>
      </Modal>
    </>
  )
}

function MemberList({
  members,
  academic = false,
  organization = false,
}: {
  members: Person[]
  academic?: boolean
  organization?: boolean
}) {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const filtered = members.filter((member) =>
    member.name.toLowerCase().includes(query.toLowerCase()),
  )
  const pageCount = Math.max(1, Math.ceil(filtered.length / 20))
  const currentPage = Math.min(page, pageCount)
  const visible = filtered.slice((currentPage - 1) * 20, currentPage * 20)
  const noun = academic ? 'students' : 'members'

  return (
    <div className="fx-members">
      <div className="fx-toolbar fx-toolbar--slim">
        <div className="fx-toolbar__search">
          <Search
            label={academic ? 'Search roster' : 'Search members'}
            size="sm"
            value={query}
            onChange={(value) => {
              setQuery(value)
              setPage(1)
            }}
          />
        </div>
        <span className="fx-count-label">
          <span className="accs-num">{filtered.length}</span> {noun}
        </span>
      </div>
      {filtered.length ? (
        <>
          <Panel flush>
            <ul
              className="accs-rows"
              aria-label={academic ? 'Class roster' : 'Member names'}
            >
              {visible.map((member, index) => (
                <li key={member.id ?? `member-${index}`}>
                  <div className="accs-row fx-member">
                    <Initials name={member.name} />
                    <div className="fx-member__text">
                      <p className="accs-row__title">{member.name}</p>
                      {academic && (
                        <p className="accs-row__sub">
                          <span className="accs-mono">
                            {member.studentId ?? '—'}
                          </span>
                          {' · '}
                          {member.program ?? '—'}
                        </p>
                      )}
                    </div>
                    <span className="accs-tag">
                      {academic
                        ? 'Enrolled'
                        : organization
                          ? (member.organizationRole ?? member.role ?? 'Member')
                          : personRole(member)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
          {pageCount > 1 && (
            <Pagination
              page={currentPage}
              pageCount={pageCount}
              onPageChange={setPage}
              summary={`${filtered.length} ${noun}`}
            />
          )}
        </>
      ) : (
        <Panel>
          <Empty
            title={
              query ? 'No members match this search' : 'No member names to show'
            }
          />
        </Panel>
      )}
    </div>
  )
}

function adviserNames(space: Space, fallback: string) {
  return space.professors?.map((person) => person.name).join(', ') || fallback
}

function studentTotal(space: Space) {
  return (
    space.studentCount ?? space.studentIds?.length ?? space.students?.length ?? 0
  )
}

function SpacesPage({
  page,
  session,
}: {
  page: PageEnvelope
  session: Session
}) {
  const { params, update } = useFilters()
  const dean = session.user.roles.includes('dean')
  const oversight = dean || session.user.roles.includes('chair')
  const query = params.get('q') ?? ''
  const program = params.get('program') ?? ''
  const [year, setYear] = useState('')
  const spaces = sortBySection(list<Space>(page.data.spaces)).filter(
    (space) =>
      (!program || space.program === program) &&
      (!year || String(space.year ?? sectionCode(space).match(/\d/)?.[0]) === year) &&
      `${space.title} ${space.subject}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  )
  const pageCount = Math.max(1, Math.ceil(spaces.length / 20))
  const pageNumber = Math.min(
    pageCount,
    Math.max(1, Number(params.get('page')) || 1),
  )
  const visible = spaces.slice((pageNumber - 1) * 20, pageNumber * 20)

  return (
    <div className="fx-page accs-stack accs-stagger">
      <PageHeader
        title={
          dean
            ? 'Sections'
            : session.user.roles.includes('chair')
              ? 'Program sections'
              : 'My classes'
        }
        description="Current term, from enrollment and teaching assignments."
      />
      {oversight && (
        <div className="fx-toolbar">
          <div className="fx-toolbar__row">
            <div className="fx-toolbar__search">
              <Search
                label="Find a section"
                size="sm"
                value={query}
                onChange={(q) => update({ q })}
              />
            </div>
            {dean && (
              <Select
                label="Program"
                selectedKey={program || 'all'}
                onSelectionChange={(key) =>
                  update({ program: key === 'all' ? undefined : String(key) })
                }
              >
                <SelectOption id="all">All programs</SelectOption>
                {['BSIT', 'BSCS', 'BSIS'].map((value) => (
                  <SelectOption id={value} key={value}>
                    {value}
                  </SelectOption>
                ))}
              </Select>
            )}
            <Select
              label="Year level"
              selectedKey={year || 'all'}
              onSelectionChange={(key) =>
                setYear(key === 'all' ? '' : String(key))
              }
            >
              <SelectOption id="all">All years</SelectOption>
              {['1', '2', '3', '4'].map((value) => (
                <SelectOption id={value} key={value}>
                  Year {value}
                </SelectOption>
              ))}
            </Select>
          </div>
        </div>
      )}
      {spaces.length ? (
        oversight ? (
          <>
            <div className="accs-table-wrap">
              <table className="accs-table" aria-label="Program sections">
                <thead>
                  <tr>
                    <th scope="col">Section</th>
                    <th scope="col">Program</th>
                    <th scope="col">Year</th>
                    <th scope="col">Adviser</th>
                    <th scope="col" className="accs-num">
                      Students
                    </th>
                    <th scope="col">Subject</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((space) => (
                    <tr key={space.id}>
                      <td>
                        <Link
                          variant="quiet"
                          className="fx-table-link"
                          href={`/spaces/${encodeURIComponent(space.id)}`}
                        >
                          {sectionCode(space)}
                        </Link>
                      </td>
                      <td>
                        <span className="accs-tag">{space.program}</span>
                      </td>
                      <td>{space.year ?? sectionCode(space).match(/\d/)?.[0] ?? '—'}</td>
                      <td>{adviserNames(space, 'Unassigned')}</td>
                      <td className="accs-num">
                        {space.studentCount ?? space.studentIds?.length ?? 0}
                      </td>
                      <td>{isSectionGroup(space) ? <span className="fx-muted">Section group</span> : space.subject}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pageCount > 1 && (
              <Pagination
                page={pageNumber}
                pageCount={pageCount}
                onPageChange={(next) => update({ page: String(next) })}
                summary={`${spaces.length} sections and subjects`}
              />
            )}
          </>
        ) : (
          <Panel flush>
            <ul className="accs-rows" aria-label="My classes">
              {spaces.map((space) => (
                <li key={space.id}>
                  <div className="accs-row fx-row">
                    <div>
                      <p className="accs-row__title">
                        <Link
                          variant="quiet"
                          className="fx-table-link"
                          href={`/spaces/${encodeURIComponent(space.id)}`}
                        >
                          {space.subject}
                        </Link>
                      </p>
                      <p className="accs-row__sub">
                        {space.program} · {sectionCode(space)} ·{' '}
                        {adviserNames(space, 'No adviser assigned')} ·{' '}
                        <span className="accs-num">{studentTotal(space)}</span>{' '}
                        students
                      </p>
                    </div>
                    {space.threadId && (
                      <Link
                        variant="quiet"
                        className="fx-table-link"
                        href={`/messages/${encodeURIComponent(space.threadId)}`}
                      >
                        Group chat
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        )
      ) : (
        <Panel>
          <Empty title="No classes linked to your account">
            Classes come from enrollment records. If one is missing, contact the
            CCS office.
          </Empty>
        </Panel>
      )}
    </div>
  )
}

function SpacePage({
  page,
  session,
}: {
  page: PageEnvelope
  session: Session
}) {
  const space = record<Space>(page.data.record)
  const [query, setQuery] = useState('')
  const academic = session.user.roles.some((role) =>
    ['professor', 'chair', 'dean'].includes(role),
  )
  const oversightOnly =
    session.user.roles.some((role) => ['chair', 'dean'].includes(role)) &&
    !session.user.roles.includes('student') &&
    !space?.professorIds?.includes(session.user.id)
  if (!space) return <RestrictedView record />
  const posts = list<CommunityPost>(page.data.posts).filter((post) =>
    `${post.title} ${post.body}`.toLowerCase().includes(query.toLowerCase()),
  )
  const discussions = posts.filter(
    (post) => oversightOnly || post.kind !== 'announcement',
  )
  const announcements = posts.filter((post) => post.kind === 'announcement')
  const disabledPosting = session.user.restrictions.includes('post.create')
  const canShowPost =
    page.data.canPost === true ||
    (session.user.roles.includes('student') && disabledPosting)
  const newPost = `/feed/new?space=${encodeURIComponent(`space:${space.id}`)}`

  return (
    <div className="fx-page accs-stack accs-stagger">
      <PageHeader
        crumbs={[
          { label: 'Classes and sections', href: '/spaces' },
          { label: sectionCode(space) },
        ]}
        title={`${sectionCode(space)} · ${space.subject}`}
        description={`${adviserNames(space, 'No adviser assigned')} · ${studentTotal(space)} students`}
        actions={
          <>
            {canShowPost && (
              <Button icon="plus" href={newPost} isDisabled={disabledPosting}>
                New post
              </Button>
            )}
            {space.threadId && (
              <Button
                variant="secondary"
                icon="chat"
                href={`/messages/${encodeURIComponent(space.threadId)}`}
              >
                Group chat
              </Button>
            )}
          </>
        }
      />
      <Tabs defaultSelectedKey={space.subjects ? 'subjects' : space.materials ? 'materials' : 'discussion'}>
        <TabList aria-label="Class space views">
          {space.subjects && <Tab id="subjects">Subjects</Tab>}
          {space.materials && <Tab id="materials">Materials</Tab>}
          <Tab id="discussion">Discussion</Tab>
          {!oversightOnly && <Tab id="announcements">Announcements</Tab>}
          <Tab id="members">{academic ? 'Roster' : 'Members'}</Tab>
          <Tab id="about">About</Tab>
        </TabList>
        {space.subjects && (
          <TabPanel id="subjects">
            <div className="fx-tab"><SubjectList subjects={space.subjects} /></div>
          </TabPanel>
        )}
        {space.materials && (
          <TabPanel id="materials">
            <div className="fx-tab"><SubjectMaterials spaceId={space.id} materials={space.materials} canManage={space.canManageMaterials === true} /></div>
          </TabPanel>
        )}
        <TabPanel id="discussion">
          <div className="fx-tab">
            <div className="fx-toolbar fx-toolbar--slim">
              <div className="fx-toolbar__search">
                <Search
                  label="Search class posts"
                  size="sm"
                  value={query}
                  onChange={setQuery}
                />
              </div>
            </div>
            {discussions.length ? (
              <ThreadList posts={discussions} spaces={[space]} />
            ) : (
              <Panel>
                <Empty
                  title={
                    query
                      ? 'No class posts match this search'
                      : 'No discussions yet'
                  }
                />
              </Panel>
            )}
          </div>
        </TabPanel>
        {!oversightOnly && (
          <TabPanel id="announcements">
            <div className="fx-tab">
              {announcements.length ? (
                <ThreadList posts={announcements} spaces={[space]} />
              ) : (
                <Panel>
                  <Empty title="No class announcements yet" />
                </Panel>
              )}
            </div>
          </TabPanel>
        )}
        <TabPanel id="members">
          <div className="fx-tab">
            {/* TBD(D-08): classmate-list visibility awaits final policy; only names and roles are shown to students. */}
            {!academic && (
              <p className="fx-note">
                <Icon name="info" size={16} />
                Member lists show names and roles only.
              </p>
            )}
            <MemberList members={space.students ?? []} academic={academic} />
          </div>
        </TabPanel>
        <TabPanel id="about">
          <div className="fx-tab">
            <Panel>
              <dl className="fx-facts">
                <div>
                  <dt>Subject</dt>
                  <dd>{space.subject}</dd>
                </div>
                <div>
                  <dt>Section</dt>
                  <dd>{sectionCode(space)}</dd>
                </div>
                <div>
                  <dt>Program</dt>
                  <dd>{space.program}</dd>
                </div>
                <div>
                  <dt>Adviser</dt>
                  <dd>{adviserNames(space, 'No adviser assigned')}</dd>
                </div>
              </dl>
            </Panel>
          </div>
        </TabPanel>
      </Tabs>
    </div>
  )
}

function OrganizationsPage({ page }: { page: PageEnvelope }) {
  const { params, update } = useFilters()
  const query = params.get('q') ?? ''
  const organizations = list<Organization>(page.data.organizations).filter(
    (organization) =>
      `${organization.name} ${organization.description}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  )
  return (
    <div className="fx-page accs-stack accs-stagger">
      <PageHeader
        title="Organizations"
        description="Approved CCS student organizations."
      />
      <div className="fx-toolbar fx-toolbar--slim">
        <div className="fx-toolbar__search">
          <Search
            label="Find an organization"
            size="sm"
            value={query}
            onChange={(q) => update({ q })}
          />
        </div>
      </div>
      {organizations.length ? (
        <Panel flush>
          <PagedList items={organizations} noun="organizations">
            {(organizations) => (
            <ul className="accs-rows" aria-label="Organizations">
              {organizations.map((organization) => (
                <li key={organization.id}>
                  <div className="accs-row fx-row">
                    <div>
                      <p className="accs-row__title">
                        <Link
                          variant="quiet"
                          className="fx-table-link"
                          href={`/organizations/${encodeURIComponent(organization.id)}`}
                        >
                          {organization.name}
                        </Link>
                      </p>
                      <p className="accs-row__sub">{organization.description}</p>
                    </div>
                    <span className="fx-count-label">
                      <span className="accs-num">{organization.memberCount ?? 0}</span>{' '}
                      members
                      {organization.member ? ' · Member' : ''}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            )}
          </PagedList>
        </Panel>
      ) : (
        <Panel>
          <Empty
            title={
              query
                ? `No organization named '${query}'`
                : 'No organizations to show'
            }
          />
        </Panel>
      )}
    </div>
  )
}

function OrganizationPage({
  page,
  session,
}: {
  page: PageEnvelope
  session: Session
}) {
  const organization = record<Organization>(page.data.record)
  if (!organization) return <RestrictedView record />
  const posts = list<CommunityPost>(page.data.posts)
  const events = list<CommunityEvent>(page.data.events)
  const representative = page.data.canPublish === true
  const memberCanPost =
    organization.member &&
    session.user.roles.some((role) => participatingRoles.includes(role))
  const disabledPosting = !session.permissions.includes('post.create')
  const composerHref = `/feed/new?space=${encodeURIComponent(`organization:${organization.id}`)}`

  return (
    <div className="fx-page accs-stack accs-stagger">
      <PageHeader
        crumbs={[
          { label: 'Organizations', href: '/organizations' },
          { label: organization.name },
        ]}
        title={organization.name}
        description={organization.description}
        actions={
          <>
            {representative && (
              <Button
                icon="megaphone"
                href={`${composerHref}&type=announcement`}
                isDisabled={disabledPosting}
              >
                New announcement
              </Button>
            )}
            {memberCanPost && (
              <Button
                icon="plus"
                variant={representative ? 'secondary' : 'primary'}
                href={composerHref}
                isDisabled={disabledPosting}
              >
                New post
              </Button>
            )}
          </>
        }
      />
      <p className="fx-count-label">
        <span className="accs-num">{organization.memberCount ?? 0}</span> members
        {organization.member ? ' · You’re a member' : ''}
      </p>
      <Tabs defaultSelectedKey="feed">
        <TabList aria-label="Organization views">
          <Tab id="feed">Feed</Tab>
          <Tab id="events">Events</Tab>
          {organization.member && <Tab id="members">Members</Tab>}
          <Tab id="about">About</Tab>
        </TabList>
        <TabPanel id="feed">
          <div className="fx-tab">
            {posts.length ? (
              <ThreadList posts={posts} organizations={[organization]} />
            ) : (
              <Panel>
                <Empty title="No organization posts yet">
                  {organization.member
                    ? 'Posts from this organization show here once it publishes one.'
                    : 'Public posts from this organization show here once it publishes one.'}
                </Empty>
              </Panel>
            )}
          </div>
        </TabPanel>
        <TabPanel id="events">
          <div className="fx-tab">
            {events.length ? (
              <Panel flush>
                <ul className="accs-rows" aria-label="Organization events">
                  {events.map((event) => {
                    const href = session.allowedPages.includes('P13')
                      ? `/calendar?date=${encodeURIComponent(event.date)}`
                      : undefined
                    const body = (
                      <>
                        <DateTile value={event.date} />
                        <div>
                          <p className="accs-row__title">{event.title}</p>
                          <p className="accs-row__sub">
                            {[
                              event.start,
                              event.location ?? event.place,
                              event.description,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        </div>
                        {href && (
                          <span className="fx-row-cta">
                            See in calendar
                            <Icon name="arrow-right" size={16} />
                          </span>
                        )}
                      </>
                    )
                    return (
                      <li key={event.id}>
                        {href ? (
                          <Link variant="quiet" className="accs-row" href={href}>
                            {body}
                          </Link>
                        ) : (
                          <div className="accs-row">{body}</div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </Panel>
            ) : (
              <Panel>
                <Empty title="No organization events scheduled" />
              </Panel>
            )}
          </div>
        </TabPanel>
        {organization.member && (
          <TabPanel id="members">
            <div className="fx-tab">
              <MemberList members={organization.members ?? []} organization />
            </div>
          </TabPanel>
        )}
        <TabPanel id="about">
          <div className="fx-tab">
            <Panel>
              <p className="fx-about">{organization.description}</p>
              <dl className="fx-facts">
                <div>
                  <dt>Verified representative</dt>
                  <dd>
                    {organization.representative?.name ?? 'Not assigned yet'}
                  </dd>
                </div>
                <div>
                  <dt>Members</dt>
                  <dd>{organization.memberCount ?? 0}</dd>
                </div>
              </dl>
              {/* TBD(D-06): member administration remains unavailable until representative powers are approved. */}
              {representative && (
                <p className="fx-note">
                  <Icon name="info" size={16} />
                  You can't manage members yet. Membership comes from the
                  verified organization roster.
                </p>
              )}
            </Panel>
          </div>
        </TabPanel>
      </Tabs>
    </div>
  )
}

export function CommunityPage({ page }: { page: PageEnvelope }) {
  const session = useQuery(sessionQuery())
  if (!session.data)
    return <ViewState kind="loading" title="Loading account context" />
  if (page.pageId === 'P04')
    return <FeedPage page={page} session={session.data} />
  if (page.pageId === 'P05')
    return <PostComposer page={page} session={session.data} />
  if (page.pageId === 'P06')
    return <PostDetailPage page={page} session={session.data} />
  if (page.pageId === 'P07')
    return <SpacesPage page={page} session={session.data} />
  if (page.pageId === 'P08')
    return <SpacePage page={page} session={session.data} />
  if (page.pageId === 'P09') return <OrganizationsPage page={page} />
  return <OrganizationPage page={page} session={session.data} />
}
