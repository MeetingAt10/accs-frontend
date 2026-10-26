import {
  Agenda,
  AgendaItem,
  Alert,
  AnnouncementCard,
  Avatar,
  Badge,
  Breadcrumbs,
  Button,
  Card,
  CardAction,
  CardBody,
  CardHeader,
  CardLink,
  CardMeta,
  CardTitle,
  Cell,
  Checkbox,
  Column,
  Container,
  DatePicker,
  Disclosure,
  Divider,
  DoorPlate,
  EmptyState,
  ForumCard,
  Grid,
  Link,
  MenuButton,
  MenuItem,
  Modal,
  ModalActions,
  ModalBody,
  Pagination,
  Radio,
  RadioGroup,
  RoleBadge,
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
  Tile,
  ViewState,
  toast,
} from '@meetingat10/design-system/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useBlocker, useRouter, useRouterState } from '@tanstack/react-router'
import { useRef, useState, type FormEvent, type ReactNode } from 'react'

import { IdentityChoice } from '@/components/app/grievance'
import { RestrictedView } from '@/components/app/guards'
import {
  Comment,
  CommentThread,
  FilterBar,
  ReactionButton,
} from '@/components/ds-next'
import {
  performPageAction,
  type PageAction,
  type PageEnvelope,
  type Session,
} from '@/lib/api'
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
}

export interface CommunityPost {
  id: string
  title: string
  body: string
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
  administrator: 'Administrator',
  staff: 'CCS Staff',
  president: 'President’s Office',
}

function list<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

function record<T>(value: unknown): T | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as T)
    : undefined
}

function formatDate(value: string | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })
}

function personRole(person: Person) {
  return (person.roles ?? []).map((role) => roleNames[role] ?? role).join(' · ')
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
  if (kind === 'space')
    return spaces.find((space) => space.id === id)?.title ?? 'Class space'
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
        : 'Try again. Your entered text is kept.'}
    </Alert>
  )
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

function PostCards({
  posts,
  spaces,
  organizations,
}: {
  posts: CommunityPost[]
  spaces?: Space[]
  organizations?: Organization[]
}) {
  const announcements = posts
    .filter((post) => post.kind === 'announcement')
    .sort(
      (a, b) =>
        ['urgent', 'important', 'general'].indexOf(a.priority) -
        ['urgent', 'important', 'general'].indexOf(b.priority),
    )
  const discussions = posts.filter((post) => post.kind !== 'announcement')

  return (
    <div className="app-card-list">
      {announcements.map((post) => (
        <AnnouncementCard
          key={post.id}
          lane={
            post.audience.startsWith('organization:') ? 'community' : 'schedule'
          }
          title={post.title}
          when={formatDate(post.at)}
          dateTime={post.at}
          href={`/feed/${encodeURIComponent(post.id)}`}
          meta={
            <Row gap={8}>
              <span>
                {post.author?.name ?? 'College office'} ·{' '}
                {audienceName(post.audience, spaces, organizations)}
              </span>
              <Badge
                tone={post.priority === 'urgent' ? 'warning' : 'neutral'}
                outline
              >
                {post.priority || 'general'}
              </Badge>
            </Row>
          }
        >
          {post.body.slice(0, 220)}
        </AnnouncementCard>
      ))}
      {discussions.length > 0 && <Divider label="Discussions" />}
      {discussions.map((post) => (
        <ForumCard
          key={post.id}
          topic={post.label}
          title={post.title}
          excerpt={post.body.slice(0, 220)}
          author={post.author?.name ?? 'College member'}
          replies={post.commentCount}
          status={`${audienceName(post.audience, spaces, organizations)} · ${formatDate(post.at)}`}
          href={`/feed/${encodeURIComponent(post.id)}`}
        />
      ))}
    </div>
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
        .map((space) => ({ id: `space:${space.id}`, label: space.title })),
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
  const posts = list<CommunityPost>(page.data.posts)
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
  const filters = [
    ...(query ? [{ id: 'q', label: `Search: ${query}` }] : []),
    ...labels.map((label) => ({ id: label, label })),
  ]

  function clearFilters() {
    update({ q: undefined, label: undefined, sort: undefined, page: undefined })
  }

  return (
    <>
      <Heading
        title="Feed"
        description="Discussions and announcements in your permitted spaces."
        actions={
          canParticipate && (
            <Button
              icon="plus"
              href="/feed/new"
              isDisabled={page.data.canPost !== true}
            >
              New post
            </Button>
          )
        }
      />
      <Tabs
        selectedKey={scope}
        onSelectionChange={(key) => update({ scope: String(key) })}
      >
        <TabList aria-label="Feed scope">
          {uniqueScopes.map((option) => (
            <Tab id={option.id} key={option.id}>
              {option.label}
            </Tab>
          ))}
        </TabList>
        {uniqueScopes.map((option) => (
          <TabPanel id={option.id} key={option.id}>
            <div className="app-page">
              <FilterBar
                query={query}
                onQueryChange={(q) => update({ q })}
                searchLabel="Search posts"
              >
                <Select
                  label="Sort"
                  selectedKey={sort}
                  onSelectionChange={(key) => update({ sort: String(key) })}
                >
                  <SelectOption id="newest">Newest</SelectOption>
                  <SelectOption id="active">Most active</SelectOption>
                </Select>
              </FilterBar>
              <TagGroup
                label="Post labels"
                selectionMode="multiple"
                selectedKeys={new Set(labels)}
                onSelectionChange={(keys) =>
                  update({
                    label:
                      keys === 'all'
                        ? ['Announcements', ...postLabels].join(',')
                        : [...keys].map(String).join(','),
                  })
                }
              >
                {['Announcements', ...postLabels].map((label) => (
                  <Tag id={label} key={label}>
                    {label}
                  </Tag>
                ))}
              </TagGroup>
              {filters.length > 0 && (
                <TagGroup
                  label="Active filters"
                  items={filters}
                  onRemove={(keys) =>
                    update({
                      q: keys.has('q') ? undefined : query,
                      label: labels
                        .filter((label) => !keys.has(label))
                        .join(','),
                    })
                  }
                >
                  {(filter) => <Tag id={filter.id}>{filter.label}</Tag>}
                </TagGroup>
              )}
              {posts.length ? (
                <>
                  <PostCards
                    posts={pagePosts}
                    spaces={spaces}
                    organizations={organizations}
                  />
                  <Pagination
                    page={pageNumber}
                    pageCount={pageCount}
                    onPageChange={(next) => update({ page: String(next) })}
                    summary={`Showing ${(pageNumber - 1) * 10 + 1}–${Math.min(pageNumber * 10, posts.length)} of ${posts.length} posts`}
                  />
                </>
              ) : (
                <ViewState
                  kind="empty"
                  title={
                    query
                      ? `No posts match '${query}'`
                      : labels.length
                        ? 'No posts match these filters'
                        : 'No posts in this space yet'
                  }
                  description="Only content in the selected scope is shown."
                  actions={
                    query || labels.length > 0 ? (
                      <Button variant="secondary" onPress={clearFilters}>
                        Clear filters
                      </Button>
                    ) : undefined
                  }
                />
              )}
            </div>
          </TabPanel>
        ))}
      </Tabs>
    </>
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
    <Container width="reading" className="community-composer-container">
      <Breadcrumbs
        items={[{ label: 'Feed', href: '/feed' }, { label: 'New post' }]}
      />
      <Heading title="New post" />
      {invalidRequestedAudience && (
        <Alert tone="danger" title="You can't post there">
          Choose one of the audiences listed below.
        </Alert>
      )}
      <form className="app-page community-form" onSubmit={submit} noValidate>
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
          description="Keep personal details out. Posts are checked for harmful words."
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
        {kind === 'announcement' && (
          <RadioGroup
            label="Priority"
            row
            value={priority}
            onChange={setPriority}
            description="Priority levels are awaiting policy approval."
          >
            <Radio value="general">General</Radio>
            <Radio value="important">Important</Radio>
            <Radio value="urgent">Urgent</Radio>
          </RadioGroup>
        )}
        {/* TBD(D-06): announcement priority levels and wider organization publishing await approval. */}
        {eventRequired && (
          <Disclosure title="Event details" defaultExpanded>
            <div className="app-page">
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
              <Checkbox isSelected={notifyMembers} onChange={setNotifyMembers}>
                Notify members
              </Checkbox>
            </div>
          </Disclosure>
        )}
        {/* TBD(D-08): attachment handling and retention are not approved. */}
        <Alert tone="neutral" title="Attachments are not enabled">
          Attachment handling is awaiting approval. Keep this post to text for
          now.
        </Alert>
        {session.user.roles.some((role) =>
          ['guidance', 'osas'].includes(role),
        ) && (
          <Alert
            tone="neutral"
            title="Keep case information in the case record"
          >
            Don't include case details here.
          </Alert>
        )}
        <ActionError error={action.error} />
        <Row>
          <Button type="submit" loading={action.isPending}>
            Publish
          </Button>
          <Button
            variant="secondary"
            onPress={() => router.history.push('/feed')}
          >
            Cancel
          </Button>
        </Row>
      </form>
      <Modal
        title="Discard this post?"
        role="alertdialog"
        isOpen={blocker.status === 'blocked'}
        onOpenChange={(open) => {
          if (!open && blocker.status === 'blocked') blocker.reset()
        }}
      >
        <ModalBody>Your entered text will be discarded.</ModalBody>
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
    </Container>
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
  return (
    <article className="community-post-view">
      <SectionHeader level={1} title={post.title} />
      <Row gap={8}>
        <Avatar name={post.author?.name ?? 'College member'} size={36} />
        <strong>{post.author?.name ?? 'College member'}</strong>
        {personRole(post.author ?? { name: '' }) && (
          <RoleBadge>{personRole(post.author)}</RoleBadge>
        )}
        <span>{audienceName(post.audience, spaces, organizations)}</span>
        <time dateTime={post.at}>{formatDate(post.at)}</time>
      </Row>
      <Row gap={8}>
        <Badge outline>
          {post.kind === 'announcement' ? 'Announcement' : post.label}
        </Badge>
        {post.kind === 'announcement' && (
          <Badge
            tone={post.priority === 'urgent' ? 'warning' : 'neutral'}
            outline
          >
            {post.priority}
          </Badge>
        )}
        {post.private && (
          <Badge outline marker={false}>
            Members
          </Badge>
        )}
      </Row>
      <div className="ds-prose community-post-body">{post.body}</div>
      {post.eventDate && (
        <dl className="ds-record__facts">
          <div>
            <dt>Event date</dt>
            <dd>{post.eventDate}</dd>
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
        description="The content is no longer available in the community."
      />
    )

  function focusReply() {
    document
      .querySelector<HTMLTextAreaElement>('#community-comment-form textarea')
      ?.focus()
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
      toast('Copy the address from your browser to share this link.', {
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
      setEditError('Enter a title, text, and label before saving.')
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
      <Breadcrumbs
        items={[{ label: 'Feed', href: '/feed' }, { label: 'Post' }]}
      />
      <PostView post={post} />
      <Row>
        <ReactionButton
          count={post.reactionCount}
          isSelected={post.reacted}
          isDisabled={page.data.canReact !== true}
          loading={action.isPending}
          onChange={() =>
            action.mutate({ action: 'react', recordId: post.id, payload: {} })
          }
        />
        {page.data.canComment === true && (
          <Button variant="tertiary" onPress={focusReply}>
            Reply
          </Button>
        )}
        <MenuButton
          iconOnly
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
        {ownReport && (
          <Link href={`/reports/${encodeURIComponent(ownReport.id)}`}>
            View your linked report
          </Link>
        )}
      </Row>
      {showConversionPrompt && (
        <Alert
          tone="info"
          title="Many people agree with this. Turn it into a report?"
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
          Only you can decide. Nothing is filed unless you choose to.
        </Alert>
      )}
      <ActionError error={action.error} />
      <section className="app-page" aria-labelledby="community-comments-title">
        <SectionHeader
          level={2}
          title="Comments"
          description={`${post.commentCount} ${post.commentCount === 1 ? 'comment' : 'comments'}`}
          id="community-comments-title"
        />
        {post.comments.length ? (
          <>
            <CommentThread>
              {post.comments.slice(0, shownComments).map((comment) => (
                <Comment
                  key={comment.id}
                  author={comment.author?.name ?? 'College member'}
                  role={personRole(comment.author ?? { name: '' })}
                  date={formatDate(comment.at)}
                  dateTime={comment.at}
                  actions={
                    <>
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
                        label="Comment actions"
                        onAction={() => openReport('comment', comment.id)}
                      >
                        <MenuItem id="report">Report comment</MenuItem>
                      </MenuButton>
                    </>
                  }
                >
                  {comment.body}
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
          <ViewState
            kind="empty"
            title="No comments yet"
            description="A comment can add context or ask a question."
          />
        )}
        {page.data.canComment === true ? (
          <form
            id="community-comment-form"
            className="app-page"
            onSubmit={sendComment}
          >
            <TextArea
              label="Add a comment"
              value={body}
              onChange={setBody}
              isRequired
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
            <Row>
              <Button
                type="submit"
                loading={action.isPending}
                isDisabled={!body.trim()}
              >
                Comment
              </Button>
            </Row>
          </form>
        ) : session.user.restrictions.includes('post.comment') ? (
          <Alert tone="neutral" title="Commenting is paused">
            You can continue reading.{' '}
            <Link href="/standing">View account standing</Link>.
          </Alert>
        ) : null}
      </section>
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
            <p>Moderators review reports. A report is not a finding.</p>
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
          <p>The post will no longer be available in the community.</p>
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

function MemberTable({
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

  return (
    <div className="app-page">
      <Search
        label={academic ? 'Search roster' : 'Search members'}
        showLabel
        value={query}
        onChange={(value) => {
          setQuery(value)
          setPage(1)
        }}
      />
      {filtered.length ? (
        <>
          <Table aria-label={academic ? 'Class roster' : 'Member names'}>
            <TableHeader>
              <Column id="name" isRowHeader>
                Name
              </Column>
              {academic && <Column id="studentId">Student ID</Column>}
              {academic && <Column id="program">Program</Column>}
              <Column id="role">{academic ? 'Status' : 'Role'}</Column>
            </TableHeader>
            <TableBody>
              {visible.map((member, index) => (
                <TableRow
                  id={member.id ?? `member-${index}`}
                  key={member.id ?? `member-${index}`}
                >
                  <Cell>
                    <Row gap={8}>
                      <Avatar name={member.name} size={32} />
                      {member.name}
                    </Row>
                  </Cell>
                  {academic && <Cell reference>{member.studentId ?? '—'}</Cell>}
                  {academic && <Cell>{member.program ?? '—'}</Cell>}
                  <Cell>
                    {academic ? (
                      <Badge tone="neutral" outline>
                        Enrolled
                      </Badge>
                    ) : organization ? (
                      (member.organizationRole ?? member.role ?? 'Member')
                    ) : (
                      personRole(member)
                    )}
                  </Cell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination
            page={currentPage}
            pageCount={pageCount}
            onPageChange={setPage}
            summary={`${filtered.length} ${academic ? 'students' : 'members'}`}
          />
        </>
      ) : (
        <ViewState
          kind="empty"
          title={
            query ? 'No members match this search' : 'No member names to show'
          }
        />
      )}
    </div>
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
  const spaces = list<Space>(page.data.spaces).filter(
    (space) =>
      (!program || space.program === program) &&
      (!year || String(space.year ?? space.title.match(/\d/)?.[0]) === year),
  )
  const pageCount = Math.max(1, Math.ceil(spaces.length / 20))
  const pageNumber = Math.min(
    pageCount,
    Math.max(1, Number(params.get('page')) || 1),
  )
  const visible = spaces.slice((pageNumber - 1) * 20, pageNumber * 20)

  return (
    <>
      <Heading
        title={
          dean
            ? 'Sections'
            : session.user.roles.includes('chair')
              ? 'Program sections'
              : 'My classes'
        }
        description="Current term · approved enrollment and teaching assignments"
      />
      {oversight && (
        <FilterBar
          query={query}
          onQueryChange={(q) => update({ q })}
          searchLabel="Find a section"
        >
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
        </FilterBar>
      )}
      {spaces.length ? (
        oversight ? (
          <>
            <Table aria-label="Program sections">
              <TableHeader>
                <Column id="section" isRowHeader>
                  Section
                </Column>
                <Column id="program">Program</Column>
                <Column id="year">Year</Column>
                <Column id="adviser">Adviser</Column>
                <Column id="students" numeric>
                  Students
                </Column>
                <Column id="subject">Subject</Column>
              </TableHeader>
              <TableBody>
                {visible.map((space) => (
                  <TableRow
                    id={space.id}
                    key={space.id}
                    href={`/spaces/${encodeURIComponent(space.id)}`}
                  >
                    <Cell>{space.title}</Cell>
                    <Cell>{space.program}</Cell>
                    <Cell>
                      {space.year ?? space.title.match(/\d/)?.[0] ?? '—'}
                    </Cell>
                    <Cell>
                      {space.professors
                        ?.map((person) => person.name)
                        .join(', ') || 'Unassigned'}
                    </Cell>
                    <Cell numeric>
                      {space.studentCount ?? space.studentIds?.length ?? 0}
                    </Cell>
                    <Cell>{space.subject}</Cell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination
              page={pageNumber}
              pageCount={pageCount}
              onPageChange={(next) => update({ page: String(next) })}
              summary={`${spaces.length} sections and subjects`}
            />
          </>
        ) : (
          <Grid columns={3}>
            {spaces.map((space) => (
              <Card key={space.id} className="community-space-card">
                <CardHeader>
                  <DoorPlate size="sm" outline code={space.title} />
                </CardHeader>
                <CardTitle>{space.subject}</CardTitle>
                <CardBody>
                  {space.professors?.map((person) => person.name).join(', ') ||
                    'Faculty assignment pending'}
                </CardBody>
                <CardMeta>
                  <span>
                    {space.studentCount ?? space.studentIds?.length ?? 0}{' '}
                    students
                  </span>
                  <Link
                    href={`/spaces/${encodeURIComponent(space.id)}`}
                    aria-label={`Open ${space.title}`}
                  >
                    <CardAction>Open space</CardAction>
                  </Link>
                </CardMeta>
                {space.threadId && (
                  <Link
                    href={`/messages/${encodeURIComponent(space.threadId)}`}
                  >
                    Group chat
                  </Link>
                )}
              </Card>
            ))}
          </Grid>
        )
      ) : (
        <EmptyState
          title="No classes linked to your account yet"
          description="Classes come from enrollment records. Contact the CCS office if this is wrong."
        />
      )}
    </>
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
  const disabledPosting = session.user.restrictions.includes('post.create')
  const canShowPost =
    page.data.canPost === true ||
    (session.user.roles.includes('student') && disabledPosting)
  const newPost = `/feed/new?space=${encodeURIComponent(`space:${space.id}`)}`

  return (
    <>
      <Breadcrumbs
        items={[
          { label: 'Classes and sections', href: '/spaces' },
          { label: space.title },
        ]}
      />
      <Heading
        title={`${space.title} · ${space.subject}`}
        description={`${space.professors?.map((person) => person.name).join(', ') || 'Faculty assignment pending'} · ${space.studentCount ?? space.studentIds?.length ?? space.students?.length ?? 0} students`}
        actions={
          <>
            {canShowPost && (
              <Button href={newPost} isDisabled={disabledPosting}>
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
      <Tabs defaultSelectedKey="discussion">
        <TabList aria-label="Class space views">
          <Tab id="discussion">Discussion</Tab>
          {!oversightOnly && <Tab id="announcements">Announcements</Tab>}
          <Tab id="members">{academic ? 'Roster' : 'Members'}</Tab>
        </TabList>
        <TabPanel id="discussion">
          <div className="app-page">
            <FilterBar
              query={query}
              onQueryChange={setQuery}
              searchLabel="Search class posts"
            />
            {posts.filter(
              (post) => oversightOnly || post.kind !== 'announcement',
            ).length ? (
              <PostCards
                posts={posts.filter(
                  (post) => oversightOnly || post.kind !== 'announcement',
                )}
                spaces={[space]}
              />
            ) : (
              <ViewState
                kind="empty"
                title={
                  query
                    ? 'No class posts match this search'
                    : 'No discussions yet'
                }
              />
            )}
          </div>
        </TabPanel>
        {!oversightOnly && (
          <TabPanel id="announcements">
            {posts.some((post) => post.kind === 'announcement') ? (
              <PostCards
                posts={posts.filter((post) => post.kind === 'announcement')}
                spaces={[space]}
              />
            ) : (
              <ViewState kind="empty" title="No class announcements yet" />
            )}
          </TabPanel>
        )}
        <TabPanel id="members">
          <div className="app-page">
            {/* TBD(D-08): classmate-list visibility awaits final policy; only names and roles are shown to students. */}
            {!academic && (
              <Alert
                tone="neutral"
                title="Member list visibility is under review"
              >
                This view shows names and roles only.
              </Alert>
            )}
            <MemberTable members={space.students ?? []} academic={academic} />
          </div>
        </TabPanel>
      </Tabs>
    </>
  )
}

function OrganizationsPage({ page }: { page: PageEnvelope }) {
  const { params, update } = useFilters()
  const query = params.get('q') ?? ''
  const organizations = list<Organization>(page.data.organizations)
  return (
    <>
      <Heading
        title="Organizations"
        description="Approved CCS student organizations."
      />
      <Search
        label="Find an organization"
        showLabel
        value={query}
        onChange={(q) => update({ q })}
      />
      {organizations.length ? (
        <Grid columns={3}>
          {organizations.map((organization) => (
            <CardLink
              href={`/organizations/${encodeURIComponent(organization.id)}`}
              key={organization.id}
              className="community-organization-card"
            >
              <Tile icon="flag" tone="community" />
              <h2 className="ds-card__title">{organization.name}</h2>
              <p className="ds-card__body">{organization.description}</p>
              <Row gap={8}>
                <span>{organization.memberCount ?? 0} members</span>
                {organization.member && (
                  <Badge tone="info" outline>
                    Member
                  </Badge>
                )}
              </Row>
            </CardLink>
          ))}
        </Grid>
      ) : (
        <ViewState
          kind="empty"
          title={
            query
              ? `No organization named '${query}'`
              : 'No organizations to show'
          }
        />
      )}
    </>
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
    <>
      <Breadcrumbs
        items={[
          { label: 'Organizations', href: '/organizations' },
          { label: organization.name },
        ]}
      />
      <Heading
        title={organization.name}
        description={organization.description}
        actions={
          <>
            {representative && (
              <Button
                href={`${composerHref}&type=announcement`}
                isDisabled={disabledPosting}
              >
                New announcement
              </Button>
            )}
            {memberCanPost && (
              <Button
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
      <Row gap={8}>
        <Tile icon="flag" tone="community" label="Verified organization" />
        <Badge tone="info">Verified organization</Badge>
        {organization.member && <Badge outline>Member</Badge>}
      </Row>
      <Tabs defaultSelectedKey="feed">
        <TabList aria-label="Organization views">
          <Tab id="feed">Feed</Tab>
          <Tab id="events">Events</Tab>
          {organization.member && <Tab id="members">Members</Tab>}
          <Tab id="about">About</Tab>
        </TabList>
        <TabPanel id="feed">
          {posts.length ? (
            <PostCards posts={posts} organizations={[organization]} />
          ) : (
            <ViewState
              kind="empty"
              title="No organization posts yet"
              description={
                organization.member
                  ? 'Posts for this organization will appear here.'
                  : 'Public posts for this organization will appear here.'
              }
            />
          )}
        </TabPanel>
        <TabPanel id="events">
          {events.length ? (
            <Agenda>
              {events.map((event) => (
                <AgendaItem
                  key={event.id}
                  chip={event.date}
                  lane="community"
                  title={event.title}
                  href={
                    session.allowedPages.includes('P13')
                      ? `/calendar?date=${encodeURIComponent(event.date)}`
                      : undefined
                  }
                  linkLabel="See in calendar"
                >
                  {[
                    event.start,
                    event.location ?? event.place,
                    event.description,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </AgendaItem>
              ))}
            </Agenda>
          ) : (
            <ViewState kind="empty" title="No organization events scheduled" />
          )}
        </TabPanel>
        {organization.member && (
          <TabPanel id="members">
            <MemberTable members={organization.members ?? []} organization />
          </TabPanel>
        )}
        <TabPanel id="about">
          <div className="app-page">
            <div className="ds-prose">
              <p>{organization.description}</p>
            </div>
            <dl className="ds-record__facts">
              <div>
                <dt>Verified representative</dt>
                <dd>
                  {organization.representative?.name ?? 'Awaiting assignment'}
                </dd>
              </div>
            </dl>
            {/* TBD(D-06): member administration remains unavailable until representative powers are approved. */}
            {representative && (
              <Alert
                tone="neutral"
                title="Member management is awaiting approval"
              >
                Membership comes from the verified organization roster.
              </Alert>
            )}
          </div>
        </TabPanel>
      </Tabs>
    </>
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
