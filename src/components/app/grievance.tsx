import {
  Alert, Badge, Breadcrumbs, Button, CaseTimeline, Cell, Checkbox, Column, DatePicker,
  Drawer, EmptyState, FileUpload, Grid, Link, MenuButton, MenuItem, Modal, ModalActions,
  ModalBody, Pagination, PrivacyNotice, Radio, RadioGroup, ReportRecord, ReportsTable,
  Row, SectionHeader, Segment, SegmentedControl, Select, SelectOption, Severity,
  Stepper, Tab, TabList, TabPanel, Table, TableBody, TableHeader, TableRow, Tabs,
  TextArea, TextField, ViewState, toast,
  type BadgeForm, type BadgeTone, type CaseEvent, type SortDescriptor,
} from '@meetingat10/design-system/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import { performPageAction, type PageAction, type PageEnvelope } from '@/lib/api'
import { sessionQuery } from '@/lib/queries'
import { FilterBar } from '@/components/ds-next'
import { RestrictedView } from '@/components/app/guards'
import './grievance.css'

type Item = Record<string, unknown>
type Identity = 'named' | 'anonymous'
type SeverityLevel = 'low' | 'medium' | 'high'
type Report = Item & { id: string; category: string; severity: SeverityLevel; status: string; stage: string; office: string }

const object = (value: unknown): Item => value && typeof value === 'object' && !Array.isArray(value) ? value as Item : {}
const items = (value: unknown): Item[] => Array.isArray(value) ? value.map(object) : []
const words = (value: unknown, fallback = '') => typeof value === 'string' || typeof value === 'number' ? String(value) : fallback
const date = (value: unknown) => {
  const raw = words(value)
  const parsed = new Date(raw)
  return raw && !Number.isNaN(parsed.getTime()) ? parsed.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }) : '—'
}
const isClosed = (report: Item) => ['Resolved', 'Closed'].includes(words(report.status))
const reportReference = (report: Item) => words(report.caseFileId, words(report.id))
const reportForm = (report: Item): BadgeForm => isClosed(report) ? report.status === 'Closed' ? 'closed' : 'solid' : 'pending'
const reportTone = (report: Item): BadgeTone => report.status === 'Resolved' ? 'success' : report.caseFileId ? 'info' : 'neutral'
const severity = (report: Item): SeverityLevel => ['low', 'medium', 'high'].includes(words(report.severity)) ? report.severity as SeverityLevel : 'medium'
const waitingDays = (report: Item) => Math.max(0, Math.floor((Date.now() - new Date(words(report.updatedAt, words(report.createdAt))).getTime()) / 86400000)) || 0

function useAction(pageId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (action: PageAction) => performPageAction(pageId, action),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['page'] }),
        queryClient.invalidateQueries({ queryKey: ['session'] }),
      ])
      toast(result.message, { tone: 'success' })
    },
  })
}

function ActionError({ error }: { error: unknown }) {
  return error ? <Alert tone="danger" title="The change couldn't be saved">{error instanceof Error ? error.message : 'Try again. Your entered text is kept.'}</Alert> : null
}

function Heading({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return <SectionHeader level={1} split title={title} description={description} actions={<Row gap={8}><Badge outline marker={false}>Sample data</Badge>{actions}</Row>} />
}

function Facts({ values }: { values: Array<[string, React.ReactNode]> }) {
  return <dl className="ds-record__facts">{values.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
}

function ReportStatus({ report }: { report: Item }) {
  return <Row gap={8}><Badge form={reportForm(report)} tone={reportTone(report)}>{words(report.status, 'Submitted')}</Badge><Severity level={severity(report)} /></Row>
}

function Timeline({ report, handler = false }: { report: Item; handler?: boolean }) {
  const history = items(report.history)
  if (!history.length) return <ViewState kind="empty" title="No milestones yet" description="Updates recorded by the responsible office will appear here." />
  const events: CaseEvent[] = history.map((entry) => ({
    title: <>{words(entry.action, 'Update recorded')} {handler && entry.public === true && <Badge outline marker={false}>Shown to reporter</Badge>}</>,
    actor: handler ? entry.actorRole === 'student' ? 'Verified reporter' : words(entry.actorRole, words(entry.office, 'Handling office')) : words(entry.office),
    body: handler ? [words(entry.reason), words(entry.update)].filter(Boolean).join(' · ') : words(entry.update),
    date: date(entry.at),
    dateTime: words(entry.at),
    state: entry.state === 'current' ? 'current' : 'done',
  }))
  return <CaseTimeline events={events} label={handler ? 'Case history' : 'Report progress'} />
}

export function IdentityChoice({ value, onChange, allowAnonymous = true }: { value: Identity; onChange: (value: Identity) => void; allowAnonymous?: boolean }) {
  return (
    <div className="app-page">
      <RadioGroup label="How should handlers see you?" value={value} onChange={(next) => onChange(next as Identity)} isRequired>
        <Radio value="named" card description="The responsible office sees your verified name.">Use my name</Radio>
        {allowAnonymous && <Radio value="anonymous" card description="The responsible office sees an alias until you share your name with that office.">Stay anonymous for now</Radio>}
      </RadioGroup>
      {!allowAnonymous && <Alert tone="neutral" title="Anonymous reporting is paused">You can still submit a report under your name. <Link href="/standing">View account standing</Link>.</Alert>}
      <PrivacyNotice title="Identity and access are separate">
        Anonymous means the people handling your report see an alias. The report is still tied to your verified account. You can share your name later.
      </PrivacyNotice>
    </div>
  )
}

export function DiscloseIdentityDialog({ report, isOpen, onOpenChange }: { report: Report; isOpen: boolean; onOpenChange: (open: boolean) => void }) {
  const action = useAction('P20')
  // TBD(D-08): disclosure reversal and mandatory disclosure policy are not defined.
  return (
    <Modal role="alertdialog" title={'Share your name with ' + report.office + '?'} isOpen={isOpen} onOpenChange={onOpenChange}>
      <ModalBody>
        <p>Your verified name will be shared with the office currently handling this report. This action is recorded for this office.</p>
        <p>Other offices do not receive this disclosure automatically.</p>
        <ActionError error={action.error} />
      </ModalBody>
      <ModalActions>
        <Button variant="secondary" onPress={() => onOpenChange(false)} isDisabled={action.isPending}>Cancel</Button>
        <Button loading={action.isPending} onPress={() => action.mutate({ action: 'discloseIdentity', recordId: report.id, payload: { office: report.stage } }, { onSuccess: () => onOpenChange(false) })}>Share my name</Button>
      </ModalActions>
    </Modal>
  )
}

function DraftHelp({ narrative, isOpen, onOpenChange, onUse }: { narrative: string; isOpen: boolean; onOpenChange: (open: boolean) => void; onUse: (text: string) => void }) {
  const [candidate, setCandidate] = useState(narrative)
  const action = useAction('P19')
  const reply = words(object(action.data?.record).reply)
  return (
    <Drawer title="Help with your draft" isOpen={isOpen} onOpenChange={onOpenChange}>
      <div className="app-page">
        <Alert tone="neutral" title="The assistant helps you write">It doesn't decide what happened or what happens next. This prototype provides approved writing guidance.</Alert>
        <Button variant="secondary" loading={action.isPending} onPress={() => action.mutate({ action: 'assistantAsk', payload: { question: 'Help me write and organize my report draft.' } })}>Show writing guidance</Button>
        <ActionError error={action.error} />
        {reply && <p className="ds-prose">{reply}</p>}
        <TextArea label="Text to review" value={candidate} onChange={setCandidate} maxLength={4000} showCount description="Review and edit your wording before using it." />
        <Button onPress={() => { onUse(candidate); onOpenChange(false) }}>Use this text</Button>
      </div>
    </Drawer>
  )
}

type Draft = { narrative: string; category: string; severity: SeverityLevel | ''; identity: Identity; location: string; occurredOn: string; conflictedAdviser: boolean }
const blankDraft: Draft = { narrative: '', category: '', severity: '', identity: 'named', location: '', occurredOn: '', conflictedAdviser: false }

export function ReportWizard({ page }: { page: PageEnvelope }) {
  const session = useQuery(sessionQuery())
  const storageKey = 'accs-report-draft-' + (session.data?.user.id ?? 'signed-in')
  const serverDraft = object(page.data.draft)
  const [draft, setDraft] = useState<Draft>(() => {
    let local: Item = {}
    try { local = object(JSON.parse(localStorage.getItem(storageKey) ?? '{}')) } catch { /* Keep the server draft when local storage is unavailable. */ }
    const saved = { ...serverDraft, ...local }
    return {
      narrative: words(saved.narrative), category: words(saved.category),
      severity: ['low', 'medium', 'high'].includes(words(saved.severity)) ? saved.severity as SeverityLevel : '',
      identity: page.data.anonymityAllowed !== false && saved.identity === 'anonymous' ? 'anonymous' : 'named',
      location: words(saved.location), occurredOn: words(saved.occurredOn), conflictedAdviser: saved.conflictedAdviser === true,
    }
  })
  const [step, setStep] = useState(0)
  const [error, setError] = useState('')
  const [discardOpen, setDiscardOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [submitted, setSubmitted] = useState<Item>()
  const action = useAction('P19')
  const source = object(page.data.sourcePost)
  const categories = Array.isArray(page.data.categories) ? page.data.categories.map(String) : []
  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }))

  useEffect(() => {
    if (submitted) return
    try { localStorage.setItem(storageKey, JSON.stringify(draft)) } catch { /* The form state still retains the draft. */ }
  }, [draft, storageKey, submitted])

  const validate = (current: number) => {
    const message = current === 0 && !draft.narrative.trim() ? 'Describe what happened before continuing.'
      : current === 1 && (!draft.category || !draft.severity) ? 'Choose a category and severity before continuing.' : ''
    setError(message)
    return !message
  }
  const saveDraft = () => action.mutate({ action: 'saveDraft', payload: { narrative: draft.narrative, ...(draft.category ? { category: draft.category } : {}), ...(draft.severity ? { severity: draft.severity } : {}), identity: draft.identity } })
  const submit = () => {
    if (!draft.narrative.trim() || !draft.category || !draft.severity) {
      setError('Complete the description, category, and severity before submitting.')
      return
    }
    action.mutate({
      action: 'createReport',
      payload: {
        narrative: draft.narrative, category: draft.category, severity: draft.severity, identity: draft.identity,
        conflictedAdviser: draft.conflictedAdviser,
        ...(draft.location ? { location: draft.location } : {}),
        ...(draft.occurredOn ? { occurredOn: draft.occurredOn } : {}),
        ...(source.id ? { sourcePostId: words(source.id) } : {}),
      },
    }, { onSuccess: (result) => { setSubmitted(object(result.record)); try { localStorage.removeItem(storageKey) } catch { /* No stored draft to remove. */ } } })
  }

  if (submitted) {
    return (
      <div className="app-page">
        <Heading title="Report submitted" />
        <Alert tone="success" title="Report submitted">
          Your reference is <span className="ds-table__ref">{words(submitted.id)}</span>. {words(submitted.status, 'The responsible office has received it.')}
        </Alert>
        <Button href={'/reports/' + encodeURIComponent(words(submitted.id))}>View report</Button>
      </div>
    )
  }
  return (
    <div className="app-page grievance-reading">
      <Breadcrumbs items={[{ label: 'My reports', href: '/reports' }, { label: 'New report' }]} />
      <Heading title="New report" actions={<MenuButton label="Draft" onAction={(key) => key === 'save' ? saveDraft() : setDiscardOpen(true)}><MenuItem id="save">Save draft</MenuItem><MenuItem id="discard" danger>Discard draft</MenuItem></MenuButton>} />
      <Stepper label="Report steps" steps={['Describe', 'Classify', 'Identity', 'Review']} current={step} />
      {words(source.id) && <Alert tone="info" title={'Linked to your discussion "' + words(source.title) + '"'}>The link is kept only if you choose to submit this report.</Alert>}
      {error && <Alert tone="danger" title="Check this step">{error}</Alert>}
      {action.error && action.variables?.action === 'saveDraft' ? <Alert tone="danger" title="Couldn't save your draft">Your text is kept on this device. Try saving again.</Alert> : <ActionError error={action.error} />}
      {step === 0 && (
        <div className="app-page">
          <TextArea label="What happened" isRequired showCount maxLength={4000} value={draft.narrative} onChange={(value) => update('narrative', value)} description="Say what happened, when, and where. Leave out names you don't need to share." isInvalid={Boolean(error && !draft.narrative.trim())} errorMessage={error && !draft.narrative.trim() ? error : undefined} />
          <Grid columns={2}>
            <DatePicker label="When" onChange={(value) => update('occurredOn', value?.toString() ?? '')} description={draft.occurredOn ? 'Saved date: ' + draft.occurredOn : 'Optional'} />
            <TextField label="Where" value={draft.location} onChange={(value) => update('location', value)} maxLength={200} description="Optional" />
          </Grid>
          {/* TBD(D-08): attachment access and retention policy is not approved. */}
          <FileUpload label="Attachments" isDisabled description="Attachments are not enabled while access and retention rules are being defined." />
          <Button variant="secondary" onPress={() => setHelpOpen(true)}>Help me write this</Button>
          <Alert tone="neutral" title="You review every submission">The assistant helps you write. It doesn't decide what happened or what happens next.</Alert>
        </div>
      )}
      {step === 1 && (
        <div className="app-page">
          <Alert tone="neutral" title="Sample categories">These categories are provisional while the reporting policy is being defined.</Alert>
          <Select label="Category" selectedKey={draft.category || null} onSelectionChange={(key) => update('category', String(key ?? ''))} isRequired>
            {categories.map((category) => <SelectOption id={category} key={category}>{category}</SelectOption>)}
          </Select>
          <RadioGroup label="How serious is it?" value={draft.severity} onChange={(value) => update('severity', value as SeverityLevel)} isRequired>
            <Radio value="low" card description="A concern with limited immediate impact."><Severity level="low" /></Radio>
            <Radio value="medium" card description="A concern affecting ongoing activities or support."><Severity level="medium" /></Radio>
            <Radio value="high" card description="A concern that needs prompt human review."><Severity level="high" /></Radio>
          </RadioGroup>
          <Checkbox isSelected={draft.conflictedAdviser} onChange={(value) => update('conflictedAdviser', value)} description="This routes the report for independent review. It is not a finding.">The assigned adviser may be involved</Checkbox>
        </div>
      )}
      {step === 2 && <IdentityChoice value={draft.identity} onChange={(value) => update('identity', value)} allowAnonymous={page.data.anonymityAllowed !== false} />}
      {step === 3 && (
        <div className="app-page">
          <Facts values={[
            ['Category', draft.category], ['Severity', draft.severity], ['Identity', draft.identity === 'anonymous' ? 'Alias to handlers' : 'Use my name'],
            ['When', draft.occurredOn || 'Not specified'], ['Where', draft.location || 'Not specified'],
            ['Linked discussion', words(source.title, 'None')],
          ]} />
          <section className="ds-prose grievance-narrative"><h2>Your description</h2><p>{draft.narrative}</p></section>
          <Row><Button variant="tertiary" onPress={() => setStep(0)}>Edit description</Button><Button variant="tertiary" onPress={() => setStep(1)}>Edit classification</Button><Button variant="tertiary" onPress={() => setStep(2)}>Edit identity choice</Button></Row>
          <PrivacyNotice title="Before you submit">Your report stays linked to your verified account. The responsible office reviews it and decides the next steps.</PrivacyNotice>
        </div>
      )}
      <Row justify="between">
        <Button variant="secondary" isDisabled={step === 0 || action.isPending} onPress={() => { setError(''); setStep((current) => current - 1) }}>Back</Button>
        {step < 3 ? <Button onPress={() => { if (validate(step)) setStep((current) => current + 1) }}>Next</Button> : <Button loading={action.isPending} onPress={submit}>Submit report</Button>}
      </Row>
      <DraftHelp key={helpOpen ? 'open' : 'closed'} narrative={draft.narrative} isOpen={helpOpen} onOpenChange={setHelpOpen} onUse={(value) => update('narrative', value)} />
      <Modal role="alertdialog" title="Discard this draft?" isOpen={discardOpen} onOpenChange={setDiscardOpen}>
        <ModalBody><p>The description and choices in this draft will be cleared.</p></ModalBody>
        <ModalActions><Button variant="secondary" onPress={() => setDiscardOpen(false)}>Keep draft</Button><Button variant="destructive" onPress={() => { setDraft({ ...blankDraft }); setStep(0); setError(''); setDiscardOpen(false); action.mutate({ action: 'saveDraft', payload: { narrative: '' } }); try { localStorage.removeItem(storageKey) } catch { /* No stored draft to remove. */ } }}>Discard draft</Button></ModalActions>
      </Modal>
    </div>
  )
}

function Conversation({ report, pageId }: { report: Report; pageId: 'P20' | 'P22' }) {
  const [body, setBody] = useState('')
  const action = useAction(pageId)
  const messages = items(report.messages)
  const closed = isClosed(report)
  return (
    <div className="app-page">
      <PrivacyNotice title={pageId === 'P20' ? 'Conversation with the handling office' : 'Messages shown to the reporter'}>
        {pageId === 'P20' ? report.identity === 'anonymous' ? 'You appear as ' + words(report.alias) + ' unless you share your name with this office.' : 'The handling office sees your verified name.' : 'The reporter sees messages you send here. Keep internal coordination in Notes.'}
      </PrivacyNotice>
      {messages.length ? <ol className="grievance-messages" aria-label="Report messages">{messages.map((message) => <li key={words(message.id)}><header><strong>{words(object(message.author).name, 'Handling office')}</strong><time dateTime={words(message.at)}>{date(message.at)}</time></header><p>{words(message.body)}</p></li>)}</ol> : <EmptyState title="No messages yet" description="Use this conversation to share information with the responsible office." />}
      <ActionError error={action.error} />
      {closed ? <Alert tone="neutral" title="This conversation is closed">The report is resolved or closed.</Alert> : <form className="app-page" onSubmit={(event) => { event.preventDefault(); if (body.trim()) action.mutate({ action: 'sendReportMessage', recordId: report.id, payload: { body } }, { onSuccess: () => setBody('') }) }}>
        <TextArea label={pageId === 'P20' ? 'Message to the handling office' : 'Message to the reporter'} value={body} onChange={setBody} isRequired maxLength={4000} showCount />
        <Button type="submit" loading={action.isPending} isDisabled={!body.trim()}>Send message</Button>
      </form>}
    </div>
  )
}

function ReportList({ page }: { page: PageEnvelope }) {
  const [view, setView] = useState('active')
  const records = items(page.data.reports).filter((report) => view === 'closed' ? isClosed(report) : !isClosed(report))
  return (
    <div className="app-page">
      <Heading title="My reports" actions={<Button icon="plus" href="/reports/new">New report</Button>} />
      <PrivacyNotice title="Who can open these">Only you and the office handling each report can open it. Reporting under your name or anonymously is your choice on each report.</PrivacyNotice>
      <SegmentedControl aria-label="Report view" selectedKey={view} onSelectionChange={(key) => setView(String(key))}><Segment id="active">Active</Segment><Segment id="closed">Closed</Segment></SegmentedControl>
      {records.length ? <>
        <div className="grievance-desktop"><ReportsTable caption="Your reports" rows={records.map((report) => ({ id: words(report.id), reference: reportReference(report), category: words(report.category, 'General concern'), status: words(report.status), statusForm: reportForm(report), statusTone: reportTone(report), updated: date(report.updatedAt), href: '/reports/' + encodeURIComponent(words(report.id)), actionLabel: 'View' }))} /></div>
        <div className="grievance-mobile ds-record-list">{records.map((report) => <ReportRecord key={words(report.id)} reference={reportReference(report)} title={words(report.category, 'General concern')} status={words(report.status)} statusForm={reportForm(report)} statusTone={reportTone(report)} facts={[{ label: 'Office', value: words(report.office) }, { label: 'Updated', value: date(report.updatedAt) }]} href={'/reports/' + encodeURIComponent(words(report.id))} />)}</div>
      </> : <EmptyState title={view === 'closed' ? 'No closed reports' : 'No reports yet'} description="If something is wrong, you can tell the right office here." action={view === 'active' ? <Button href="/reports/new">New report</Button> : undefined} />}
    </div>
  )
}

function ReportDetail({ page }: { page: PageEnvelope }) {
  const report = object(page.data.record) as Report
  const [discloseOpen, setDiscloseOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const assistant = useAction('P41')
  if (!report.id) return <RestrictedView record />
  const disclosed = Array.isArray(report.disclosedTo) && report.disclosedTo.includes(report.stage)
  // TBD(D-03): use Report until Guidance opens a linked Case File.
  return (
    <div className="app-page">
      <Breadcrumbs items={[{ label: 'My reports', href: '/reports' }, { label: reportReference(report) }]} />
      <Heading title={report.category || 'General concern'} description={report.caseFileId ? 'Case File ' + words(report.caseFileId) + ' (from report ' + report.id + ')' : 'Report ' + report.id} actions={<ReportStatus report={report} />} />
      <Facts values={[
        ['Reference', reportReference(report)], ['Type', words(report.type, 'Report')], ['Current office', report.office],
        ['Submitted', date(report.createdAt)], ['Identity', report.identity === 'anonymous' ? disclosed ? 'Name shared with this office' : 'Alias to this office' : 'Named'],
      ]} />
      <PrivacyNotice title="Who can open this">You and the office handling it. Internal notes stay with the office.</PrivacyNotice>
      <Tabs defaultSelectedKey="progress">
        <TabList aria-label="Report views"><Tab id="progress">Progress</Tab><Tab id="messages">Messages</Tab></TabList>
        <TabPanel id="progress"><Timeline report={report} /></TabPanel>
        <TabPanel id="messages"><Conversation report={report} pageId="P20" /></TabPanel>
      </Tabs>
      <Row>
        {report.identity === 'anonymous' && !disclosed && <Button variant="secondary" onPress={() => setDiscloseOpen(true)}>Share my name</Button>}
        {words(report.sourcePostId) && <Link href={'/feed/' + encodeURIComponent(words(report.sourcePostId))}>Started from your discussion</Link>}
        <Button variant="tertiary" onPress={() => { setHelpOpen(true); assistant.mutate({ action: 'assistantAsk', payload: { question: 'Explain my report milestones for ' + report.id } }) }}>What does this stage mean?</Button>
      </Row>
      <DiscloseIdentityDialog report={report} isOpen={discloseOpen} onOpenChange={setDiscloseOpen} />
      <Drawer title="About this stage" isOpen={helpOpen} onOpenChange={setHelpOpen}><div className="app-page"><Alert tone="neutral" title="People decide the next steps">The assistant explains approved process information.</Alert><ActionError error={assistant.error} />{assistant.isPending ? <ViewState kind="loading" title="Loading explanation" /> : <p className="ds-prose">{words(object(assistant.data?.record).reply)}</p>}<Link href="/assistant">Open assistant</Link></div></Drawer>
    </div>
  )
}

export function ConflictNotice() {
  return <Alert tone="warning" title="Routed to you because the assigned adviser may be involved">Detection only suggests routing. It isn't a finding.</Alert>
}

export function CaseNotes({ report }: { report: Report }) {
  const [body, setBody] = useState('')
  const action = useAction('P22')
  return (
    <div className="app-page">
      <PrivacyNotice title="Internal notes">Internal notes never appear in the reporter's timeline.</PrivacyNotice>
      {items(report.notes).length ? <ol className="grievance-messages" aria-label="Internal case notes">{items(report.notes).map((note) => <li key={words(note.id)}><header><Badge form="restricted">Internal</Badge><strong>{words(object(note.author).name, 'Handling office')}</strong><time dateTime={words(note.at)}>{date(note.at)}</time></header><p>{words(note.body)}</p></li>)}</ol> : <ViewState kind="empty" title="No internal notes yet" />}
      <ActionError error={action.error} />
      <form className="app-page" onSubmit={(event) => { event.preventDefault(); if (body.trim()) action.mutate({ action: 'addNote', recordId: report.id, payload: { body } }, { onSuccess: () => setBody('') }) }}>
        <TextArea label="Add a note" value={body} onChange={setBody} isRequired maxLength={4000} showCount />
        <Button type="submit" loading={action.isPending} isDisabled={!body.trim() || isClosed(report)}>Save note</Button>
      </form>
    </div>
  )
}

const actionLabels: Record<string, string> = { respond: 'Respond', recordAction: 'Record action', escalate: 'Escalate', transfer: 'Transfer', resolve: 'Resolve', close: 'Close', convert: 'Open Case File', milestone: 'Add milestone', return: 'Return to OSAS' }
const nextOffices: Record<string, { stage: string; label: string }> = { adviser: { stage: 'chair', label: 'Program Chair' }, chair: { stage: 'dean', label: 'Dean' }, dean: { stage: 'guidance', label: 'Guidance Office' }, guidance: { stage: 'osas', label: 'OSAS' }, osas: { stage: 'executive', label: "President's Office" }, executive: { stage: 'osas', label: 'OSAS' } }

export function CaseActionBar({ report }: { report: Report }) {
  const primary = report.stage === 'adviser' ? 'respond' : report.stage === 'guidance' && !report.caseFileId ? 'convert' : ['guidance', 'osas'].includes(report.stage) ? 'milestone' : 'recordAction'
  const allowed = (Array.isArray(report.allowedActions) ? report.allowedActions.map(String) : []).sort((a, b) => Number(b === primary) - Number(a === primary))
  const [selected, setSelected] = useState('')
  const [reason, setReason] = useState('')
  const [update, setUpdate] = useState('')
  const [error, setError] = useState('')
  const action = useAction('P22')
  const transition = ['escalate', 'transfer', 'return'].includes(selected)
  const next = nextOffices[report.stage]
  const label = (type: string) => type === 'recordAction' && ['chair', 'dean'].includes(report.stage) ? 'Record decision' : actionLabels[type] ?? type
  // TBD(D-04): offer only server-approved chain transitions; no undefined bypass or executive power.
  if (!allowed.length) return <Alert tone="neutral" title="No actions available">This view is read only at the current stage.</Alert>
  const open = (type: string) => { setSelected(type); setReason(''); setUpdate(''); setError(''); action.reset() }
  return (
    <section className="app-region">
      <SectionHeader level={2} title="Next action" />
      {allowed.slice(0, 2).map((type, index) => <Button key={type} variant={index ? 'secondary' : 'primary'} onPress={() => open(type)}>{label(type)}</Button>)}
      {allowed.length > 2 && <MenuButton label="More actions" onAction={(key) => open(String(key))}>{allowed.slice(2).map((type) => <MenuItem id={type} key={type}>{label(type)}</MenuItem>)}</MenuButton>}
      <Modal title={(label(selected) || 'Record action') + '?'} role={['escalate', 'transfer', 'return', 'resolve', 'close', 'convert'].includes(selected) ? 'alertdialog' : 'dialog'} isOpen={Boolean(selected)} onOpenChange={(openState) => !openState && setSelected('')}>
        <ModalBody>
          <div className="app-page">
            {transition && next && <Select label="Next office" selectedKey={next.stage} onSelectionChange={() => undefined} isRequired><SelectOption id={next.stage}>{next.label}</SelectOption></Select>}
            <TextArea label="Reason" value={reason} onChange={setReason} isRequired maxLength={2000} showCount />
            <TextArea label="Update shown to the reporter" value={update} onChange={setUpdate} isRequired maxLength={4000} showCount />
            <PrivacyNotice title="This action is recorded">The reason stays in the handler history. The reporter receives the update you write above.</PrivacyNotice>
            {error && <Alert tone="danger" title="Complete the action">{error}</Alert>}
            <ActionError error={action.error} />
          </div>
        </ModalBody>
        <ModalActions>
          <Button variant="secondary" isDisabled={action.isPending} onPress={() => setSelected('')}>Cancel</Button>
          <Button loading={action.isPending} onPress={() => {
            if (!reason.trim() || !update.trim()) { setError('A reason and reporter update are required.'); return }
            action.mutate({ action: 'caseAction', recordId: report.id, reason, payload: { type: selected, update, ...(transition && next ? { nextStage: next.stage } : {}) } }, { onSuccess: () => setSelected('') })
          }}>{label(selected) || 'Save action'}</Button>
        </ModalActions>
      </Modal>
    </section>
  )
}

function CaseWorkspace({ page }: { page: PageEnvelope }) {
  const report = object(page.data.record) as Report
  if (!report.id) return <RestrictedView record />
  // TBD(D-04) / TBD(D-08): previous handlers retain only the API's own-entry summary.
  if (report.historyOnly) return <div className="app-page"><Breadcrumbs items={[{ label: 'Cases', href: '/cases' }, { label: reportReference(report) }]} /><Heading title="Handled by me" description={reportReference(report)} /><Alert tone="neutral" title="Earlier handling history">{words(report.historyNotice)}</Alert><Timeline report={report} handler /></div>
  return (
    <div className="app-page">
      <Breadcrumbs items={[{ label: 'Cases', href: '/cases' }, { label: reportReference(report) }]} />
      <Heading title={report.category || 'General concern'} description={(report.caseFileId ? 'Case File ' + words(report.caseFileId) + ' · Report ' : 'Report ') + report.id + ' · received ' + date(report.createdAt)} actions={<ReportStatus report={report} />} />
      {report.bypassed === true && <ConflictNotice />}
      <Grid columns="main">
        <Tabs defaultSelectedKey="report">
          <TabList aria-label="Case workspace views"><Tab id="report">Report</Tab><Tab id="messages">Messages</Tab><Tab id="notes">Notes</Tab><Tab id="history">History</Tab></TabList>
          <TabPanel id="report"><div className="app-page"><Facts values={[
            ['Reference', reportReference(report)], ['Category', report.category], ['Severity', report.severity], ['Program', words(report.program)],
            ['Submitted', date(report.createdAt)], ['Reporter', words(object(report.reporter).name, words(report.alias))], ['Identity', report.identity === 'anonymous' ? 'Alias unless disclosed to this office' : 'Named'],
          ]} /><section className="ds-prose grievance-narrative"><h2>Report description</h2><p>{words(report.narrative)}</p></section>{words(report.sourcePostId) && <Link href={'/feed/' + encodeURIComponent(words(report.sourcePostId))}>Linked discussion</Link>}<PrivacyNotice title="Restricted record">Only authorized handlers may open this record. Every action is recorded.</PrivacyNotice></div></TabPanel>
          <TabPanel id="messages"><Conversation report={report} pageId="P22" /></TabPanel>
          <TabPanel id="notes"><CaseNotes report={report} /></TabPanel>
          <TabPanel id="history"><Timeline report={report} handler /></TabPanel>
        </Tabs>
        <aside className="app-page grievance-action-rail"><CaseActionBar report={report} /><Facts values={[['Current office', report.office], ['Type', words(report.type, 'Report')], ['Updated', date(report.updatedAt)]]} /></aside>
      </Grid>
    </div>
  )
}

function CaseQueue({ page }: { page: PageEnvelope }) {
  const session = useQuery(sessionQuery())
  const roles = session.data?.user.roles ?? []
  const role = ['chair', 'dean', 'guidance', 'osas', 'president', 'professor'].find((candidate) => roles.some((value) => value === candidate)) ?? 'professor'
  const initial = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search)
  const [query, setQuery] = useState(initial.get('q') ?? '')
  const [level, setLevel] = useState(initial.get('severity') ?? '')
  const [category, setCategory] = useState(initial.get('category') ?? '')
  const [status, setStatus] = useState(initial.get('status') ?? '')
  const [received, setReceived] = useState('term')
  const [tab, setTab] = useState(initial.get('tab') ?? 'open')
  const [currentPage, setCurrentPage] = useState(1)
  const [sort, setSort] = useState<SortDescriptor>({ column: 'updatedAt', direction: 'descending' })
  const records = items(page.data.cases)
  const tabDefs = role === 'chair' ? [['bypassed', 'Bypassed'], ['open', 'Escalated to me'], ...(roles.includes('professor') ? [['teaching', 'Teaching assignments']] : []), ['history', 'Handled by me']]
    : role === 'dean' ? [['open', 'At Dean stage'], ['history', 'Transferred'], ['closed', 'Closed']]
      : role === 'guidance' ? [['intake', 'Intake'], ['open', 'Active Case Files'], ['history', 'Transferred to OSAS'], ['closed', 'Closed']]
        : role === 'osas' ? [['open', 'New transfers'], ['active', 'Active'], ['history', 'Transferred'], ['closed', 'Closed']]
          : role === 'president' ? [['open', 'Awaiting action'], ['closed', 'Closed']]
            : [['open', 'Open'], ['waiting', 'Waiting on reporter'], ['closed', 'Closed']]
  const validTab = tabDefs.some(([id]) => id === tab) ? tab : tabDefs[0][0]
  const inTab = (report: Item, selected: string) => selected === 'closed' ? isClosed(report)
    : selected === 'history' ? report.historyOnly === true
      : selected === 'bypassed' ? report.bypassed === true && !report.historyOnly && !isClosed(report)
        : selected === 'teaching' ? report.stage === 'adviser' && !report.historyOnly && !isClosed(report)
        : selected === 'waiting' ? words(report.status).toLowerCase().includes('waiting')
          : selected === 'intake' ? report.stage === 'guidance' && !report.caseFileId && !report.historyOnly && !isClosed(report)
            : selected === 'active' ? !report.historyOnly && !isClosed(report) && items(report.history).length > 1
              : !report.historyOnly && !isClosed(report) && (role !== 'chair' || !report.bypassed && report.stage === 'chair') && (role !== 'guidance' || Boolean(report.caseFileId))
  const filtered = records.filter((report) => inTab(report, validTab) && (!query || words(report.id).toLowerCase().includes(query.toLowerCase())) && (!level || report.severity === level) && (!category || report.category === category) && (!status || report.status === status) && (received === 'term' || new Date(words(report.createdAt)).getTime() >= Date.now() - Number(received) * 86400000))
    .sort((a, b) => (sort.column === 'waiting' ? waitingDays(a) - waitingDays(b) : words(a[String(sort.column)]).localeCompare(words(b[String(sort.column)]))) * (sort.direction === 'descending' ? -1 : 1))
  const pageCount = Math.max(1, Math.ceil(filtered.length / 8))
  const shown = filtered.slice((Math.min(currentPage, pageCount) - 1) * 8, Math.min(currentPage, pageCount) * 8)
  const reset = (change: () => void) => { change(); setCurrentPage(1) }
  const title = role === 'chair' ? 'Program reports · ' + (session.data?.user.program ?? '') : role === 'dean' ? 'Escalated reports' : role === 'guidance' ? 'Case Files' : role === 'osas' ? 'OSAS cases' : role === 'president' ? 'Executive cases' : 'Assigned reports'
  return (
    <div className="app-page">
      <Heading title={title} description={page.scope} />
      <PrivacyNotice title="Reports routed to you">You see only reports routed to you. Every action is recorded.</PrivacyNotice>
      <Tabs selectedKey={validTab} onSelectionChange={(key) => reset(() => setTab(String(key)))}>
        <TabList aria-label="Case queues">{tabDefs.map(([id, label]) => <Tab id={id} key={id} count={records.filter((report) => inTab(report, id)).length}>{label}</Tab>)}</TabList>
        <TabPanel id={validTab}><div className="app-page">
      <FilterBar query={query} onQueryChange={(value) => reset(() => setQuery(value))} searchLabel="Search by reference" searchPlaceholder="RPT-0241">
        <Select label="Severity" selectedKey={level} onSelectionChange={(key) => reset(() => setLevel(String(key ?? '')))}><SelectOption id="">All severities</SelectOption><SelectOption id="low">Low</SelectOption><SelectOption id="medium">Medium</SelectOption><SelectOption id="high">High</SelectOption></Select>
        <Select label="Category" selectedKey={category} onSelectionChange={(key) => reset(() => setCategory(String(key ?? '')))}><SelectOption id="">All categories</SelectOption>{[...new Set(records.map((report) => words(report.category)))].map((value) => <SelectOption id={value} key={value}>{value}</SelectOption>)}</Select>
        <Select label="Status" selectedKey={status} onSelectionChange={(key) => reset(() => setStatus(String(key ?? '')))}><SelectOption id="">All statuses</SelectOption>{[...new Set(records.map((report) => words(report.status)))].map((value) => <SelectOption id={value} key={value}>{value}</SelectOption>)}</Select>
        <Select label="Received" selectedKey={received} onSelectionChange={(key) => reset(() => setReceived(String(key)))}><SelectOption id="7">Last 7 days</SelectOption><SelectOption id="30">Last 30 days</SelectOption><SelectOption id="term">This term</SelectOption></Select>
      </FilterBar>
      {filtered.length ? <>
        <div className="grievance-desktop">
          <Table aria-label="Reports in this queue" sortDescriptor={sort} onSortChange={setSort}>
            <TableHeader><Column id="id" isRowHeader allowsSorting>Reference</Column><Column id="category" allowsSorting>Category</Column><Column id="severity" allowsSorting>Severity</Column><Column id="status" allowsSorting>Status</Column><Column id="createdAt" allowsSorting>Received</Column><Column id="updatedAt" allowsSorting>Last action</Column><Column id="waiting" allowsSorting>Waiting (days)</Column><Column>Open</Column></TableHeader>
            <TableBody>{shown.map((report) => <TableRow key={words(report.id)} id={words(report.id)}><Cell reference>{reportReference(report)}</Cell><Cell>{words(report.category, 'General concern')}{report.bypassed === true && <Badge form="restricted">Adviser bypassed</Badge>}</Cell><Cell><Severity level={severity(report)} /></Cell><Cell><Badge tone={reportTone(report)} form={reportForm(report)}>{words(report.status)}</Badge></Cell><Cell>{date(report.createdAt)}</Cell><Cell>{date(report.updatedAt)}</Cell><Cell>{waitingDays(report)}</Cell><Cell><Link href={'/cases/' + encodeURIComponent(words(report.id))}>Open</Link></Cell></TableRow>)}</TableBody>
          </Table>
        </div>
        <div className="grievance-mobile ds-record-list">{shown.map((report) => <ReportRecord key={words(report.id)} reference={reportReference(report)} title={words(report.category, 'General concern')} status={words(report.status)} statusForm={reportForm(report)} statusTone={reportTone(report)} facts={[{ label: 'Severity', value: severity(report) }, { label: 'Received', value: date(report.createdAt) }, { label: 'Office', value: words(report.office) }]} href={'/cases/' + encodeURIComponent(words(report.id))} />)}</div>
        <Pagination page={Math.min(currentPage, pageCount)} pageCount={pageCount} onPageChange={setCurrentPage} summary={'Showing ' + shown.length + ' of ' + filtered.length + ' reports'} />
      </> : query || level || category || status ? <ViewState kind="empty" title="No reports match these filters" description="Change or clear a filter to see other reports within your access." /> : <EmptyState title="No reports in this queue" description="Reports routed to your role and stage will appear here." />}
        </div></TabPanel>
      </Tabs>
    </div>
  )
}

export function GrievancePage({ page }: { page: PageEnvelope }) {
  if (page.pageId === 'P18') return <ReportList page={page} />
  if (page.pageId === 'P19') return <ReportWizard page={page} />
  if (page.pageId === 'P20') return <ReportDetail page={page} />
  if (page.pageId === 'P21') return <CaseQueue page={page} />
  return <CaseWorkspace page={page} />
}
