import {
  Alert, Button, DatePicker, Drawer, Grid, Icon, Link, MenuButton, MenuItem, Modal,
  ModalActions, ModalBody, Pagination, PrivacyNotice, Radio, RadioGroup, Search, Select,
  SelectOption, TextArea, TextField, ViewState, toast,
  type SortDescriptor,
} from '@meetingat10/design-system/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, LayoutGroup, MotionConfig, motion, type Variants } from 'motion/react'
import { useEffect, useRef, useState } from 'react'

import { getPage, performPageAction, type PageAction, type PageEnvelope } from '@/lib/api'
import { sessionQuery } from '@/lib/queries'
import { formatDate, formatDateTime, initials, relativeTime } from '@/lib/format'
import { RestrictedView } from '@/components/app/guards'
import { AccessPanel, ConsentDialog, HandlerTalk, ReadersChoice, TalkChoice, alsoReadableBy, modeLabel, readAccess, readTalk, readWording } from '@/components/app/concern-talk'
import { categoryDetailMax, categoryText, choicePayload, choiceProblems, cleanChoice, readCategoryOptions } from '@/lib/concern-categories'
import { Empty, PageHeader, Panel, StatusChip, toneFor, type Tone } from '@/components/app/page-shell'
import { PagedList } from '@/components/app/paging'
import './grievance.css'

type Item = Record<string, unknown>
type Identity = 'named' | 'anonymous'
type SeverityLevel = 'low' | 'medium' | 'high'
type Report = Item & { id: string; category: string; severity: SeverityLevel; status: string; stage: string; office: string }

const ease = [0.16, 1, 0.3, 1] as const
const spring = { type: 'spring', stiffness: 420, damping: 38 } as const

const object = (value: unknown): Item => value && typeof value === 'object' && !Array.isArray(value) ? value as Item : {}
const items = (value: unknown): Item[] => Array.isArray(value) ? value.map(object) : []
const words = (value: unknown, fallback = '') => typeof value === 'string' || typeof value === 'number' ? String(value) : fallback
const cap = (value: string) => value.charAt(0).toUpperCase() + value.slice(1)
const isClosed = (report: Item) => ['Resolved', 'Closed'].includes(words(report.status))
const reportReference = (report: Item) => words(report.caseFileId, words(report.id))
// Named reporters show their name; an anonymous one shows the alias the office sees.
const studentName = (report: Item) => words(object(report.reporter).name, words(report.alias, '—'))
const severity = (report: Item): SeverityLevel => ['low', 'medium', 'high'].includes(words(report.severity)) ? report.severity as SeverityLevel : 'medium'
const severityTone: Record<SeverityLevel, Tone> = { high: 'danger', medium: 'warn', low: 'neutral' }
const waitingDays = (report: Item) => Math.max(0, Math.floor((Date.now() - new Date(words(report.updatedAt, words(report.createdAt))).getTime()) / 86400000)) || 0
const reportPath = (report: Item) => '/reports/' + encodeURIComponent(words(report.id))
const casePath = (report: Item) => '/cases/' + encodeURIComponent(words(report.id))

// Pipeline: the five handling stages (Adviser to OSAS, which is the last) plus Submitted and Resolved.
const stages = [['submitted', 'Submitted'], ['adviser', 'Adviser'], ['chair', 'Chair'], ['dean', 'Dean'], ['guidance', 'Guidance'], ['osas', 'OSAS'], ['resolved', 'Resolved']] as const
const stageOf = (report: Item): string => isClosed(report) ? 'resolved'
  : report.stage === 'adviser' && words(report.status).toLowerCase() === 'submitted' ? 'submitted'
    : words(report.stage, 'adviser')
const stageIndex = (report: Item) => Math.max(0, stages.findIndex(([key]) => key === stageOf(report)))
const stageStep = (report: Item) => Math.max(1, stageIndex(report))
const stageLabel = (report: Item) => stages[stageIndex(report)][1]

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
  return error ? <Alert tone="danger" title="Couldn't save your change">{error instanceof Error ? error.message : 'Try again. Your entered text is kept.'}</Alert> : null
}

/** Quiet one-line privacy explanation. */
function Note({ children }: { children: React.ReactNode }) {
  return <p className="gv-note"><Icon name="lock" size={16} /><span>{children}</span></p>
}

function Facts({ values }: { values: Array<[string, React.ReactNode]> }) {
  return <dl className="gv-facts">{values.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
}

function SeverityChip({ report }: { report: Item }) {
  return <StatusChip tone={severityTone[severity(report)]}>{cap(severity(report))}</StatusChip>
}

/** Segmented pills with a sliding current indicator. */
function PillGroup({ id, label, value, options, onChange }: { id: string; label: string; value: string; options: Array<{ id: string; label: string }>; onChange: (value: string) => void }) {
  return (
    <LayoutGroup id={id}>
      <div className="gv-pills" role="group" aria-label={label}>
        {options.map((option) => (
          <button key={option.id} type="button" className="gv-pill" aria-pressed={value === option.id} onClick={() => onChange(option.id)}>
            {value === option.id && <motion.span layoutId="gv-pill-bg" className="gv-pill__bg" transition={spring} />}
            <span className="gv-pill__text">{option.label}</span>
          </button>
        ))}
      </div>
    </LayoutGroup>
  )
}

function Timeline({ report, handler = false }: { report: Item; handler?: boolean }) {
  const history = items(report.history)
  if (!history.length) return <Empty title="No updates yet">Updates from the responsible office show here.</Empty>
  const hasCurrent = history.some((entry) => entry.state === 'current')
  return (
    <ol className="accs-timeline gv-timeline" aria-label={handler ? 'Case history' : 'Report progress'}>
      {history.map((entry, index) => {
        const actor = handler ? entry.actorRole === 'student' ? 'Verified reporter' : words(entry.actorRole, words(entry.office, 'Handling office')) : words(entry.office)
        const body = handler ? [words(entry.reason), words(entry.update)].filter(Boolean).join(' · ') : words(entry.update)
        const current = entry.state === 'current' || (!hasCurrent && index === history.length - 1)
        return (
          <motion.li key={words(entry.id, String(index))} data-current={current || undefined} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.45, ease, delay: 0.1 + index * 0.07 }}>
            <p className="gv-ev__head">
              <strong>{words(entry.action, 'Update recorded')}</strong>
              {actor && <span className="accs-tag gv-cap">{actor}</span>}
              {handler && entry.public === true && <span className="accs-tag">Shown to reporter</span>}
            </p>
            {body && <p className="gv-ev__body">{body}</p>}
            <time className="accs-timeline__time" dateTime={words(entry.at)}>{formatDateTime(entry.at)}</time>
          </motion.li>
        )
      })}
    </ol>
  )
}

export function IdentityChoice({
  value,
  onChange,
  allowAnonymous = true,
  context = 'report',
}: {
  value: Identity
  onChange: (value: Identity) => void
  allowAnonymous?: boolean
  context?: 'report' | 'post'
}) {
  if (context === 'post') {
    return (
      <div className="app-page">
        <RadioGroup
          label="How should readers see you?"
          value={value}
          onChange={(next) => onChange(next as Identity)}
          isRequired
        >
          <Radio value="named" card description="Readers see your verified name.">
            Show my name
          </Radio>
          {allowAnonymous && (
            <Radio value="anonymous" card description="Readers see 'Anonymous student'.">
              Post anonymously
            </Radio>
          )}
        </RadioGroup>
        <PrivacyNotice title="Your account stays linked">
          Classmates see 'Anonymous student'. Your verified account stays linked for moderators.
        </PrivacyNotice>
      </div>
    )
  }
  return (
    <div className="gv-stack">
      <RadioGroup label="How should handlers see you?" value={value} onChange={(next) => onChange(next as Identity)} isRequired>
        <Radio value="named" card description="The responsible office sees your verified name.">Use my name</Radio>
        {allowAnonymous && <Radio value="anonymous" card description="The responsible office sees an alias until you share your name with that office.">Stay anonymous for now</Radio>}
      </RadioGroup>
      {!allowAnonymous && <Alert tone="neutral" title="Anonymous reporting is paused">You can still submit a report under your name. <Link href="/standing">View account standing</Link>.</Alert>}
      <Note>Anonymous means the people handling your report see an alias. The report is still tied to your verified account. You can share your name later.</Note>
    </div>
  )
}

export function DiscloseIdentityDialog({ report, isOpen, onOpenChange }: { report: Report; isOpen: boolean; onOpenChange: (open: boolean) => void }) {
  const action = useAction('P20')
  // TBD(D-08): disclosure reversal and mandatory disclosure policy are not defined.
  return (
    <Modal role="alertdialog" title={'Share your name with ' + report.office + '?'} isOpen={isOpen} onOpenChange={onOpenChange}>
      <ModalBody>
        <p>Your verified name goes to the office handling this report now. We record the disclosure for that office.</p>
        <p>Other offices don't get your name automatically.</p>
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
      <div className="gv-stack">
        <Alert tone="neutral" title="The assistant helps you write">It doesn't decide what happened or what happens next. It gives approved writing tips only.</Alert>
        <Button variant="secondary" loading={action.isPending} onPress={() => action.mutate({ action: 'assistantAsk', payload: { question: 'Help me write and organize my report draft.' } })}>Show writing guidance</Button>
        <ActionError error={action.error} />
        {reply && <p className="ds-prose">{reply}</p>}
        <TextArea label="Text to review" value={candidate} onChange={setCandidate} maxLength={4000} showCount description="Review and edit your wording before using it." />
        <Button onPress={() => { onUse(candidate); onOpenChange(false) }}>Use this text</Button>
      </div>
    </Drawer>
  )
}

// The consent is never kept in a draft. Drafts from before #31 may still carry allowChair / allowDean; they are ignored.
type Draft = { narrative: string; category: string; subcategory: string; categoryDetail: string; severity: SeverityLevel | ''; identity: Identity; location: string; occurredOn: string; aboutAdvisor: boolean }
const blankDraft: Draft = { narrative: '', category: '', subcategory: '', categoryDetail: '', severity: '', identity: 'named', location: '', occurredOn: '', aboutAdvisor: false }

const stepNames = ['Describe concern', 'Add details', 'Privacy and consent', 'Review and submit']
// One line under the steps saying what this step is for.
const stepHints = [
  'Tell us what happened in your own words.',
  'Say what kind of concern it is, how serious it is, and whether it is about your adviser.',
  'Choose how the people handling your concern see you. You give your consent to send it on the last step.',
  'Check who can read your concern. Your report is not sent until you accept the consent form.',
]
const stepMotion: Variants = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 28 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir * -28 }),
}

/** Numbered sequence with a connector that fills as steps complete. */
function StepIndicator({ current }: { current: number }) {
  return (
    <ol className="gv-steps" aria-label="Concern steps">
      {stepNames.map((name, index) => (
        <li key={name} className="gv-steps__item" data-state={index < current ? 'done' : index === current ? 'current' : 'todo'} aria-current={index === current ? 'step' : undefined}>
          <span className="gv-steps__dot">{index < current ? <Icon name="check" size={16} /> : index + 1}</span>
          <span className="gv-steps__name">{name}</span>
          {index < stepNames.length - 1 && <span className="gv-steps__line" aria-hidden><motion.span initial={false} animate={{ scaleX: index < current ? 1 : 0 }} transition={{ duration: 0.4, ease }} /></span>}
        </li>
      ))}
    </ol>
  )
}

export function ReportWizard({ page }: { page: PageEnvelope }) {
  const session = useQuery(sessionQuery())
  const storageKey = 'accs-report-draft-' + (session.data?.user.id ?? 'signed-in')
  const serverDraft = object(page.data.draft)
  const options = readCategoryOptions(page.data.categoryOptions)
  const [draft, setDraft] = useState<Draft>(() => {
    let local: Item = {}
    try { local = object(JSON.parse(localStorage.getItem(storageKey) ?? '{}')) } catch { /* Keep the server draft when local storage is unavailable. */ }
    const saved = { ...serverDraft, ...local }
    return {
      narrative: words(saved.narrative),
      ...cleanChoice({ category: words(saved.category), subcategory: words(saved.subcategory), categoryDetail: words(saved.categoryDetail) }, options),
      severity: ['low', 'medium', 'high'].includes(words(saved.severity)) ? saved.severity as SeverityLevel : '',
      identity: page.data.anonymityAllowed !== false && saved.identity === 'anonymous' ? 'anonymous' : 'named',
      location: words(saved.location), occurredOn: words(saved.occurredOn),
      aboutAdvisor: saved.aboutAdvisor === true,
    }
  })
  const [step, setStep] = useState(0)
  const [dir, setDir] = useState(1)
  const [error, setError] = useState('')
  const [discardOpen, setDiscardOpen] = useState(false)
  const [consentOpen, setConsentOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [submitted, setSubmitted] = useState<Item>()
  const action = useAction('P19')
  const send = useAction('P19')
  const source = object(page.data.sourcePost)
  const adviser = words(object(page.data.adviser).name)
  const option = options.find((entry) => entry.label === draft.category)
  const missing = choiceProblems(draft, options)
  // A field the API refused, shown on that field (for example a sub-category it no longer lists).
  const refused = (path: string) => (send.error as { fields?: Array<{ path: string; message: string }> } | null)?.fields?.find((field) => field.path === path)?.message
  const fieldError = (path: 'category' | 'subcategory' | 'categoryDetail') => refused(path) ?? (error && step === 1 ? missing[path] : undefined)
  const chooseCategory = (category: string) => setDraft((current) => current.category === category ? current : { ...current, category, subcategory: '', categoryDetail: '' })
  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }))
  const go = (next: number) => { setDir(next > step ? 1 : -1); setStep(next); send.reset() }

  useEffect(() => {
    if (submitted) return
    try { localStorage.setItem(storageKey, JSON.stringify(draft)) } catch { /* The form state still retains the draft. */ }
  }, [draft, storageKey, submitted])

  const validate = (current: number) => {
    const message = current === 0 && !draft.narrative.trim() ? 'Describe what happened before continuing.'
      : current === 1 && (Object.keys(missing).length > 0 || !draft.severity) ? 'Choose a category, a sub-category (or describe it), and how serious it is.' : ''
    setError(message)
    return !message
  }
  const saveDraft = () => action.mutate({ action: 'saveDraft', payload: { narrative: draft.narrative, ...(draft.category ? { category: draft.category } : {}), ...(draft.subcategory ? { subcategory: draft.subcategory } : {}), ...(draft.categoryDetail.trim() ? { categoryDetail: draft.categoryDetail.trim() } : {}), ...(draft.severity ? { severity: draft.severity } : {}), identity: draft.identity } })
  // Submit opens the consent form. Nothing is sent until the student agrees there.
  const review = () => {
    if (!draft.narrative.trim() || Object.keys(missing).length > 0 || !draft.severity) {
      setError('Add a description, a category with its sub-category, and how serious it is before you submit.')
      return
    }
    setError('')
    send.reset()
    setConsentOpen(true)
  }
  const submit = () => send.mutate({
    action: 'createReport',
    payload: {
      narrative: draft.narrative, ...choicePayload(draft, options), severity: draft.severity, identity: draft.identity,
      aboutAdvisor: draft.aboutAdvisor,
      consent: { readStatement: true },
      ...(draft.location ? { location: draft.location } : {}),
      ...(draft.occurredOn ? { occurredOn: draft.occurredOn } : {}),
      ...(source.id ? { sourcePostId: words(source.id) } : {}),
    },
  }, {
    onSuccess: (result) => { setSubmitted(object(result.record)); try { localStorage.removeItem(storageKey) } catch { /* No stored draft to remove. */ } },
    onSettled: () => setConsentOpen(false),
  })

  if (submitted) {
    return (
      <MotionConfig reducedMotion="user">
        <div className="gv-wizard gv-page">
          <PageHeader title="Report submitted" crumbs={[{ label: 'My reports', href: '/reports' }, { label: 'New report' }]} />
          <Panel className="gv-done">
            <motion.span className="gv-done__mark" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ ...spring, delay: 0.15 }}><Icon name="check" size={24} /></motion.span>
            <p className="gv-done__ref">Your reference <span className="accs-mono">{words(submitted.id)}</span></p>
            <p className="gv-done__text">{words(submitted.status, 'The responsible office has received it.')} Open the report to choose how you would like to talk about it.</p>
            <div><Button href={reportPath(submitted)}>View report</Button></div>
          </Panel>
        </div>
      </MotionConfig>
    )
  }
  return (
    <MotionConfig reducedMotion="user">
      <div className="gv-wizard gv-page">
        <PageHeader
          title="File a concern"
          description="You review everything, and give your consent, before it is sent."
          crumbs={[{ label: 'My reports', href: '/reports' }, { label: 'New report' }]}
          actions={<MenuButton label="Draft" onAction={(key) => key === 'save' ? saveDraft() : setDiscardOpen(true)}><MenuItem id="save">Save draft</MenuItem><MenuItem id="discard" danger>Discard draft</MenuItem></MenuButton>}
        />
        <div className="gv-stack accs-reveal">
          <StepIndicator current={step} />
          <p className="gv-hint">Step {step + 1} of {stepNames.length}: {stepHints[step]}</p>
          {words(source.id) && <Alert tone="info" title={'Linked to your discussion "' + words(source.title) + '"'}>The link is saved only if you submit this report.</Alert>}
          {error && <Alert tone="danger" title="Check this step">{error}</Alert>}
          {action.error && action.variables?.action === 'saveDraft' ? <Alert tone="danger" title="Couldn't save your draft">Your text is kept on this device. Try saving again.</Alert> : <ActionError error={action.error} />}
          <Panel className="gv-form">
            <AnimatePresence mode="wait" initial={false} custom={dir}>
              <motion.div key={step} custom={dir} variants={stepMotion} initial="enter" animate="center" exit="exit" transition={{ duration: 0.26, ease }} className="gv-stack">
                {step === 0 && <>
                  <TextArea label="What happened" isRequired showCount maxLength={4000} value={draft.narrative} onChange={(value) => update('narrative', value)} description="Say what happened, when, and where. Leave out names you don't need to share." isInvalid={Boolean(error && !draft.narrative.trim())} errorMessage={error && !draft.narrative.trim() ? error : undefined} />
                  <Grid columns={2}>
                    <DatePicker label="When" onChange={(value) => update('occurredOn', value?.toString() ?? '')} description={draft.occurredOn ? 'Saved date: ' + formatDate(draft.occurredOn) : 'Optional'} />
                    <TextField label="Where" value={draft.location} onChange={(value) => update('location', value)} maxLength={200} description="Optional" />
                  </Grid>
                  {/* TBD(D-08): attachment access and retention policy is not approved. */}
                  <p className="gv-hint">Attachments are off until access and retention rules are set.</p>
                  <div><Button variant="secondary" onPress={() => setHelpOpen(true)}>Help me write this</Button></div>
                  <Note>The assistant helps you write. It doesn't decide what happened or what happens next.</Note>
                </>}
                {step === 1 && <>
                  <Grid columns={2}>
                    <Select label="Category" selectedKey={draft.category || null} onSelectionChange={(key) => chooseCategory(String(key ?? ''))} isRequired
                      description={option?.description || 'What kind of concern it is.'} isInvalid={Boolean(fieldError('category'))} errorMessage={fieldError('category')}>
                      {options.map((entry) => <SelectOption id={entry.label} key={entry.label}>{entry.label}</SelectOption>)}
                    </Select>
                    {option?.requiresDetail
                      ? <TextField label="Describe it briefly" isRequired maxLength={categoryDetailMax} value={draft.categoryDetail} onChange={(value) => update('categoryDetail', value)}
                        description={'A few words, up to ' + categoryDetailMax + ' characters.'} isInvalid={Boolean(fieldError('categoryDetail'))} errorMessage={fieldError('categoryDetail')} />
                      : <Select key={draft.category || 'none'} label="Sub-category" selectedKey={draft.subcategory || null} onSelectionChange={(key) => update('subcategory', String(key ?? ''))} isRequired
                        isDisabled={!option} description={option ? 'Pick the one closest to what happened.' : 'Choose a category first.'} isInvalid={Boolean(fieldError('subcategory'))} errorMessage={fieldError('subcategory')}>
                        {(option?.subcategories ?? []).map((sub) => <SelectOption id={sub} key={sub}>{sub}</SelectOption>)}
                      </Select>}
                  </Grid>
                  <RadioGroup label="How serious is it?" value={draft.severity} onChange={(value) => update('severity', value as SeverityLevel)} isRequired>
                    <Radio value="low" card description="Limited impact right now.">Low</Radio>
                    <Radio value="medium" card description="Affects ongoing activities or support.">Medium</Radio>
                    <Radio value="high" card description="Needs prompt review by a person.">High</Radio>
                  </RadioGroup>
                  <RadioGroup label="Is this concern about your adviser?" value={draft.aboutAdvisor ? 'yes' : 'no'} onChange={(value) => update('aboutAdvisor', value === 'yes')}>
                    <Radio value="no" card description="It goes to your adviser.">No</Radio>
                    <Radio value="yes" card description="It goes to your program chair instead. Your adviser is not told and cannot open it.">Yes</Radio>
                  </RadioGroup>
                </>}
                {step === 2 && <IdentityChoice value={draft.identity} onChange={(value) => update('identity', value)} allowAnonymous={page.data.anonymityAllowed !== false} />}
                {step === 3 && <>
                  <Facts values={[
                    ['Category', categoryText(draft, '—')], ['Severity', cap(draft.severity)], ['Identity', draft.identity === 'anonymous' ? 'Alias to handlers' : 'Use my name'],
                    ['When', draft.occurredOn ? formatDate(draft.occurredOn) : 'Not specified'], ['Where', draft.location || 'Not specified'],
                    ['Linked discussion', words(source.title, 'None')],
                  ]} />
                  <section className="gv-narrative"><h2 className="gv-sub">Your description</h2><p>{draft.narrative}</p></section>
                  <ReadersChoice sharing={draft} adviser={adviser} />
                  <div className="gv-edit-links"><Button variant="tertiary" onPress={() => go(0)}>Edit description</Button><Button variant="tertiary" onPress={() => go(1)}>Edit details</Button><Button variant="tertiary" onPress={() => go(2)}>Edit privacy choice</Button></div>
                  <Note>Your report stays linked to your verified account. The responsible office reviews it and decides the next steps.</Note>
                </>}
              </motion.div>
            </AnimatePresence>
          </Panel>
          {send.error && <Alert tone="danger" title="Your report was not sent">{send.error.message} Nothing was sent, and your text is kept.</Alert>}
          <div className="gv-foot">
            <Button variant="secondary" isDisabled={step === 0 || action.isPending || send.isPending} onPress={() => { setError(''); go(step - 1) }}>Back</Button>
            {step < 3 ? <Button onPress={() => { if (validate(step)) go(step + 1) }}>Next</Button> : <Button loading={send.isPending} onPress={review}>Review consent and submit</Button>}
          </div>
        </div>
        <ConsentDialog key={consentOpen ? 'open' : 'closed'} isOpen={consentOpen} onOpenChange={setConsentOpen} sharing={draft} adviser={adviser} wording={readWording(page.data.consentWording)} pending={send.isPending} onConfirm={submit} />
        <DraftHelp key={helpOpen ? 'open' : 'closed'} narrative={draft.narrative} isOpen={helpOpen} onOpenChange={setHelpOpen} onUse={(value) => update('narrative', value)} />
        <Modal role="alertdialog" title="Discard this draft?" isOpen={discardOpen} onOpenChange={setDiscardOpen}>
          <ModalBody><p>The description and choices in this draft will be cleared.</p></ModalBody>
          <ModalActions><Button variant="secondary" onPress={() => setDiscardOpen(false)}>Keep draft</Button><Button variant="destructive" onPress={() => { setDraft({ ...blankDraft }); setStep(0); setError(''); setDiscardOpen(false); action.mutate({ action: 'saveDraft', payload: { narrative: '' } }); try { localStorage.removeItem(storageKey) } catch { /* No stored draft to remove. */ } }}>Discard draft</Button></ModalActions>
        </Modal>
      </div>
    </MotionConfig>
  )
}

/** Message or note list. New entries slide in. `mine` marks the reader's own messages. */
function Thread({ entries, label, internal = false, mine }: { entries: Item[]; label: string; internal?: boolean; mine?: (entry: Item) => boolean }) {
  return (
    <ol className="gv-thread" aria-label={label}>
      <AnimatePresence initial={false}>
        {entries.map((entry) => {
          const name = words(object(entry.author).name, 'Handling office')
          const own = mine?.(entry) === true
          return (
            <motion.li key={words(entry.id)} layout="position" data-mine={own || undefined} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease }}>
              <span className="accs-avatar" aria-hidden>{initials(name)}</span>
              <div className="gv-thread__body">
                <p className="gv-thread__head"><strong>{own ? 'You' : name}</strong>{internal && <span className="accs-tag">Internal</span>}<time dateTime={words(entry.at)}>{formatDateTime(entry.at)}</time></p>
                <p className="gv-thread__text">{words(entry.body)}</p>
              </div>
            </motion.li>
          )
        })}
      </AnimatePresence>
    </ol>
  )
}

/** Two-way chat. It is on only when the student chose system chat; it checks for new messages every few seconds while the tab is visible. */
function Conversation({ report, pageId }: { report: Report; pageId: 'P20' | 'P22' }) {
  const [body, setBody] = useState('')
  const action = useAction(pageId)
  const me = useQuery(sessionQuery()).data?.user.id
  const mode = readTalk(report).mode
  const closed = isClosed(report)
  const chat = mode === 'chat'
  // Its own query, so a failed check shows a note here and does not replace the page.
  // ponytail: one request every 4 s for each open chat, as the plan rules out a push channel.
  const live = useQuery({ queryKey: ['page', pageId, report.id, 'chat'], queryFn: () => getPage(pageId, report.id), enabled: chat && !closed, refetchInterval: 4000, retry: false })
  const messages = items(object(live.data?.data.record).messages ?? report.messages)
  const log = useRef<HTMLDivElement>(null)
  const stick = useRef(true)
  // Show the newest message, unless the reader scrolled up to read earlier ones.
  useEffect(() => {
    const el = log.current
    if (el && stick.current) el.scrollTop = el.scrollHeight
  }, [messages.length, chat])
  // The student's own messages carry the alias, not their id, while they are anonymous to the office.
  const mine = (entry: Item) => { const author = object(entry.author); return (Boolean(me) && author.id === me) || (pageId === 'P20' && author.anonymous === true) }
  if (!chat) {
    const label = modeLabel(mode).toLowerCase()
    return (
      <Empty title={label ? 'Chat is off' : 'Chat is not on yet'}>
        {pageId === 'P20'
          ? label ? 'You chose ' + label + '. Messages are only used with system chat. You can change your choice under How we will talk.' : 'Choose system chat under How we will talk to write to the office here.'
          : label ? 'The student chose ' + label + '. Messages are only used with system chat.' : 'The student has not chosen how to talk yet.'}
      </Empty>
    )
  }
  return (
    <div className="gv-stack">
      <Note>{pageId === 'P20' ? report.identity === 'anonymous' ? 'You appear as ' + words(report.alias) + ' unless you share your name with this office.' : 'The handling office sees your verified name.' : 'The reporter sees messages you send here. Keep internal coordination in Notes.'}</Note>
      <div className="gv-chat" ref={log} role="log" aria-label="Chat messages" tabIndex={0} onScroll={(event) => { const el = event.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80 }}>
        {messages.length ? <Thread entries={messages} label="Report messages" mine={mine} /> : <Empty title="No messages yet">{pageId === 'P20' ? 'Messages you send here go to the office handling your report.' : 'Messages you send here go to the reporter.'}</Empty>}
      </div>
      {live.isError && <p className="gv-hint" role="status">Can't check for new messages right now. We'll keep trying.</p>}
      <ActionError error={action.error} />
      {closed ? <Alert tone="neutral" title="This conversation is closed">The report is resolved or closed.</Alert> : <form className="gv-stack" onSubmit={(event) => { event.preventDefault(); if (body.trim()) { stick.current = true; action.mutate({ action: 'sendReportMessage', recordId: report.id, payload: { body } }, { onSuccess: () => setBody('') }) } }}>
        <TextArea label={pageId === 'P20' ? 'Message to the handling office' : 'Message to the reporter'} value={body} onChange={setBody} isRequired maxLength={4000} showCount />
        <div><Button type="submit" loading={action.isPending} isDisabled={!body.trim()}>Send message</Button></div>
      </form>}
    </div>
  )
}

function ReportList({ page }: { page: PageEnvelope }) {
  const [view, setView] = useState('active')
  const all = items(page.data.reports)
  const closedCount = all.filter(isClosed).length
  const records = all.filter((report) => view === 'closed' ? isClosed(report) : !isClosed(report))
  return (
    <MotionConfig reducedMotion="user">
      <div className="gv-page">
        <PageHeader title="My reports" actions={<Button icon="plus" href="/reports/new">New report</Button>} />
        <div className="gv-page accs-stagger">
          <div className="gv-listbar">
            <PillGroup id="view" label="Report view" value={view} onChange={setView} options={[{ id: 'active', label: 'Active ' + (all.length - closedCount) }, { id: 'closed', label: 'Closed ' + closedCount }]} />
            <Note>Only you and the office handling each report can open it.</Note>
          </div>
          {records.length ? (
            <Panel flush>
              <PagedList items={records} noun="reports">
                {(records) => (
                <ul className="accs-rows">
                  {records.map((report) => {
                    const step = stageStep(report)
                    return (
                      <li key={words(report.id)}>
                        <a className="accs-row gv-row" href={reportPath(report)}>
                          <span className="accs-mono gv-row__ref" title={reportReference(report)}>{reportReference(report)}</span>
                          <span className="gv-row__main">
                            <span className="accs-row__title">{categoryText(report)}</span>
                            <span className="accs-row__sub">{words(report.office, '—')}</span>
                          </span>
                          <span className="gv-row__progress">
                            <span className="accs-progress" role="progressbar" aria-label={'Stage ' + step + ' of 6'} aria-valuemin={1} aria-valuemax={6} aria-valuenow={step}><span style={{ width: (step / 6) * 100 + '%' }} /></span>
                            <span className="gv-row__stage">Stage {step} of 6 · {stageLabel(report)}</span>
                          </span>
                          <StatusChip tone={toneFor(words(report.status, 'Submitted'))}>{words(report.status, 'Submitted')}</StatusChip>
                          <span className="gv-row__time">{relativeTime(report.updatedAt) || '—'}</span>
                          <span className="gv-row__go" aria-hidden><Icon name="caret-right" size={16} /></span>
                        </a>
                      </li>
                    )
                  })}
                </ul>
                )}
              </PagedList>
            </Panel>
          ) : <Panel><Empty title={view === 'closed' ? 'No closed reports' : 'No reports yet'} action={view === 'active' ? <Button href="/reports/new">New report</Button> : undefined}>You haven't filed a report. Start one when you want an office to look into something.</Empty></Panel>}
        </div>
      </div>
    </MotionConfig>
  )
}

/** Reference, category, status and confidentiality at the top of every case view. */
function CaseHeader({ report, crumbs, children }: { report: Report; crumbs: Array<{ label: string; href?: string }>; children?: React.ReactNode }) {
  return (
    <PageHeader
      crumbs={crumbs}
      title={categoryText(report)}
      description={<><span className="accs-mono">{reportReference(report)}</span>{report.caseFileId ? <> · from report <span className="accs-mono">{report.id}</span></> : null} · filed {formatDate(report.createdAt)}</>}
      actions={<div className="gv-chips">
        <StatusChip tone={toneFor(words(report.status, 'Submitted'))}>{words(report.status, 'Submitted')}</StatusChip>
        <SeverityChip report={report} />
        <span className="accs-tag gv-lock"><Icon name="lock" size={16} />Confidential</span>
        {children}
      </div>}
    />
  )
}

function Narrative({ report, title }: { report: Report; title: string }) {
  const text = words(report.narrative)
  return (
    <Panel title={title}>
      {text ? <p className="gv-narrative">{text}</p> : <p className="gv-hint">No description on file.</p>}
      {words(report.sourcePostId) && <p><Link href={'/feed/' + encodeURIComponent(words(report.sourcePostId))}>Linked discussion</Link></p>}
    </Panel>
  )
}

function ReportDetail({ page }: { page: PageEnvelope }) {
  const report = object(page.data.record) as Report
  const [discloseOpen, setDiscloseOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const assistant = useAction('P41')
  const talkAction = useAction('P20')
  if (!report.id) return <RestrictedView record />
  const disclosed = Array.isArray(report.disclosedTo) && report.disclosedTo.includes(report.stage)
  // TBD(D-03): use Report until Guidance opens a linked Case File.
  return (
    <MotionConfig reducedMotion="user">
      <div className="gv-page">
        <CaseHeader report={report} crumbs={[{ label: 'My reports', href: '/reports' }, { label: reportReference(report) }]} />
        <div className="accs-split">
          <div className="accs-stack accs-stagger">
            {words(report.narrative) && <Narrative report={report} title="What you reported" />}
            <TalkChoice report={report} wording={readWording(page.data.consentWording)} action={talkAction} />
            <Panel title="Messages"><Conversation report={report} pageId="P20" /></Panel>
            <Panel title="Progress"><Timeline report={report} /></Panel>
          </div>
          <aside className="accs-stack accs-stagger" aria-label="Report details">
            <Panel title="Details">
              <Facts values={[
                ['Stage', stageLabel(report) + (report.office ? ' · ' + report.office : '')], ['Category', categoryText(report)], ['Program', words(report.program, '—')],
                ['Filed', formatDate(report.createdAt)], ['Updated', relativeTime(report.updatedAt) || '—'],
                ['Identity', report.identity === 'anonymous' ? disclosed ? 'Name shared with this office' : 'Alias to this office' : 'Named'],
              ]} />
              <Note>You and the office handling it can open this. Internal notes stay with the office.</Note>
            </Panel>
            <AccessPanel access={readAccess(report)} viewer="student" />
            <Panel title="Your options">
              <div className="gv-actions">
                {report.identity === 'anonymous' && !disclosed && <Button variant="secondary" onPress={() => setDiscloseOpen(true)}>Share my name</Button>}
                <Button variant="tertiary" onPress={() => { setHelpOpen(true); assistant.mutate({ action: 'assistantAsk', payload: { question: 'Explain my report milestones for ' + report.id } }) }}>What does this stage mean?</Button>
                {words(report.sourcePostId) && <Link href={'/feed/' + encodeURIComponent(words(report.sourcePostId))}>Started from your discussion</Link>}
              </div>
            </Panel>
          </aside>
        </div>
        <DiscloseIdentityDialog report={report} isOpen={discloseOpen} onOpenChange={setDiscloseOpen} />
        <Drawer title="About this stage" isOpen={helpOpen} onOpenChange={setHelpOpen}><div className="gv-stack"><Alert tone="neutral" title="People decide the next steps">It explains the process using approved information.</Alert><ActionError error={assistant.error} />{assistant.isPending ? <ViewState kind="loading" title="Loading explanation" /> : <p className="ds-prose">{words(object(assistant.data?.record).reply)}</p>}<Link href="/assistant">Open assistant</Link></div></Drawer>
      </div>
    </MotionConfig>
  )
}

export function ConflictNotice() {
  return <Alert tone="warning" title="Routed to you because the assigned adviser may be involved">The system only suggests the routing. It is not a finding.</Alert>
}

export function CaseNotes({ report }: { report: Report }) {
  const [body, setBody] = useState('')
  const action = useAction('P22')
  const notes = items(report.notes)
  return (
    <Panel title="Internal notes">
      <Note>Internal notes never appear in the reporter's timeline.</Note>
      {notes.length ? <Thread entries={notes} label="Internal case notes" internal /> : <p className="gv-hint">No internal notes yet.</p>}
      <ActionError error={action.error} />
      <form className="gv-stack" onSubmit={(event) => { event.preventDefault(); if (body.trim()) action.mutate({ action: 'addNote', recordId: report.id, payload: { body } }, { onSuccess: () => setBody('') }) }}>
        <TextArea label="Add a note" value={body} onChange={setBody} isRequired maxLength={4000} showCount />
        <div><Button type="submit" loading={action.isPending} isDisabled={!body.trim() || isClosed(report)}>Save note</Button></div>
      </form>
    </Panel>
  )
}

const actionLabels: Record<string, string> = { respond: 'Respond', recordAction: 'Record action', escalate: 'Escalate', transfer: 'Transfer', resolve: 'Resolve', close: 'Close', convert: 'Open Case File', milestone: 'Add milestone' }
const nextOffices: Record<string, { stage: string; label: string }> = { adviser: { stage: 'chair', label: 'Program Chair' }, chair: { stage: 'dean', label: 'Dean' }, dean: { stage: 'guidance', label: 'Guidance Office' }, guidance: { stage: 'osas', label: 'OSAS' } }

export function CaseActionBar({ report }: { report: Report }) {
  const primary = report.stage === 'adviser' ? 'respond' : report.stage === 'guidance' && !report.caseFileId ? 'convert' : ['guidance', 'osas'].includes(report.stage) ? 'milestone' : 'recordAction'
  const allowedAll = (Array.isArray(report.allowedActions) ? report.allowedActions.map(String) : []).sort((a, b) => Number(b === primary) - Number(a === primary))
  const [selected, setSelected] = useState('')
  const [reason, setReason] = useState('')
  const [update, setUpdate] = useState('')
  const [error, setError] = useState('')
  const action = useAction('P22')
  // OSAS is the last office: it has no next office, and no case is returned to an earlier one.
  const allowed = allowedAll.filter((type) => type !== 'return' && !(report.stage === 'osas' && ['escalate', 'transfer'].includes(type)))
  const transition = ['escalate', 'transfer'].includes(selected)
  const next = nextOffices[report.stage]
  const label = (type: string) => type === 'recordAction' && ['chair', 'dean'].includes(report.stage) ? 'Record decision' : actionLabels[type] ?? type
  if (!allowed.length) return <Panel title="Next action"><p className="gv-hint">No actions available. You can only read this report at its current stage.</p></Panel>
  const open = (type: string) => { setSelected(type); setReason(''); setUpdate(''); setError(''); action.reset() }
  return (
    <Panel title="Next action">
      <div className="gv-actions">
        {allowed.slice(0, 2).map((type, index) => <Button key={type} variant={index ? 'secondary' : 'primary'} onPress={() => open(type)}>{label(type)}</Button>)}
        {allowed.length > 2 && <MenuButton label="More actions" onAction={(key) => open(String(key))}>{allowed.slice(2).map((type) => <MenuItem id={type} key={type}>{label(type)}</MenuItem>)}</MenuButton>}
      </div>
      <Modal title={(label(selected) || 'Record action') + '?'} role={['escalate', 'transfer', 'resolve', 'close', 'convert'].includes(selected) ? 'alertdialog' : 'dialog'} isOpen={Boolean(selected)} onOpenChange={(openState) => !openState && setSelected('')}>
        <ModalBody>
          <div className="gv-stack">
            {transition && next && <Select label="Next office" selectedKey={next.stage} onSelectionChange={() => undefined} isRequired><SelectOption id={next.stage}>{next.label}</SelectOption></Select>}
            <TextArea label="Reason" value={reason} onChange={setReason} isRequired maxLength={2000} showCount />
            <TextArea label="Update shown to the reporter" value={update} onChange={setUpdate} isRequired maxLength={4000} showCount />
            <Note>The reason stays in the handler history. The reporter sees the update you write above.</Note>
            {error && <Alert tone="danger" title="Missing information">{error}</Alert>}
            <ActionError error={action.error} />
          </div>
        </ModalBody>
        <ModalActions>
          <Button variant="secondary" isDisabled={action.isPending} onPress={() => setSelected('')}>Cancel</Button>
          <Button loading={action.isPending} onPress={() => {
            if (!reason.trim() || !update.trim()) { setError('Add a reason and an update for the reporter.'); return }
            action.mutate({ action: 'caseAction', recordId: report.id, reason, payload: { type: selected, update, ...(transition && next ? { nextStage: next.stage } : {}) } }, { onSuccess: () => setSelected('') })
          }}>{label(selected) || 'Save action'}</Button>
        </ModalActions>
      </Modal>
    </Panel>
  )
}

/** The facts a handler looks for first, in one place above the case: who and what, how the student wants to talk, and what is already agreed. */
function CaseGlance({ report }: { report: Report }) {
  const talk = readTalk(report)
  const access = readAccess(report)
  const meeting = talk.mode === 'chat' ? 'Not needed for chat' : talk.scheduledAt ? formatDateTime(talk.scheduledAt) : talk.mode ? 'Not added yet' : '—'
  return (
    <Panel title="Case at a glance">
      <Facts values={[
        ['Reference', <span className="accs-mono" key="ref">{reportReference(report)}</span>],
        ['Status', <StatusChip key="status" tone={toneFor(words(report.status, 'Submitted'))}>{words(report.status, 'Submitted')}</StatusChip>],
        ['Severity', <SeverityChip key="severity" report={report} />],
        ['Assigned to', stageLabel(report) + (report.office ? ' · ' + report.office : '')],
        ['Consent', access.consentAt ? 'Given ' + formatDateTime(access.consentAt) : 'Not recorded'],
        ['Also readable by', alsoReadableBy(access)],
        ['How the student wants to talk', modeLabel(talk.mode) || 'Not chosen yet'],
        ['Meeting time', meeting],
      ]} />
    </Panel>
  )
}

function CaseWorkspace({ page }: { page: PageEnvelope }) {
  const report = object(page.data.record) as Report
  const talkAction = useAction('P22')
  if (!report.id) return <RestrictedView record />
  const crumbs = [{ label: 'Cases', href: '/cases' }, { label: reportReference(report) }]
  // TBD(D-04) / TBD(D-08): previous handlers retain only the API's own-entry summary.
  if (report.historyOnly) {
    return (
      <MotionConfig reducedMotion="user">
        <div className="gv-page">
          <PageHeader crumbs={crumbs} title="Handled by me" description={<span className="accs-mono">{reportReference(report)}</span>} />
          <div className="gv-page accs-stagger">
            <Alert tone="neutral" title="Earlier handling history">{words(report.historyNotice)}</Alert>
            <Panel title="History"><Timeline report={report} handler /></Panel>
          </div>
        </div>
      </MotionConfig>
    )
  }
  return (
    <MotionConfig reducedMotion="user">
      <div className="gv-page">
        <CaseHeader report={report} crumbs={crumbs} />
        {report.bypassed === true && <ConflictNotice />}
        <div className="accs-split">
          <div className="accs-stack accs-stagger">
            <CaseGlance report={report} />
            <Narrative report={report} title="Student's statement" />
            <HandlerTalk report={report} action={talkAction} />
            <Panel title="Messages"><Conversation report={report} pageId="P22" /></Panel>
            <Panel title="History"><Timeline report={report} handler /></Panel>
          </div>
          <aside className="accs-stack accs-stagger" aria-label="Case details">
            <CaseActionBar report={report} />
            <Panel title="Details">
              <Facts values={[
                ['Stage', stageLabel(report) + (report.office ? ' · ' + report.office : '')], ['Category', categoryText(report, '—')], ['Program', words(report.program, '—')],
                ['Filed', formatDate(report.createdAt)], ['Updated', relativeTime(report.updatedAt) || '—'],
                ['Reporter', words(object(report.reporter).name, words(report.alias, '—'))],
                ['Identity', report.identity === 'anonymous' ? 'Alias unless disclosed to this office' : 'Named'],
              ]} />
              <Note>Only authorized handlers can open this record. We record every action.</Note>
            </Panel>
            <AccessPanel access={readAccess(report)} viewer="handler" />
            <CaseNotes report={report} />
          </aside>
        </div>
      </div>
    </MotionConfig>
  )
}

const sortColumns: Array<[string, string]> = [['id', 'Reference'], ['category', 'Case'], ['student', 'Student'], ['severity', 'Severity'], ['createdAt', 'Submitted'], ['updatedAt', 'Updated']]

function CaseQueue({ page }: { page: PageEnvelope }) {
  const session = useQuery(sessionQuery())
  const roles = session.data?.user.roles ?? []
  const role = ['chair', 'dean', 'guidance', 'osas', 'professor'].find((candidate) => roles.some((value) => value === candidate)) ?? 'professor'
  const initial = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search)
  const [query, setQuery] = useState(initial.get('q') ?? '')
  const [level, setLevel] = useState(initial.get('severity') ?? '')
  const [category, setCategory] = useState(initial.get('category') ?? '')
  const [status, setStatus] = useState(initial.get('status') ?? '')
  const [stage, setStage] = useState(initial.get('stage') ?? '')
  const [received, setReceived] = useState('term')
  const [tab, setTab] = useState(initial.get('tab') ?? 'open')
  const [currentPage, setCurrentPage] = useState(1)
  const [sort, setSort] = useState<SortDescriptor>({ column: 'updatedAt', direction: 'descending' })
  const records = items(page.data.cases)
  const tabDefs = role === 'chair' ? [['bypassed', 'Bypassed'], ['open', 'Escalated to me'], ...(roles.includes('professor') ? [['teaching', 'Teaching assignments']] : []), ['history', 'Handled by me']]
    : role === 'dean' ? [['open', 'At Dean stage'], ['history', 'Transferred'], ['closed', 'Closed']]
      : role === 'guidance' ? [['intake', 'Intake'], ['open', 'Active Case Files'], ['history', 'Transferred to OSAS'], ['closed', 'Closed']]
        : role === 'osas' ? [['open', 'New transfers'], ['active', 'Active'], ['history', 'Transferred'], ['closed', 'Closed']]
          : [['open', 'Open'], ['waiting', 'Waiting on reporter'], ['closed', 'Closed']]
  const validTab = tabDefs.some(([id]) => id === tab) ? tab : tabDefs[0][0]
  const sortValue = (report: Item) => sort.column === 'id' ? reportReference(report) : sort.column === 'student' ? studentName(report) : words(report[String(sort.column)])
  const inTab = (report: Item, selected: string) => selected === 'closed' ? isClosed(report)
    : selected === 'history' ? report.historyOnly === true
      : selected === 'bypassed' ? report.bypassed === true && !report.historyOnly && !isClosed(report)
        : selected === 'teaching' ? report.stage === 'adviser' && !report.historyOnly && !isClosed(report)
        : selected === 'waiting' ? words(report.status).toLowerCase().includes('waiting')
          : selected === 'intake' ? report.stage === 'guidance' && !report.caseFileId && !report.historyOnly && !isClosed(report)
            : selected === 'active' ? !report.historyOnly && !isClosed(report) && items(report.history).length > 1
              : !report.historyOnly && !isClosed(report) && (role !== 'chair' || !report.bypassed && report.stage === 'chair') && (role !== 'guidance' || Boolean(report.caseFileId))
  const inQueue = records.filter((report) => inTab(report, validTab))
  const filtered = inQueue.filter((report) => (!stage || stageOf(report) === stage) && (!query || words(report.id).toLowerCase().includes(query.toLowerCase())) && (!level || report.severity === level) && (!category || report.category === category) && (!status || report.status === status) && (received === 'term' || new Date(words(report.createdAt)).getTime() >= Date.now() - Number(received) * 86400000))
    .sort((a, b) => (sort.column === 'waiting' ? waitingDays(a) - waitingDays(b) : sortValue(a).localeCompare(sortValue(b))) * (sort.direction === 'descending' ? -1 : 1))
  const pageCount = Math.max(1, Math.ceil(filtered.length / 8))
  const shown = filtered.slice((Math.min(currentPage, pageCount) - 1) * 8, Math.min(currentPage, pageCount) * 8)
  const reset = (change: () => void) => { change(); setCurrentPage(1) }
  const title = role === 'chair' ? 'Program reports · ' + (session.data?.user.program ?? '') : role === 'dean' ? 'Escalated reports' : role === 'guidance' ? 'Case Files' : role === 'osas' ? 'OSAS cases' : 'Assigned reports'
  const toggleSort = (column: string) => setSort((current) => ({ column, direction: current.column === column && current.direction === 'ascending' ? 'descending' : 'ascending' }))
  return (
    <MotionConfig reducedMotion="user">
      <div className="gv-page">
        <PageHeader title={title} description={page.scope} actions={<Note>You see only reports routed to you. Every action is recorded.</Note>} />
        <div className="gv-page accs-stagger">
          <QueueTabs validTab={validTab} onChange={(key) => reset(() => setTab(key))} defs={tabDefs} records={records} inTab={inTab} />
          <div className="accs-toolbar gv-toolbar">
            <div className="accs-grow"><Search label="Search by reference" placeholder="RPT-0241" size="sm" value={query} onChange={(value) => reset(() => setQuery(value))} /></div>
            <PillGroup id="severity" label="Severity" value={level} onChange={(value) => reset(() => setLevel(value))} options={[{ id: '', label: 'All' }, { id: 'low', label: 'Low' }, { id: 'medium', label: 'Medium' }, { id: 'high', label: 'High' }]} />
            <Select label="Category" selectedKey={category} onSelectionChange={(key) => reset(() => setCategory(String(key ?? '')))}><SelectOption id="">All categories</SelectOption>{[...new Set(records.map((report) => words(report.category)))].filter(Boolean).map((value) => <SelectOption id={value} key={value}>{value}</SelectOption>)}</Select>
            <Select label="Status" selectedKey={status} onSelectionChange={(key) => reset(() => setStatus(String(key ?? '')))}><SelectOption id="">All statuses</SelectOption>{[...new Set(records.map((report) => words(report.status)))].filter(Boolean).map((value) => <SelectOption id={value} key={value}>{value}</SelectOption>)}</Select>
            <Select label="Stage" selectedKey={stage} onSelectionChange={(key) => reset(() => setStage(String(key ?? '')))}><SelectOption id="">All stages</SelectOption>{stages.map(([key, name]) => <SelectOption id={key} key={key}>{name + ' (' + inQueue.filter((report) => stageOf(report) === key).length + ')'}</SelectOption>)}</Select>
            <Select label="Received" selectedKey={received} onSelectionChange={(key) => reset(() => setReceived(String(key)))}><SelectOption id="7">Last 7 days</SelectOption><SelectOption id="30">Last 30 days</SelectOption><SelectOption id="term">This term</SelectOption></Select>
            <div className="gv-sortbar">
              <Select label="Sort by" selectedKey={String(sort.column)} onSelectionChange={(key) => setSort((current) => ({ ...current, column: String(key) }))}>
                <SelectOption id="id">Reference</SelectOption>
                <SelectOption id="category">Category</SelectOption>
                <SelectOption id="student">Student</SelectOption>
                <SelectOption id="severity">Severity</SelectOption>
                <SelectOption id="status">Status</SelectOption>
                <SelectOption id="createdAt">Submitted</SelectOption>
                <SelectOption id="updatedAt">Last action</SelectOption>
                <SelectOption id="waiting">Waiting (days)</SelectOption>
              </Select>
              <Select label="Sort direction" selectedKey={sort.direction} onSelectionChange={(key) => setSort((current) => ({ ...current, direction: String(key) as SortDescriptor['direction'] }))}>
                <SelectOption id="ascending">Ascending</SelectOption>
                <SelectOption id="descending">Descending</SelectOption>
              </Select>
            </div>
          </div>
          {filtered.length ? <>
            <div className="accs-table-wrap">
              <table className="accs-table gv-table" aria-label="Reports in this queue">
                <thead>
                  <tr>
                    {sortColumns.map(([id, name]) => (
                      <th key={id} aria-sort={sort.column === id ? sort.direction : 'none'} className={id === 'category' ? 'gv-c-title' : undefined}>
                        <button type="button" className="gv-sort" onClick={() => toggleSort(id)}>{name}{sort.column === id && <span aria-hidden>{sort.direction === 'ascending' ? '↑' : '↓'}</span>}</button>
                      </th>
                    ))}
                    <th>Program</th>
                    <th>Stage</th>
                    <th>Talk mode</th>
                    <th><span className="gv-visually-hidden">Open</span></th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((report) => {
                    const talk = modeLabel(readTalk(report).mode)
                    return (
                      <tr key={words(report.id)}>
                        <td className="gv-c-ref"><a className="accs-mono gv-ref-link" href={casePath(report)} title={reportReference(report)}>{reportReference(report)}</a></td>
                        <td className="gv-c-title">
                          <span className="gv-title">{categoryText(report)}</span>
                          {report.bypassed === true && <span className="accs-tag gv-bypass">Adviser bypassed</span>}
                        </td>
                        <td className="gv-c-student" data-label="Student">{studentName(report)}</td>
                        <td><SeverityChip report={report} /></td>
                        <td className="gv-c-time" data-label="Submitted"><span title={formatDateTime(report.createdAt)}>{relativeTime(report.createdAt) || '—'}</span></td>
                        <td className="gv-c-time" data-label="Updated"><span title={formatDateTime(report.updatedAt)}>{relativeTime(report.updatedAt) || '—'}</span></td>
                        <td>{words(report.program) ? <span className="accs-tag">{words(report.program)}</span> : '—'}</td>
                        <td className="gv-c-stage"><span className="gv-stage">{stageLabel(report)}</span><span className="gv-stage-sub">{words(report.status)}</span></td>
                        <td className="gv-c-talk" data-label="Talk">{talk ? <span className="accs-tag">{talk}</span> : <span className="gv-muted">Not chosen</span>}</td>
                        <td className="gv-c-go"><a className="gv-open" href={casePath(report)} aria-label={'Open ' + reportReference(report)}>Open<Icon name="caret-right" size={16} /></a></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={Math.min(currentPage, pageCount)} pageCount={pageCount} onPageChange={setCurrentPage} summary={'Showing ' + shown.length + ' of ' + filtered.length + ' reports'} />
          </> : <Panel>{query || level || category || status || stage
            ? <Empty title="No reports match these filters">Clear a filter to see more of your reports.</Empty>
            : <Empty title="No reports in this queue">Nothing is routed to you right now.</Empty>}</Panel>}
        </div>
      </div>
    </MotionConfig>
  )
}

/** Queue tabs with counts and a sliding current marker. */
function QueueTabs({ validTab, onChange, defs, records, inTab }: { validTab: string; onChange: (key: string) => void; defs: string[][]; records: Item[]; inTab: (report: Item, selected: string) => boolean }) {
  return (
    <LayoutGroup id="gv-tabs">
      <nav className="gv-tabs" aria-label="Case queues">
        {defs.map(([id, label]) => (
          <button key={id} type="button" className="gv-tab" aria-current={validTab === id ? 'page' : undefined} onClick={() => onChange(id)}>
            <span>{label}</span>
            <span className="gv-tab__count accs-mono">{records.filter((report) => inTab(report, id)).length}</span>
            {validTab === id && <motion.span layoutId="gv-tab-ind" className="gv-tab__ind" transition={spring} />}
          </button>
        ))}
      </nav>
    </LayoutGroup>
  )
}

export function GrievancePage({ page }: { page: PageEnvelope }) {
  if (page.pageId === 'P18') return <ReportList page={page} />
  if (page.pageId === 'P19') return <ReportWizard page={page} />
  if (page.pageId === 'P20') return <ReportDetail page={page} />
  if (page.pageId === 'P21') return <CaseQueue page={page} />
  return <CaseWorkspace page={page} />
}
