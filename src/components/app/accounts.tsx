import {
  Alert,
  Button,
  Checkbox,
  CheckboxGroup,
  FileUpload,
  IconButton,
  Modal,
  ModalActions,
  ModalBody,
  Progress,
  Radio,
  RadioGroup,
  Search,
  Segment,
  SegmentedControl,
  Select,
  SelectOption,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  TextField,
  ViewState,
  toast,
} from '@meetingat10/design-system/react'
import { keepPreviousData, queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useBlocker, useSearch } from '@tanstack/react-router'
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'

import { RequirePermission } from '@/components/app/guards'
import { Empty, PageHeader, Panel, StatusChip } from '@/components/app/page-shell'
import { PagedList } from '@/components/app/paging'
import {
  chunk,
  columnLabels,
  credentialsCsv,
  emptyStudent,
  isEmail,
  parseStudentRows,
  programNames,
  programs,
  studentProblems,
  toStudent,
  type IssuedStudent,
  type ParsedStudent,
  type StudentDraft,
  type StudentField,
  type StudentProblems,
} from '@/lib/account-import'
import {
  activateSecretary,
  ApiError,
  createFaculty,
  createStudents,
  getAccountTypes,
  getAdvisors,
  listAccounts,
  listFaculty,
  setAccountActive,
  setAdvisors,
  setChair,
  type AccountSummary,
  type BatchResult,
  type Credentials,
  type FacultyAccount,
  type Invite,
  type NewFaculty,
  type NewStudent,
  type Program,
  type Provisioned,
  type RowResult,
} from '@/lib/api'
import { sessionQuery } from '@/lib/queries'

import './accounts.css'

// Account provisioning. The dean activates the secretary; the secretary creates faculty and students, chooses advisors and
// program chairs, and switches accounts on and off. Temporary sign-in details come back once from the server and are shown
// once: they live in component state only and are never stored.

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`

const errorText = (error: unknown) =>
  error instanceof ApiError ? error.message : "Can't reach ACCS right now. Check your connection and try again."

/** The messages the server attached to single fields, by field name. */
const fieldErrors = (error: unknown): Record<string, string> =>
  Object.fromEntries((error instanceof ApiError ? (error.fields ?? []) : []).map((field) => [field.path.split('.').pop() ?? field.path, field.message]))

const typesQuery = queryOptions({ queryKey: ['accounts', 'types'], queryFn: getAccountTypes })
const facultyQuery = queryOptions({ queryKey: ['accounts', 'faculty'], queryFn: () => listFaculty() })
const advisorsQuery = queryOptions({ queryKey: ['accounts', 'advisors'], queryFn: getAdvisors })
const chairsQuery = queryOptions({ queryKey: ['accounts', 'chairs'], queryFn: () => listAccounts({ role: 'chair' }) })

/** Reloads every account list after a change. */
function useRefresh() {
  const client = useQueryClient()
  return () => client.invalidateQueries({ queryKey: ['accounts'] })
}

/** The value, once it has stopped changing for a moment, so typing in a search box does not ask the server on every key. */
function useDebounced(value: string, delay = 300) {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return settled
}

async function copy(value: string, what: string) {
  try {
    await navigator.clipboard.writeText(value)
    toast(`${what} copied.`, { tone: 'success' })
  } catch {
    toast('Copy is unavailable here. Select the text and copy it yourself.')
  }
}

function saveFile(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

type Loadable = { isPending: boolean; isError: boolean; error: unknown; data: unknown; refetch: () => unknown }

/** Loading, failed and ready states for the queries a view needs. A failed refresh keeps showing the data it already has. */
function Gate({ queries, what, children }: { queries: Loadable[]; what: string; children: ReactNode }) {
  const failed = queries.find((query) => query.isError && !query.data)
  if (queries.some((query) => query.isPending)) return <ViewState kind="loading" title={`Loading ${what}`} />
  if (failed) {
    return (
      <ViewState
        kind="error"
        title={`Couldn't load ${what}`}
        description={errorText(failed.error)}
        actions={
          <Button variant="secondary" onPress={() => void failed.refetch()}>
            Try again
          </Button>
        }
      />
    )
  }
  return <>{children}</>
}

// --- sign-in details, shown once ---------------------------------------------------------------------------------------

type Issued = { name: string; email: string; credentials: Credentials; invite: Invite }

const issuedFrom = ({ account, credentials, invite }: Provisioned): Issued => ({
  name: account.name,
  email: account.email,
  credentials,
  invite,
})

const duplicateField: Record<string, string> = { DUPLICATE_EMAIL: 'email', DUPLICATE_ID: 'studentId' }

/** The one row of a request that sent one account. A row the server refused throws, so the form can show why. */
function single({ results }: BatchResult): Provisioned {
  const row = results[0]
  if (row?.status === 'created') return row
  const path = row && duplicateField[row.code]
  throw new ApiError(row?.error ?? 'The account could not be created.', 400, {
    code: row?.code,
    fields: row?.fields ?? (path ? [{ path, message: row?.error }] : undefined),
  })
}

function Secret({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        <code className="accs-mono">{value}</code>
        <IconButton icon="copy" label={`Copy ${label.toLowerCase()}`} onPress={() => void copy(value, label)} />
      </dd>
    </div>
  )
}

function CredentialsDialog({ issued, onClose }: { issued?: Issued; onClose: () => void }) {
  return (
    <Modal
      title={issued ? `Sign-in details for ${issued.name}` : 'Sign-in details'}
      isOpen={Boolean(issued)}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      isDismissable={false}
      isKeyboardDismissDisabled
    >
      <ModalBody>
        {issued && (
          <>
            <Alert tone="warning" title="Shown only once">
              Copy these details now and give them to {issued.name}. They can't be shown again. {issued.name} must choose a new
              username and password the first time they sign in.
            </Alert>
            <dl className="acct-secret">
              <Secret label="Username" value={issued.credentials.username} />
              <Secret label="Temporary password" value={issued.credentials.temporaryPassword} />
              <Secret label="Sign-in link" value={issued.invite.signInUrl} />
            </dl>
            <p>
              {issued.invite.sent
                ? `An email with these details was sent to ${issued.email}.`
                : `No email was sent. Give these details to ${issued.name} yourself.`}
            </p>
          </>
        )}
      </ModalBody>
      <ModalActions>
        <Button onPress={onClose}>Done</Button>
      </ModalActions>
    </Modal>
  )
}

// --- dean: activate the secretary --------------------------------------------------------------------------------------

function ActivateForm({
  secretary,
  onClose,
  onIssued,
}: {
  secretary?: AccountSummary
  onClose: () => void
  onIssued: (issued: Issued) => void
}) {
  const refresh = useRefresh()
  const [name, setName] = useState(secretary?.name ?? '')
  // The seeded secretary has a placeholder address that cannot receive mail.
  const [email, setEmail] = useState(secretary && !secretary.email.endsWith('.invalid') ? secretary.email : '')
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({})
  const mutation = useMutation({
    mutationFn: activateSecretary,
    onSuccess: ({ record }) => {
      void refresh()
      onIssued(issuedFrom(record))
    },
    onError: (error) => setErrors(fieldErrors(error)),
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    const next = {
      name: name.trim().length >= 2 ? undefined : "Enter the secretary's full name.",
      email: isEmail(email.trim()) ? undefined : "Enter the secretary's email address.",
    }
    setErrors(next)
    if (next.name || next.email) return
    mutation.mutate({ name: name.trim(), email: email.trim() })
  }

  return (
    <form className="acct-modal-form" onSubmit={submit} noValidate>
      <ModalBody>
        <p>
          ACCS creates a temporary username and password for the secretary. The secretary must replace both the first time they
          sign in.
        </p>
        <TextField
          label="Full name"
          value={name}
          onChange={setName}
          autoComplete="off"
          isInvalid={Boolean(errors.name)}
          errorMessage={errors.name}
        />
        <TextField
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="off"
          description="The sign-in link and details are emailed here. If the email can't be sent, you'll see the details once on the next screen."
          isInvalid={Boolean(errors.email)}
          errorMessage={errors.email}
        />
        {mutation.error && !errors.name && !errors.email && (
          <Alert tone="danger" title="The secretary couldn't be activated">
            {errorText(mutation.error)}
          </Alert>
        )}
      </ModalBody>
      <ModalActions>
        <Button variant="secondary" onPress={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={mutation.isPending}>
          {secretary?.active ? 'Issue new details' : 'Activate'}
        </Button>
      </ModalActions>
    </form>
  )
}

function SecretaryState({ account, onOpen }: { account?: AccountSummary; onOpen: () => void }) {
  if (account?.active && !account.mustChangeCredentials) return <StatusChip tone="ok">Active</StatusChip>
  const waiting = Boolean(account?.active)
  return (
    <div className="acct-state">
      <StatusChip tone={waiting ? 'warn' : 'neutral'}>{waiting ? 'Waiting for first sign-in' : 'Not active'}</StatusChip>
      <Button size="sm" variant={waiting ? 'secondary' : 'primary'} onPress={onOpen}>
        {waiting ? 'New sign-in details' : 'Activate'}
      </Button>
    </div>
  )
}

function DeanAccounts() {
  const types = useQuery(typesQuery)
  const [activating, setActivating] = useState(false)
  const [issued, setIssued] = useState<Issued>()
  const secretary = types.data?.secretary
  return (
    <div className="accs-stack accs-stagger">
      <PageHeader
        title="Accounts"
        description="The secretary creates and manages every other account, so start by activating the secretary."
      />
      <Gate queries={[types]} what="accounts">
        <Panel title="Step 1: Activate the secretary">
          <div className="accs-stack accs-stack--tight">
            <p className="acct-lead">
              {secretary
                ? `${secretary.name} is the secretary. Their temporary sign-in details are shown once, so give them to the secretary right away.`
                : 'No secretary has been set up yet. Activating the secretary shows their temporary sign-in details once.'}
            </p>
            <SecretaryState account={secretary} onOpen={() => setActivating(true)} />
          </div>
        </Panel>
        <Panel flush title="Account types">
          <div className="acct-scroll">
            <table className="accs-table acct-table acct-stack" aria-label="Account types">
              <thead>
                <tr>
                  <th scope="col">Account type</th>
                  <th scope="col" className="accs-num">
                    Active
                  </th>
                  <th scope="col" className="accs-num">
                    Not active
                  </th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {types.data?.types.map((row) => (
                  <tr key={row.type}>
                    <td className="acct-main">
                      <span className="acct-person">
                        <strong>{row.label}</strong>
                        {row.type === 'secretary' && secretary && <small>{secretary.name}</small>}
                      </span>
                    </td>
                    <td data-label="Active" className="accs-num">
                      {row.active}
                    </td>
                    <td data-label="Not active" className="accs-num">
                      {row.inactive}
                    </td>
                    <td data-label="Status">
                      {row.type === 'secretary' ? (
                        <span className="acct-muted">Set up above</span>
                      ) : (
                        <span className="acct-muted">Managed by the secretary</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </Gate>
      <Modal
        title={secretary?.active ? 'Issue new sign-in details' : 'Activate the secretary'}
        isOpen={activating}
        onOpenChange={setActivating}
      >
        <ActivateForm
          secretary={secretary}
          onClose={() => setActivating(false)}
          onIssued={(next) => {
            setActivating(false)
            setIssued(next)
          }}
        />
      </Modal>
      <CredentialsDialog issued={issued} onClose={() => setIssued(undefined)} />
    </div>
  )
}

// --- secretary: faculty -------------------------------------------------------------------------------------------------

function AddFacultyForm({ onClose, onIssued }: { onClose: () => void; onIssued: (issued: Issued) => void }) {
  const refresh = useRefresh()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [program, setProgram] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const mutation = useMutation({
    mutationFn: async (faculty: NewFaculty) => single((await createFaculty([faculty])).record),
    onSuccess: (created) => {
      void refresh()
      onIssued(issuedFrom(created))
    },
    onError: (error) => setErrors(fieldErrors(error)),
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    const next: Record<string, string> = {}
    if (name.trim().length < 2) next.name = 'Enter the full name.'
    if (!isEmail(email.trim())) next.email = 'Enter a valid email address.'
    if (!programs.includes(program as Program)) next.program = 'Choose BSIT, BSCS, or BSIS.'
    setErrors(next)
    if (Object.keys(next).length) return
    mutation.mutate({ name: name.trim(), email: email.trim(), program: program as Program })
  }

  return (
    <form className="acct-modal-form" onSubmit={submit} noValidate>
      <ModalBody>
        <p>The new account gets a temporary username and password. The person must replace both the first time they sign in.</p>
        <TextField
          label="Full name"
          value={name}
          onChange={setName}
          autoComplete="off"
          isInvalid={Boolean(errors.name)}
          errorMessage={errors.name}
        />
        <TextField
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="off"
          isInvalid={Boolean(errors.email)}
          errorMessage={errors.email}
        />
        <Select
          label="Program"
          placeholder="Choose a program"
          selectedKey={program || null}
          onSelectionChange={(key) => setProgram(String(key ?? ''))}
          isInvalid={Boolean(errors.program)}
          errorMessage={errors.program}
        >
          {programs.map((code) => (
            <SelectOption key={code} id={code} description={programNames[code]}>
              {code}
            </SelectOption>
          ))}
        </Select>
        {mutation.error && Object.keys(errors).length === 0 && (
          <Alert tone="danger" title="The account couldn't be created">
            {errorText(mutation.error)}
          </Alert>
        )}
      </ModalBody>
      <ModalActions>
        <Button variant="secondary" onPress={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={mutation.isPending}>
          Add faculty
        </Button>
      </ModalActions>
    </form>
  )
}

/** Active or not, and whether the person still has to choose their own sign-in details. */
function Status({ account }: { account: AccountSummary }) {
  return (
    <span className="acct-state">
      <StatusChip tone={account.active ? 'ok' : 'neutral'}>{account.active ? 'Active' : 'Not active'}</StatusChip>
      {account.mustChangeCredentials && <span className="acct-muted">Waiting for first sign-in</span>}
    </span>
  )
}

/** Switches one account on or off, then reloads the lists so every row shows its new state. */
function useToggleActive() {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => setAccountActive(id, active),
    // Waiting for the reload keeps the button busy until the row shows its new state.
    onSuccess: async ({ message }) => {
      toast(message, { tone: 'success' })
      await refresh()
    },
  })
}

function ActiveButton({ account, toggle }: { account: AccountSummary; toggle: ReturnType<typeof useToggleActive> }) {
  const busy = toggle.isPending && toggle.variables?.id === account.id
  const action = account.active ? 'Deactivate' : 'Activate'
  return (
    <Button
      size="sm"
      variant="secondary"
      aria-label={`${action} ${account.name}`}
      isDisabled={toggle.isPending && !busy}
      loading={busy}
      onPress={() => toggle.mutate({ id: account.id, active: !account.active })}
    >
      {action}
    </Button>
  )
}

const roleTags = (member: FacultyAccount) => [
  ...(member.advisorYears.length ? [`Advisor, year ${member.advisorYears.join(', ')}`] : []),
  ...(member.chairProgram ? [`Chair, ${member.chairProgram}`] : []),
]

function FacultyTab() {
  const faculty = useQuery(facultyQuery)
  const refresh = useRefresh()
  const [search, setSearch] = useState('')
  const [program, setProgram] = useState('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState(false)
  const [issued, setIssued] = useState<Issued>()
  // ponytail: the server switches one account at a time, so a batch is one request per account. Ask for a batch endpoint if a
  // faculty list ever runs past a few hundred.
  const bulk = useMutation({
    mutationFn: async ({ ids, active }: { ids: string[]; active: boolean }) => {
      let done = 0
      let first: unknown
      for (const id of ids) {
        try {
          await setAccountActive(id, active)
          done++
        } catch (error) {
          first ??= error
        }
      }
      return { done, failed: ids.length - done, first, active }
    },
    onSuccess: ({ done, active }) => {
      setSelected(new Set())
      if (done) toast(`${plural(done, 'account')} ${active ? 'activated' : 'deactivated'}.`, { tone: 'success' })
    },
    onSettled: () => void refresh(),
  })

  const members = faculty.data?.faculty ?? []
  const needle = search.trim().toLowerCase()
  const shown = members.filter(
    (member) => (program === 'all' || member.program === program) && `${member.name} ${member.email}`.toLowerCase().includes(needle),
  )
  const picked = shown.filter((member) => selected.has(member.id))
  const everyone = shown.length > 0 && picked.length === shown.length
  const toggle = (id: string, on: boolean) =>
    setSelected((previous) => {
      const next = new Set(previous)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  function apply(active: boolean) {
    const ids = picked.filter((member) => member.active !== active).map((member) => member.id)
    if (!ids.length) {
      toast(active ? 'Those accounts are already active.' : 'Those accounts are already deactivated.')
      return
    }
    bulk.mutate({ ids, active })
  }

  return (
    <div className="accs-stack">
      <Gate queries={[faculty]} what="faculty">
        <div className="accs-toolbar acct-toolbar">
          <Search
            className="acct-search"
            label="Search faculty"
            placeholder="Search name or email"
            size="sm"
            value={search}
            onChange={setSearch}
          />
          <SegmentedControl aria-label="Program" selectedKey={program} onSelectionChange={(key) => setProgram(String(key))}>
            <Segment id="all">All</Segment>
            {programs.map((code) => (
              <Segment key={code} id={code}>
                {code}
              </Segment>
            ))}
          </SegmentedControl>
          <span className="acct-count" aria-live="polite">
            {shown.length} of {members.length}
          </span>
          <Button size="sm" icon="plus" onPress={() => setAdding(true)}>
            Add faculty
          </Button>
        </div>
        {bulk.data && bulk.data.failed > 0 && (
          <Alert tone="danger" title={`${plural(bulk.data.failed, 'account')} couldn't be updated`}>
            {errorText(bulk.data.first)}
          </Alert>
        )}
        {shown.length ? (
          <Panel flush>
            <div className="acct-bulk">
              <Checkbox
                isSelected={everyone}
                isIndeterminate={picked.length > 0 && !everyone}
                onChange={(on) => setSelected(on ? new Set(shown.map((member) => member.id)) : new Set())}
              >
                Select all
              </Checkbox>
              <span className="acct-muted" aria-live="polite">
                {picked.length} selected
              </span>
              <div className="acct-actions">
                <Button
                  size="sm"
                  variant="secondary"
                  isDisabled={!picked.length || bulk.isPending}
                  loading={bulk.isPending && bulk.variables?.active === true}
                  onPress={() => apply(true)}
                >
                  Activate
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  isDisabled={!picked.length || bulk.isPending}
                  loading={bulk.isPending && bulk.variables?.active === false}
                  onPress={() => apply(false)}
                >
                  Deactivate
                </Button>
              </div>
            </div>
            <div className="acct-scroll">
              <table className="accs-table acct-table acct-stack" aria-label="Faculty accounts">
                <thead>
                  <tr>
                    <th scope="col" className="acct-check">
                      <span className="acct-sr">Select</span>
                    </th>
                    <th scope="col">Name</th>
                    <th scope="col">Program</th>
                    <th scope="col">Roles</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((member) => {
                    const tags = roleTags(member)
                    return (
                      <tr key={member.id}>
                        <td className="acct-check">
                          <Checkbox
                            aria-label={`Select ${member.name}`}
                            isSelected={selected.has(member.id)}
                            onChange={(on) => toggle(member.id, on)}
                          />
                        </td>
                        <td className="acct-main">
                          <span className="acct-person">
                            <strong>{member.name}</strong>
                            <small>{member.email}</small>
                          </span>
                        </td>
                        <td data-label="Program">{member.program ?? '—'}</td>
                        <td data-label="Roles">
                          {tags.length ? (
                            <span className="acct-tags">
                              {tags.map((tag) => (
                                <span className="accs-tag" key={tag}>
                                  {tag}
                                </span>
                              ))}
                            </span>
                          ) : (
                            <span className="acct-muted">—</span>
                          )}
                        </td>
                        <td data-label="Status">
                          <Status account={member} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        ) : (
          <Panel>
            <Empty
              title={members.length ? 'No faculty match' : 'No faculty accounts yet'}
              action={
                members.length ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onPress={() => {
                      setSearch('')
                      setProgram('all')
                    }}
                  >
                    Clear filters
                  </Button>
                ) : (
                  <Button size="sm" icon="plus" onPress={() => setAdding(true)}>
                    Add faculty
                  </Button>
                )
              }
            >
              {members.length ? 'Check the spelling or choose another program.' : 'Add the first faculty member to get started.'}
            </Empty>
          </Panel>
        )}
      </Gate>
      <Modal title="Add faculty" isOpen={adding} onOpenChange={setAdding}>
        <AddFacultyForm
          onClose={() => setAdding(false)}
          onIssued={(next) => {
            setAdding(false)
            setIssued(next)
          }}
        />
      </Modal>
      <CredentialsDialog issued={issued} onClose={() => setIssued(undefined)} />
    </div>
  )
}

// --- secretary: advisors and program chairs ----------------------------------------------------------------------------

const yearLevels = [1, 2, 3, 4]

function AdvisorsTab() {
  const faculty = useQuery(facultyQuery)
  const advisors = useQuery(advisorsQuery)
  const refresh = useRefresh()
  const [year, setYear] = useState(1)
  const [draft, setDraft] = useState<Record<number, string[]>>({})
  const [filter, setFilter] = useState('')
  const save = useMutation({
    mutationFn: ({ yearLevel, facultyIds }: { yearLevel: number; facultyIds: string[] }) => setAdvisors(yearLevel, facultyIds),
    onSuccess: ({ record }) => {
      setDraft((previous) => {
        const next = { ...previous }
        delete next[record.yearLevel]
        return next
      })
      void refresh()
      toast(`Year ${record.yearLevel} advisors saved. ${plural(record.studentsUpdated, 'student')} got a new advisor.`, { tone: 'success' })
    },
  })

  const members = faculty.data?.faculty ?? []
  const current = advisors.data?.advisors.find((entry) => entry.yearLevel === year)?.faculty.map((member) => member.id) ?? []
  const chosen = draft[year] ?? current
  const changed = chosen.length !== current.length || chosen.some((id) => !current.includes(id))
  const needle = filter.trim().toLowerCase()
  const visible = members.filter((member) => member.name.toLowerCase().includes(needle))

  return (
    <div className="accs-stack">
      <p className="acct-lead">
        A student's advisor follows from their program and year level. Choose who advises each year; one person can advise several
        years. You can change this every year.
      </p>
      <SegmentedControl aria-label="Year level" selectedKey={String(year)} onSelectionChange={(key) => setYear(Number(key))}>
        {yearLevels.map((level) => (
          <Segment key={level} id={String(level)}>
            Year {level}
          </Segment>
        ))}
      </SegmentedControl>
      <Gate queries={[faculty, advisors]} what="advisors">
        <Panel title={`Year ${year} advisors`} action={<span className="acct-muted">{chosen.length} chosen</span>}>
          {members.length ? (
            <>
              <Search label="Search faculty" placeholder="Search faculty" size="sm" value={filter} onChange={setFilter} />
              <div className="acct-pick">
                <CheckboxGroup
                  label={`Faculty who advise year ${year}`}
                  value={chosen}
                  onChange={(ids) => setDraft((previous) => ({ ...previous, [year]: ids }))}
                >
                  {visible.map((member) => (
                    <Checkbox
                      key={member.id}
                      value={member.id}
                      description={[member.program, member.active ? '' : 'Not active', member.advisorYears.length ? `Advises year ${member.advisorYears.join(', ')}` : '']
                        .filter(Boolean)
                        .join(' · ')}
                    >
                      {member.name}
                    </Checkbox>
                  ))}
                </CheckboxGroup>
                {!visible.length && <p className="acct-muted">No faculty match.</p>}
              </div>
              {save.error && (
                <Alert tone="danger" title="The advisors couldn't be saved">
                  {errorText(save.error)}
                </Alert>
              )}
              <div className="acct-actions">
                <Button
                  isDisabled={!changed}
                  loading={save.isPending}
                  onPress={() => save.mutate({ yearLevel: year, facultyIds: chosen })}
                >
                  Save year {year} advisors
                </Button>
              </div>
            </>
          ) : (
            <Empty title="No faculty yet">Add faculty first, then choose who advises each year.</Empty>
          )}
        </Panel>
      </Gate>
    </div>
  )
}

function ChairsTab() {
  const faculty = useQuery(facultyQuery)
  const chairs = useQuery(chairsQuery)
  const refresh = useRefresh()
  const toggle = useToggleActive()
  const [program, setProgram] = useState<Program>('BSIT')
  const [pick, setPick] = useState<Record<string, string>>({})
  const save = useMutation({
    mutationFn: ({ code, facultyId }: { code: Program; facultyId: string }) => setChair(code, facultyId),
    onSuccess: ({ record, message }) => {
      setPick((previous) => {
        const next = { ...previous }
        delete next[record.program]
        return next
      })
      void refresh()
      toast(message, { tone: 'success' })
    },
  })

  const members = (faculty.data?.faculty ?? []).filter((member) => member.program === program)
  const holders = (chairs.data?.accounts ?? []).filter((account) => account.program === program)
  const chosen = pick[program] ?? holders[0]?.id ?? ''
  const changed = chosen !== '' && !(holders.length === 1 && holders[0]!.id === chosen)

  return (
    <div className="accs-stack">
      <p className="acct-lead">Each program has one chair, chosen from that program's faculty. Choosing a new chair replaces the current one.</p>
      <SegmentedControl aria-label="Program" selectedKey={program} onSelectionChange={(key) => setProgram(String(key) as Program)}>
        {programs.map((code) => (
          <Segment key={code} id={code}>
            {code}
          </Segment>
        ))}
      </SegmentedControl>
      <Gate queries={[faculty, chairs]} what="program chairs">
        <Panel title={`${program} program chair`}>
          <p className="acct-muted">
            {programNames[program]}. {holders.length ? 'Current chair:' : 'There is no chair yet.'}
          </p>
          {holders.length > 0 && (
            <ul className="acct-holders">
              {holders.map((holder) => (
                <li key={holder.id}>
                  <span className="acct-person">
                    <strong>{holder.name}</strong>
                    <small>{holder.email}</small>
                  </span>
                  <Status account={holder} />
                  <ActiveButton account={holder} toggle={toggle} />
                </li>
              ))}
            </ul>
          )}
          {toggle.error && (
            <Alert tone="danger" title="The account couldn't be updated">
              {errorText(toggle.error)}
            </Alert>
          )}
          {members.length ? (
            <>
              <RadioGroup
                label={`${program} faculty`}
                value={chosen}
                onChange={(id) => setPick((previous) => ({ ...previous, [program]: id }))}
              >
                {members.map((member) => (
                  <Radio key={member.id} value={member.id} description={member.active ? member.email : `${member.email} · Not active`}>
                    {member.name}
                  </Radio>
                ))}
              </RadioGroup>
              {save.error && (
                <Alert tone="danger" title="The program chair couldn't be saved">
                  {errorText(save.error)}
                </Alert>
              )}
              <div className="acct-actions">
                <Button isDisabled={!changed} loading={save.isPending} onPress={() => save.mutate({ code: program, facultyId: chosen })}>
                  Set as {program} chair
                </Button>
              </div>
            </>
          ) : (
            <Empty title={`No ${program} faculty yet`}>Add a faculty member in this program first, then choose the chair.</Empty>
          )}
        </Panel>
      </Gate>
    </div>
  )
}

// --- secretary: students -----------------------------------------------------------------------------------------------

type Outcome = { ok: true; credentials: Credentials; signInUrl: string } | { ok: false; message: string }

const xlsx = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

const readFailure = (error: unknown) =>
  (error as { code?: unknown } | null)?.code === 'XLS_FILE_NOT_SUPPORTED'
    ? 'This is an older .xls file. Open it in Excel, save it as .xlsx, and upload that.'
    : "This file couldn't be read. Upload an Excel .xlsx file."

const rowMessage = (result: Extract<RowResult, { status: 'error' }>) =>
  result.fields?.length ? result.fields.map((field) => field.message).join(' ') : result.error

/** What the server said about each student of a batch, keyed by the student's row in the sheet. */
function outcomesOf(batch: ParsedStudent[], results: RowResult[]) {
  return results.flatMap((result): [number, Outcome][] => {
    const source = batch[result.index]
    if (!source) return []
    return [
      [
        source.row,
        result.status === 'created'
          ? { ok: true, credentials: result.credentials, signInUrl: result.invite.signInUrl }
          : { ok: false, message: rowMessage(result) },
      ],
    ]
  })
}

function AddStudent({ onIssued }: { onIssued: (issued: Issued) => void }) {
  const refresh = useRefresh()
  const [draft, setDraft] = useState<StudentDraft>(emptyStudent)
  const [errors, setErrors] = useState<StudentProblems>({})
  const mutation = useMutation({
    mutationFn: async (student: NewStudent) => single((await createStudents([student])).record),
    onSuccess: (created) => {
      void refresh()
      setDraft(emptyStudent)
      setErrors({})
      onIssued(issuedFrom(created))
    },
    onError: (error) => setErrors(fieldErrors(error)),
  })
  const set = (field: StudentField) => (value: string) => setDraft((previous) => ({ ...previous, [field]: value }))

  function submit(event: FormEvent) {
    event.preventDefault()
    const problems = studentProblems(draft)
    setErrors(problems)
    if (Object.keys(problems).length) return
    mutation.mutate(toStudent(draft))
  }

  return (
    <Panel title="Add one student">
      <form className="acct-form" onSubmit={submit} noValidate>
        <div className="acct-form__grid">
          <TextField
            label="Full name"
            value={draft.name}
            onChange={set('name')}
            autoComplete="off"
            isInvalid={Boolean(errors.name)}
            errorMessage={errors.name}
          />
          <TextField
            label="Email or Gmail"
            type="email"
            value={draft.email}
            onChange={set('email')}
            autoComplete="off"
            isInvalid={Boolean(errors.email)}
            errorMessage={errors.email}
          />
          <TextField
            label="Student ID"
            value={draft.studentId}
            onChange={set('studentId')}
            autoComplete="off"
            description="Like 24-1234."
            isInvalid={Boolean(errors.studentId)}
            errorMessage={errors.studentId}
          />
          <Select
            label="Program"
            placeholder="Choose a program"
            selectedKey={draft.program || null}
            onSelectionChange={(key) => set('program')(String(key ?? ''))}
            isInvalid={Boolean(errors.program)}
            errorMessage={errors.program}
          >
            {programs.map((code) => (
              <SelectOption key={code} id={code} description={programNames[code]}>
                {code}
              </SelectOption>
            ))}
          </Select>
          <Select
            label="Year level"
            placeholder="Choose a year"
            selectedKey={draft.year || null}
            onSelectionChange={(key) => set('year')(String(key ?? ''))}
            isInvalid={Boolean(errors.year)}
            errorMessage={errors.year}
          >
            {yearLevels.map((level) => (
              <SelectOption key={level} id={String(level)}>
                Year {level}
              </SelectOption>
            ))}
          </Select>
          <TextField
            label="Section"
            value={draft.section}
            onChange={set('section')}
            autoComplete="off"
            description="The section letter, like A."
            isInvalid={Boolean(errors.section)}
            errorMessage={errors.section}
          />
        </div>
        {mutation.error && Object.keys(errors).length === 0 && (
          <Alert tone="danger" title="The student couldn't be added">
            {errorText(mutation.error)}
          </Alert>
        )}
        <div className="acct-actions">
          <Button type="submit" loading={mutation.isPending}>
            Add student
          </Button>
        </div>
      </form>
    </Panel>
  )
}

function ResultCell({ problems, outcome, running }: { problems: StudentProblems; outcome?: Outcome; running: boolean }) {
  const text = Object.values(problems).join(' ')
  if (text) return <span className="acct-problem">{text}</span>
  if (!outcome) return <span className="acct-muted">{running ? 'Waiting' : 'Ready'}</span>
  return outcome.ok ? <StatusChip tone="ok">Created</StatusChip> : <span className="acct-problem">{outcome.message}</span>
}

/** Every student account, found by name, ID or email, each with its own switch. The server sends the first 200 by name. */
function StudentList() {
  const [search, setSearch] = useState('')
  const q = useDebounced(search.trim().slice(0, 200))
  const students = useQuery({
    queryKey: ['accounts', 'students', q],
    queryFn: () => listAccounts({ role: 'student', q }),
    // The old list stays on screen while a new search loads.
    placeholderData: keepPreviousData,
  })
  const toggle = useToggleActive()
  const list = students.data?.accounts ?? []
  const total = students.data?.total ?? 0

  return (
    <Panel
      flush
      title="Student accounts"
      action={
        students.data && (
          <span className="acct-muted">{q ? `${total} ${total === 1 ? 'match' : 'matches'}` : plural(total, 'student')}</span>
        )
      }
    >
      <div className="acct-bulk">
        <Search
          className="acct-search"
          label="Search students"
          placeholder="Search name, student ID, or email"
          size="sm"
          value={search}
          onChange={setSearch}
        />
      </div>
      <Gate queries={[students]} what="students">
        {toggle.error && (
          <div className="acct-pad">
            <Alert tone="danger" title="The account couldn't be updated">
              {errorText(toggle.error)}
            </Alert>
          </div>
        )}
        {list.length ? (
          <>
            <div className="acct-scroll" aria-busy={students.isPlaceholderData}>
              <table className="accs-table acct-table acct-stack" aria-label="Student accounts">
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col">Student ID</th>
                    <th scope="col">Program</th>
                    <th scope="col">Year</th>
                    <th scope="col">Section</th>
                    <th scope="col">Status</th>
                    <th scope="col">
                      <span className="acct-sr">Action</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((student) => (
                    <tr key={student.id}>
                      <td className="acct-main">
                        <span className="acct-person">
                          <strong>{student.name}</strong>
                          <small>{student.email}</small>
                        </span>
                      </td>
                      <td data-label="Student ID">
                        <span className="accs-mono">{student.studentId ?? '—'}</span>
                      </td>
                      <td data-label="Program">{student.program ?? '—'}</td>
                      <td data-label="Year">{student.year ?? '—'}</td>
                      <td data-label="Section">{student.section ?? '—'}</td>
                      <td data-label="Status">
                        <Status account={student} />
                      </td>
                      <td className="acct-act">
                        <ActiveButton account={student} toggle={toggle} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {total > list.length && (
              <p className="acct-foot">
                Showing the first {list.length} of {total} students, in name order. Search to find the others.
              </p>
            )}
          </>
        ) : (
          <Empty
            title={q ? 'No students match' : 'No student accounts yet'}
            action={
              q ? (
                <Button variant="secondary" size="sm" onPress={() => setSearch('')}>
                  Clear search
                </Button>
              ) : undefined
            }
          >
            {q ? 'Check the spelling, or search by student ID or email.' : 'Import a class list or add one student above.'}
          </Empty>
        )}
      </Gate>
    </Panel>
  )
}

function StudentsTab() {
  const refresh = useRefresh()
  const types = useQuery(typesQuery)
  const [file, setFile] = useState<File>()
  const [reading, setReading] = useState(false)
  const [readError, setReadError] = useState<string>()
  const [sheet, setSheet] = useState<ReturnType<typeof parseStudentRows>>()
  const [outcome, setOutcome] = useState<Record<number, Outcome>>({})
  const [running, setRunning] = useState(false)
  const [stopped, setStopped] = useState<string>()
  const [saved, setSaved] = useState(false)
  const [uploadKey, setUploadKey] = useState(0)
  const [issuedOne, setIssuedOne] = useState<Issued>()
  const latest = useRef<File | undefined>(undefined)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const students = sheet?.students ?? []
  const ready = students.filter((student) => Object.keys(student.problems).length === 0)
  const skipped = students.length - ready.length
  const waiting = ready.filter((student) => !outcome[student.row])
  const issued = ready.flatMap((student): IssuedStudent[] => {
    const result = outcome[student.row]
    return result?.ok ? [{ student: toStudent(student.draft), credentials: result.credentials, signInUrl: result.signInUrl }] : []
  })
  const started = running || Boolean(stopped) || ready.length > waiting.length
  const finished = started && !running && !stopped && waiting.length === 0
  const unsaved = running || (issued.length > 0 && !saved)
  const blocker = useBlocker({
    shouldBlockFn: () => unsaved,
    enableBeforeUnload: () => unsaved,
    withResolver: true,
  })

  async function read(next?: File) {
    latest.current = next
    setFile(next)
    setSheet(undefined)
    setReadError(undefined)
    setOutcome({})
    setStopped(undefined)
    setSaved(false)
    if (!next) return
    setReading(true)
    try {
      // The spreadsheet reader is large, so it loads only when someone picks a file.
      const { readSheet } = await import('read-excel-file/browser')
      const rows: unknown[][] = await readSheet(next)
      if (latest.current === next) setSheet(parseStudentRows(rows))
    } catch (error) {
      if (latest.current === next) setReadError(readFailure(error))
    } finally {
      if (latest.current === next) setReading(false)
    }
  }

  // ponytail: batches go one after another, because each account costs a password hash on the server. Every row of the sheet is
  // also rendered; virtualize the table if class lists grow past a few thousand rows.
  async function send(rows: ParsedStudent[]) {
    setRunning(true)
    setStopped(undefined)
    try {
      for (const batch of chunk(rows)) {
        if (!alive.current) return
        const { record } = await createStudents(batch.map((student) => toStudent(student.draft)))
        if (!alive.current) return
        setOutcome((previous) => ({ ...previous, ...Object.fromEntries(outcomesOf(batch, record.results)) }))
      }
    } catch (error) {
      if (alive.current) setStopped(errorText(error))
    } finally {
      if (alive.current) setRunning(false)
      void refresh()
    }
  }

  function download() {
    saveFile(`student-sign-in-details-${new Date().toISOString().slice(0, 10)}.csv`, credentialsCsv(issued))
    setSaved(true)
  }

  function startOver() {
    setUploadKey((key) => key + 1)
    void read(undefined)
  }

  const accountCount = types.data?.types.find((row) => row.type === 'student')

  return (
    <div className="accs-stack">
      <Panel title="Import a class list">
        <div className="acct-form">
          <p className="acct-muted">
            Upload the registrar's Excel list. Each student gets a temporary username and password. Nothing is created until you
            confirm.
            {accountCount && ` There are ${accountCount.active} active and ${accountCount.inactive} inactive student accounts so far.`}
          </p>
          {!started && (
            <FileUpload
              key={uploadKey}
              label="Class list"
              description="An Excel .xlsx file with a heading row: name, email or Gmail, student ID, program, year, and section."
              acceptedFileTypes={[xlsx, '.xlsx']}
              onChange={(files) => void read(files[0])}
              status={file && sheet ? { [file.name]: { done: true } } : undefined}
            />
          )}
          {reading && <Progress isIndeterminate label="Reading the file" />}
          {readError && (
            <Alert tone="danger" title="This file can't be used">
              {readError}
            </Alert>
          )}
          {sheet && sheet.missing.length > 0 && (
            <Alert tone="danger" title="Some columns are missing">
              We couldn't find a heading for {sheet.missing.map((field) => columnLabels[field]).join(', ')}. The first rows of the
              sheet need a heading for each of: name, email or Gmail, student ID, program, year, and section.
            </Alert>
          )}
          {sheet && !sheet.missing.length && !students.length && (
            <Alert tone="warning" title="No students found">
              The headings were found, but there are no rows under them.
            </Alert>
          )}
          {students.length > 0 && (
            <>
              <p role="status" className="acct-summary">
                {plural(students.length, 'row')} in {file?.name ?? 'the file'}: {ready.length} ready
                {skipped ? `, ${skipped} with problems that will be skipped` : ''}.
              </p>
              {!started && skipped > 0 && ready.length > 0 && (
                <Alert tone="warning" title={`${plural(skipped, 'row')} will be skipped`}>
                  Fix them in the file and upload it again, or continue without them.
                </Alert>
              )}
              {!started && ready.length === 0 && (
                <Alert tone="danger" title="No row can be created">
                  Fix the problems listed below in the file and upload it again.
                </Alert>
              )}
              <PagedList items={students} noun="rows">
                {(students) => (
                <div className="acct-scroll acct-scroll--tall">
                  <table className="accs-table acct-table acct-stack" aria-label="Class list">
                    <thead>
                      <tr>
                        <th scope="col">Row</th>
                        <th scope="col">Name</th>
                        <th scope="col">Email</th>
                        <th scope="col">Student ID</th>
                        <th scope="col">Program</th>
                        <th scope="col">Year</th>
                        <th scope="col">Section</th>
                        <th scope="col">Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((student) => (
                        <tr key={student.row}>
                          <td data-label="Row" className="accs-num">
                            {student.row}
                          </td>
                          {(['name', 'email', 'studentId', 'program', 'year', 'section'] as const).map((field) => (
                            <td key={field} data-label={columnLabels[field]} data-bad={student.problems[field] ? true : undefined}>
                              {student.draft[field] || '—'}
                            </td>
                          ))}
                          <td data-label="Result">
                            <ResultCell problems={student.problems} outcome={outcome[student.row]} running={running} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                )}
              </PagedList>
              {!started && ready.length > 0 && (
                <div className="acct-actions">
                  <Button onPress={() => void send(ready)}>Create {plural(ready.length, 'account')}</Button>
                </div>
              )}
              {running && (
                <Progress
                  label="Creating accounts"
                  value={ready.length - waiting.length}
                  maxValue={ready.length}
                  hint={`${ready.length - waiting.length} of ${ready.length} done`}
                />
              )}
              {stopped && (
                <Alert
                  tone="danger"
                  title="Stopped before every account was created"
                  actions={
                    <Button size="sm" onPress={() => void send(waiting)}>
                      Continue
                    </Button>
                  }
                >
                  {stopped} Accounts in the batch that was running may already exist. If so, their rows will say the email is already
                  in use.
                </Alert>
              )}
              {finished && (
                <>
                  <Alert
                    tone={issued.length ? 'warning' : 'neutral'}
                    title={`${plural(issued.length, 'account')} created${ready.length > issued.length ? `, ${ready.length - issued.length} not created` : ''}`}
                  >
                    {issued.length
                      ? 'The sign-in details are shown only once. Download them now. The file holds every temporary password, so keep it private and delete it once the students have signed in.'
                      : 'Nothing was created. The reasons are listed in the table.'}
                  </Alert>
                  <div className="acct-actions">
                    {issued.length > 0 && (
                      <Button icon="download" onPress={download}>
                        Download sign-in details (CSV)
                      </Button>
                    )}
                    <Button variant="secondary" isDisabled={issued.length > 0 && !saved} onPress={startOver}>
                      Import another file
                    </Button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </Panel>
      <AddStudent onIssued={setIssuedOne} />
      <StudentList />
      <CredentialsDialog issued={issuedOne} onClose={() => setIssuedOne(undefined)} />
      <Modal
        title="Leave without saving the sign-in details?"
        role="alertdialog"
        isOpen={blocker.status === 'blocked'}
        onOpenChange={(open) => {
          if (!open && blocker.status === 'blocked') blocker.reset()
        }}
      >
        <ModalBody>
          {running
            ? 'Accounts are still being created. Leaving now stops the import.'
            : "The temporary passwords for the accounts just created are shown only once. If you leave now, you can't get them back."}
        </ModalBody>
        <ModalActions>
          <Button
            variant="secondary"
            onPress={() => {
              if (blocker.status === 'blocked') blocker.reset()
            }}
          >
            Stay here
          </Button>
          <Button
            variant="destructive"
            onPress={() => {
              if (blocker.status === 'blocked') blocker.proceed()
            }}
          >
            Leave anyway
          </Button>
        </ModalActions>
      </Modal>
    </div>
  )
}

// --- secretary: account status -----------------------------------------------------------------------------------------

/** Where the setup stands, from the counts the server already keeps for each account type. */
function StatusTab() {
  const types = useQuery(typesQuery)
  const rows = types.data?.types ?? []
  return (
    <Gate queries={[types]} what="account status">
      <Panel flush title="Setup progress">
        <PagedList items={rows} noun="accounts">
          {(rows) => (
          <div className="acct-scroll">
            <table className="accs-table acct-table acct-stack" aria-label="Setup progress">
              <thead>
                <tr>
                  <th scope="col">Account type</th>
                  <th scope="col" className="accs-num">
                    Active
                  </th>
                  <th scope="col" className="accs-num">
                    Not active
                  </th>
                  <th scope="col">Setup</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.type}>
                    <td className="acct-main">
                      <strong>{row.label}</strong>
                    </td>
                    <td data-label="Active" className="accs-num">
                      {row.active}
                    </td>
                    <td data-label="Not active" className="accs-num">
                      {row.inactive}
                    </td>
                    <td data-label="Setup">
                      <StatusChip tone={row.active > 0 ? 'ok' : 'neutral'}>{row.active > 0 ? 'Done' : 'To do'}</StatusChip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </PagedList>
        <p className="acct-foot">Switch one account on or off from its row in the Faculty or Students tab.</p>
      </Panel>
    </Gate>
  )
}

// --- screens -----------------------------------------------------------------------------------------------------------

const secretaryTabs = ['faculty', 'advisors', 'chairs', 'students', 'status']

function SecretaryAccounts() {
  // The Home tiles open a tab with ?tab=; anything else starts at the first step.
  const asked = String((useSearch({ strict: false }) as { tab?: unknown }).tab ?? '')
  const [tab, setTab] = useState(secretaryTabs.includes(asked) ? asked : 'faculty')
  return (
    <div className="accs-stack accs-stagger">
      <PageHeader
        title="Accounts"
        description="Set up the college in order: faculty, advisors, program chairs, then students. Check where it all stands under Account status."
      />
      <Tabs selectedKey={tab} onSelectionChange={(key) => setTab(String(key))}>
        <TabList aria-label="Account setup steps">
          <Tab id="faculty">1. Faculty</Tab>
          <Tab id="advisors">2. Advisors</Tab>
          <Tab id="chairs">3. Program chairs</Tab>
          <Tab id="students">4. Students / import</Tab>
          <Tab id="status">5. Account status</Tab>
        </TabList>
        <TabPanel id="faculty">
          <p className="acct-lead">Create an account for each faculty member. Their temporary sign-in details are shown once.</p>
          <FacultyTab />
        </TabPanel>
        <TabPanel id="advisors">
          <p className="acct-lead">Choose the faculty who advise each year level. Faculty accounts must exist first.</p>
          <AdvisorsTab />
        </TabPanel>
        <TabPanel id="chairs">
          <p className="acct-lead">Choose the program chair for each program. A chair is a faculty account.</p>
          <ChairsTab />
        </TabPanel>
        {/* Kept mounted so a finished import and its sign-in details survive a switch of tab. */}
        <TabPanel id="students" shouldForceMount className="acct-keep">
          <p className="acct-lead">Import a class list from Excel, or add one student at a time.</p>
          <StudentsTab />
        </TabPanel>
        <TabPanel id="status">
          <p className="acct-lead">How many accounts of each type are on, and which setup steps are still to do.</p>
          <StatusTab />
        </TabPanel>
      </Tabs>
    </div>
  )
}

function AccountsByRole() {
  const session = useQuery(sessionQuery())
  return session.data?.permissions.includes('account.provision') ? <SecretaryAccounts /> : <DeanAccounts />
}

export function AccountsScreen() {
  return (
    <RequirePermission pageId="accounts">
      <AccountsByRole />
    </RequirePermission>
  )
}
