import { campusToday } from '@/lib/campus-date'
import {
  Alert, Button, Checkbox, DatePicker, Drawer, Grid, Icon, Link, MenuButton, MenuItem, Modal,
  ModalActions, ModalBody, PrivacyNotice, Radio, RadioGroup, Search, Select,
  SelectOption, TextArea, TextField, ViewState, toast,
  type SortDescriptor,
} from '@meetingat10/design-system/react'
import { ShieldIcon } from '@meetingat10/design-system/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, LayoutGroup, MotionConfig, motion, type Variants } from 'motion/react'
import { useRouter } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'

import { getPage, performPageAction, type PageAction, type PageEnvelope } from '@/lib/api'
import { sessionQuery } from '@/lib/queries'
import { formatDate, formatDateTime, initials, relativeTime } from '@/lib/format'
import { RestrictedView } from '@/components/app/guards'
import { AccessPanel, ConsentDialog, HandlerTalk, ReadersChoice, TalkChoice, alsoReadableBy, modeLabel, readAccess, readTalk, readWording } from '@/components/app/concern-talk'
import { categoryDetailMax, categoryText, choicePayload, choiceProblems, cleanChoice, readCategoryOptions } from '@/lib/concern-categories'
import { tidyDraft } from '@/lib/draft-tidy'
import { progressOf } from '@/lib/report-progress'
import { Empty, PageHeader, Panel, StatusChip, toneFor } from '@/components/app/page-shell'
import { StageChip, caseStages } from '@/components/app/stage-chip'
import { PagedList } from '@/components/app/paging'
import { CaseStrikes } from '@/components/app/strikes'
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
const studentName = (report: Item) => report.source === 'faculty' && words(object(report.reportedStudent).name)
  ? words(object(report.reportedStudent).name)
  : words(object(report.reporter).name, words(report.alias, '—'))
const isFacultyReport = (report: Item) => report.source === 'faculty'
const severity = (report: Item): SeverityLevel => ['low', 'medium', 'high'].includes(words(report.severity)) ? report.severity as SeverityLevel : 'medium'
const waitingDays = (report: Item) => Math.max(0, Math.floor((Date.now() - new Date(words(report.updatedAt, words(report.createdAt))).getTime()) / 86400000)) || 0
const reportPath = (report: Item) => '/reports/' + encodeURIComponent(words(report.id))
const casePath = (report: Item) => '/cases/' + encodeURIComponent(words(report.id))

// Pipeline: the five handling stages (Adviser to OSAS, which is the last) plus Submitted and Resolved.
const stages = [['submitted', 'Submitted'], ['adviser', 'Adviser'], ['chair', 'Chair'], ['dean', 'Dean'], ['guidance', 'Guidance'], ['osas', 'OSAS'], ['resolved', 'Resolved']] as const
// The stage is always the office handling it: the status is now a step ("Submitted"), which must not turn the Adviser's
// stage into "Submitted" (20 November 2026).
const stageOf = (report: Item): string => isClosed(report) ? 'resolved' : words(report.stage, 'adviser')
const stageIndex = (report: Item) => Math.max(0, stages.findIndex(([key]) => key === stageOf(report)))
const stageLabel = (report: Item) => stages[stageIndex(report)][1]

/**
 * The student's progress (decided 19 November 2026): Submitted, Read, Escalated, Resolved, Closed, five equal steps,
 * from the API's `progress`. It replaced "Stage 2 of 6 · Adviser", which said which office had it, in uneven steps.
 */
function ProgressSteps({ report, showLabels = false }: { report: Item; showLabels?: boolean }) {
  const { steps, step, label } = progressOf(report)
  return (
    <span className="gv-steps-wrap">
      <span className="gv-steps" role="img" aria-label={`Step ${step + 1} of ${steps.length}: ${label}`}>
        {steps.map((name, index) => <span key={name} className="gv-steps__seg" data-done={index <= step || undefined} />)}
      </span>
      {showLabels
        ? <span className="gv-steps__names" aria-hidden>{steps.map((name, index) => <span key={name} data-current={index === step || undefined}>{name}</span>)}</span>
        : <span className="gv-row__stage">Step {step + 1} of {steps.length} · {label}</span>}
    </span>
  )
}

function useAction(pageId: string, leaveTo?: string) {
  const queryClient = useQueryClient()
  const router = useRouter()
  return useMutation({
    mutationFn: (action: PageAction) => performPageAction(pageId, action),
    onSuccess: async (result) => {
      // The case may have left this person's scope: go to the queue first, never refetch the page they can no longer open.
      if (leaveTo) await router.navigate({ href: leaveTo })
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

/** Severity as a tinted pill ("High severity"), or as a colored dot and word in the queue table. Always text, never color alone. */
function SeverityChip({ report, dot = false }: { report: Item; dot?: boolean }) {
  const level = severity(report)
  return <span className={dot ? 'gv-sev gv-sev--dot' : 'gv-sev'} data-level={level}>{cap(level)}{dot ? '' : ' severity'}</span>
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

const actorRoles: Record<string, string> = { professor: 'Adviser', adviser: 'Adviser', chair: 'Program Chair', dean: 'Dean', guidance: 'Guidance', osas: 'OSAS', system: 'System' }

function Timeline({ report, handler = false }: { report: Item; handler?: boolean }) {
  const me = useQuery(sessionQuery()).data?.user.id
  const history = items(report.history)
  if (!history.length) return <Empty title="No updates yet">Updates from the responsible office show here.</Empty>
  // Handlers read the history as activity: who did what, when, and the reason and update they wrote. The reporter is never
  // named here, only "Verified reporter".
  if (handler) {
    return (
      <ol className="gv-activity" aria-label="Case history">
        {history.map((entry, index) => {
          const student = entry.actorRole === 'student'
          const person = words(object(entry.actor).name)
          const name = student ? 'Verified reporter' : me && entry.actorId === me ? 'You' : person || words(entry.office, 'Handling office')
          const role = student ? '' : words(entry.actorRole)
          const body = [words(entry.reason), words(entry.update)].filter(Boolean).join(' · ')
          return (
            <motion.li key={words(entry.id, String(index))} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease, delay: 0.05 + index * 0.05 }}>
              <span className="accs-avatar gv-activity__avatar" data-quiet={student || !person || undefined} aria-hidden>{student ? 'R' : initials(person || name)}</span>
              <div className="gv-activity__body">
                <p className="gv-activity__head">
                  <strong>{words(entry.action, 'Update recorded')}</strong>
                  {entry.public === true && <span className="accs-tag">Shown to reporter</span>}
                </p>
                {body && <p className="gv-activity__text">{body}</p>}
                <p className="gv-activity__meta">
                  <span>{name}</span>
                  {role && <span className="gv-cap">{actorRoles[role] ?? role}</span>}
                  <time dateTime={words(entry.at)}>{formatDateTime(entry.at)}</time>
                </p>
              </div>
            </motion.li>
          )
        })}
      </ol>
    )
  }
  const hasCurrent = history.some((entry) => entry.state === 'current')
  return (
    <ol className="accs-timeline gv-timeline" aria-label="Report progress">
      {history.map((entry, index) => {
        const actor = words(entry.office)
        const body = words(entry.update)
        const current = entry.state === 'current' || (!hasCurrent && index === history.length - 1)
        return (
          <motion.li key={words(entry.id, String(index))} data-current={current || undefined} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.45, ease, delay: 0.1 + index * 0.07 }}>
            <p className="gv-ev__head">
              <strong>{words(entry.action, 'Update recorded')}</strong>
              {actor && <span className="accs-tag gv-cap">{actor}</span>}
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

function DraftHelp({ draft, isOpen, onOpenChange, onUse }: { draft: Draft; isOpen: boolean; onOpenChange: (open: boolean) => void; onUse: (text: string) => void }) {
  // Opens already rewritten when the student has typed something; the writing guide is only for an empty draft.
  const [first] = useState(() => tidyDraft({ narrative: draft.narrative, occurredOn: draft.ongoing ? '' : draft.occurredOn, ongoing: draft.ongoing, location: draft.location, category: draft.category }))
  const [candidate, setCandidate] = useState(first.text || draft.narrative)
  const [missing, setMissing] = useState<string[] | null>(first.text ? first.missing : null)
  const action = useAction('P19')
  const reply = words(object(action.data?.record).reply)
  // Rewrites the student's own words in the browser: nothing is sent, nothing is invented (lib/draft-tidy.ts).
  const tidy = () => {
    const result = tidyDraft({ narrative: candidate, occurredOn: draft.ongoing ? '' : draft.occurredOn, ongoing: draft.ongoing, location: draft.location, category: draft.category })
    if (result.text) setCandidate(result.text)
    setMissing(result.missing)
  }
  return (
    <Drawer title="Help with your draft" isOpen={isOpen} onOpenChange={onOpenChange}>
      <div className="gv-stack">
        <Alert tone="neutral" title="The assistant helps you write">It tidies your own words and lays them out for the office. It doesn't decide what happened or add anything you didn't write.</Alert>
        <TextArea label="Your draft" value={candidate} onChange={(value) => { setCandidate(value); setMissing(null) }} maxLength={4000} showCount description="Edit it here, then use it in your report." />
        <div className="gv-actions">
          <Button variant="secondary" icon="pencil" isDisabled={!candidate.trim() || missing !== null} onPress={tidy}>Tidy up my draft</Button>
          <Button variant="tertiary" loading={action.isPending} onPress={() => action.mutate({ action: 'assistantAsk', payload: { question: 'Help me write and organize my report draft.' } })}>Writing tips</Button>
        </div>
        {missing && (missing.length
          ? <Alert tone="info" title="You could also add">
              <ul className="gv-missing">{missing.map((item) => <li key={item}>{item}</li>)}</ul>
            </Alert>
          : <Alert tone="success" title="Your draft covers what the office needs" />)}
        <ActionError error={action.error} />
        {reply && <p className="ds-prose">{reply}</p>}
        <Button onPress={() => { onUse(candidate); onOpenChange(false) }}>Use this text</Button>
      </div>
    </Drawer>
  )
}

// The consent is never kept in a draft. Drafts from before #31 may still carry allowChair / allowDean; they are ignored.
type Draft = { narrative: string; category: string; subcategory: string; categoryDetail: string; severity: SeverityLevel | ''; identity: Identity; location: string; occurredOn: string; ongoing: boolean; aboutAdvisor: boolean }
const blankDraft: Draft = { narrative: '', category: '', subcategory: '', categoryDetail: '', severity: '', identity: 'named', location: '', occurredOn: '', ongoing: false, aboutAdvisor: false }

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
  // The draft is also written under the signed-in key while the session loads, so both keys go on submit and discard.
  const clearStored = () => { try { localStorage.removeItem(storageKey); localStorage.removeItem('accs-report-draft-signed-in') } catch { /* No stored draft to remove. */ } }
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
      location: words(saved.location), occurredOn: words(saved.occurredOn), ongoing: saved.ongoing === true,
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
  const [fromReview, setFromReview] = useState(false)
  const go = (next: number) => { setDir(next > step ? 1 : -1); setStep(next); send.reset(); if (next === 3) setFromReview(false) }
  const edit = (to: number) => { setFromReview(true); go(to) }

  useEffect(() => {
    if (submitted) return
    try { localStorage.setItem(storageKey, JSON.stringify(draft)) } catch { /* The form state still retains the draft. */ }
  }, [draft, storageKey, submitted])

  const validate = (current: number) => {
    const message = current === 0 && !draft.narrative.trim() ? 'Describe what happened before continuing.'
      : current === 0 && !draft.occurredOn && !draft.ongoing ? 'Choose when it happened, or tick Ongoing.'
      : current === 1 && (Object.keys(missing).length > 0 || !draft.severity) ? 'Choose a category (describe it for Other) and how serious it is.' : ''
    setError(message)
    return !message
  }
  const saveDraft = () => action.mutate({ action: 'saveDraft', payload: { narrative: draft.narrative, ...(draft.category ? { category: draft.category } : {}), ...(draft.subcategory ? { subcategory: draft.subcategory } : {}), ...(draft.categoryDetail.trim() ? { categoryDetail: draft.categoryDetail.trim() } : {}), ...(draft.severity ? { severity: draft.severity } : {}), identity: draft.identity } })
  // Submit opens the consent form. Nothing is sent until the student agrees there.
  const review = () => {
    if (!draft.narrative.trim() || (!draft.occurredOn && !draft.ongoing) || Object.keys(missing).length > 0 || !draft.severity) {
      setError('Add a description, a date or Ongoing, a category, and how serious it is before you submit.')
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
      ...(draft.ongoing ? { ongoing: true } : draft.occurredOn ? { occurredOn: draft.occurredOn } : {}),
      ...(source.id ? { sourcePostId: words(source.id) } : {}),
    },
  }, {
    onSuccess: (result) => { setSubmitted(object(result.record)); clearStored() },
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
                    <div>
                      <DatePicker label="When" isRequired={!draft.ongoing} isDisabled={draft.ongoing} maxValue={campusToday()} onChange={(value) => update('occurredOn', value?.toString() ?? '')} description={draft.occurredOn ? 'Saved date: ' + formatDate(draft.occurredOn) : 'Choose a date, or tick Ongoing'} isInvalid={Boolean(error && !draft.occurredOn && !draft.ongoing)} />
                      <Checkbox isSelected={draft.ongoing} onChange={(on) => update('ongoing', on)}>Ongoing / happens repeatedly</Checkbox>
                    </div>
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
                      : <Select key={draft.category || 'none'} label="Sub-category (optional)" selectedKey={draft.subcategory || null} onSelectionChange={(key) => update('subcategory', String(key ?? ''))}
                        isDisabled={!option} description={option ? 'Pick the one closest to what happened.' : 'Choose a category first.'} isInvalid={Boolean(fieldError('subcategory'))} errorMessage={fieldError('subcategory')}>
                        {(option?.subcategories ?? []).map((sub) => <SelectOption id={sub} key={sub}>{sub}</SelectOption>)}
                      </Select>}
                  </Grid>
                  <RadioGroup label="How serious is it?" value={draft.severity} onChange={(value) => update('severity', value as SeverityLevel)} isRequired>
                    <Radio value="low" card description="Limited impact right now."><span className="gv-sev gv-sev--dot" data-level="low">Low</span></Radio>
                    <Radio value="medium" card description="Affects ongoing activities or support."><span className="gv-sev gv-sev--dot" data-level="medium">Medium</span></Radio>
                    <Radio value="high" card description="Needs prompt review by a person."><span className="gv-sev gv-sev--dot" data-level="high">High</span></Radio>
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
                    ['When', draft.ongoing ? 'Ongoing' : draft.occurredOn ? formatDate(draft.occurredOn) : 'Not specified'], ['Where', draft.location || 'Not specified'],
                    ['Linked discussion', words(source.title, 'None')],
                  ]} />
                  <section className="gv-narrative"><h2 className="gv-sub">Your description</h2><p>{draft.narrative}</p></section>
                  <ReadersChoice sharing={draft} adviser={adviser} />
                  <div className="gv-edit-links"><Button variant="secondary" size="sm" onPress={() => edit(0)}>Edit description</Button><Button variant="secondary" size="sm" onPress={() => edit(1)}>Edit details</Button><Button variant="secondary" size="sm" onPress={() => edit(2)}>Edit privacy choice</Button></div>
                  <Note>Your report stays linked to your verified account. The responsible office reviews it and decides the next steps.</Note>
                </>}
              </motion.div>
            </AnimatePresence>
          </Panel>
          {send.error && <Alert tone="danger" title="Your report was not sent">{send.error.message} Nothing was sent, and your text is kept.</Alert>}
          <div className="gv-foot">
            <Button variant="secondary" isDisabled={step === 0 || action.isPending || send.isPending} onPress={() => { setError(''); go(step - 1) }}>Back</Button>
            {step < 3 ? <Button onPress={() => { if (validate(step)) go(fromReview ? 3 : step + 1) }}>{fromReview ? 'Back to review' : 'Next'}</Button> : <Button loading={send.isPending} onPress={review}>Review consent and submit</Button>}
          </div>
        </div>
        {/* Each dialog's key names it: both used "open"/"closed", so two closed dialogs shared the key "closed". */}
        <ConsentDialog key={consentOpen ? 'consent-open' : 'consent-closed'} isOpen={consentOpen} onOpenChange={setConsentOpen} sharing={draft} adviser={adviser} wording={readWording(page.data.consentWording)} pending={send.isPending} onConfirm={submit} />
        <DraftHelp key={helpOpen ? 'help-open' : 'help-closed'} draft={draft} isOpen={helpOpen} onOpenChange={setHelpOpen} onUse={(value) => update('narrative', value)} />
        <Modal role="alertdialog" title="Discard this draft?" isOpen={discardOpen} onOpenChange={setDiscardOpen}>
          <ModalBody><p>The description and choices in this draft will be cleared.</p></ModalBody>
          <ModalActions><Button variant="secondary" onPress={() => setDiscardOpen(false)}>Keep draft</Button><Button variant="destructive" onPress={() => { setDraft({ ...blankDraft }); setStep(0); setError(''); setDiscardOpen(false); action.mutate({ action: 'saveDraft', payload: { narrative: '' } }); clearStored() }}>Discard draft</Button></ModalActions>
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
function Conversation({ report, pageId, readOnly = false }: { report: Report; pageId: 'P20' | 'P22'; readOnly?: boolean }) {
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
      {closed ? <Alert tone="neutral" title="This conversation is closed">The report is resolved or closed.</Alert> : readOnly ? <p className="gv-hint">Only the office handling this concern writes here.</p> : <form className="gv-stack" onSubmit={(event) => { event.preventDefault(); if (body.trim()) { stick.current = true; action.mutate({ action: 'sendReportMessage', recordId: report.id, payload: { body } }, { onSuccess: () => setBody('') }) } }}>
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
            <Note>Only you and the office handling each report can open it. Reporting under your name or anonymously is your choice on each report.</Note>
          </div>
          {records.length ? (
            <Panel flush>
              <PagedList items={records} noun="reports">
                {(records) => (
                <ul className="accs-rows gv-rows">
                  {records.map((report) => {
                    return (
                      <li key={words(report.id)}>
                        <a className="accs-row gv-row" href={reportPath(report)}>
                          <span className="accs-mono gv-row__ref" title={reportReference(report)}>{reportReference(report)}</span>
                          <span className="gv-row__main">
                            <span className="accs-row__title">{categoryText(report)}</span>
                            <span className="accs-row__sub">With: {words(report.office, '—')}</span>
                          </span>
                          <span className="gv-row__progress"><ProgressSteps report={report} /></span>
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
function CaseHeader({ report, crumbs, actions }: { report: Report; crumbs: Array<{ label: string; href?: string }>; actions?: React.ReactNode }) {
  return (
    <PageHeader
      crumbs={crumbs}
      title={categoryText(report)}
      description={<>
        <span className="gv-head__meta">
          <span className="gv-head__ref">{reportReference(report)}</span>
          {report.caseFileId ? <> · from report <span className="accs-mono">{report.id}</span></> : null}
          {' · Filed ' + formatDate(report.createdAt)}
          {words(report.program) ? ' · ' + words(report.program) : null}
        </span>
        <span className="gv-chips">
          <StageChip stage={stageOf(report)} />
          <StatusChip tone={toneFor(words(report.status, 'Submitted'))}>{words(report.status, 'Submitted')}</StatusChip>
          <SeverityChip report={report} />
          <span className="gv-lock"><Icon name="lock" size={16} />Confidential</span>
          {report.confidential === true && <StatusChip tone="warn">Marked confidential by the adviser</StatusChip>}
          {isFacultyReport(report) && <span className="accs-tag">Faculty report</span>}
        </span>
      </>}
      actions={actions}
    />
  )
}

function Narrative({ report, title }: { report: Report; title: string }) {
  const text = words(report.narrative)
  return (
    <Panel title={title}>
      {text ? <p className="gv-narrative gv-quote">{text}</p> : <p className="gv-hint">No description on file.</p>}
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
            <Panel title="Progress">
              <ProgressSteps report={report} showLabels />
              <Timeline report={report} />
            </Panel>
          </div>
          <aside className="accs-stack accs-stagger" aria-label="Report details">
            <Panel title="Details">
              <Facts values={[
                ['Progress', progressOf(report).label], ['With', words(report.office, '—')], ['Category', categoryText(report)], ['Program', words(report.program, '—')],
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

type Routing = { rule: string; scope: string; criticalTerm?: string; heldBack: string[]; engineVersion: string; lexiconVersion: string; mentions: Array<{ personId: string; name: string; role: string; alias: string; term?: string; distance?: number; conflict: number }>; thresholds: { bypass: number; triage: number } }
const routingTitles: Record<string, string> = {
  'student-or-named-adviser': 'Routed to you because the student said the concern is about their adviser, or named the adviser',
  'adviser-conflict': 'Routed to you because the assigned adviser may be involved',
  'subject-professor-conflict': 'Routed to you because a subject professor may be involved',
  'possible-conflict': 'Routed to you to check whether a faculty member is involved',
  'wide-scope': 'Routed to you because the concern affects the whole program or college',
  'chair-conflict': 'Routed to you because the Program Chair may be involved',
  'chair-and-dean-conflict': 'Routed to you because the Program Chair and the Dean may be involved',
  critical: 'Routed to you because the report has words that need urgent care',
}
const personRoles: Record<string, string> = { adviser: 'adviser', subject: 'subject professor', chair: 'Program Chair', dean: 'Dean' }

/** Why the system sent the concern here: the matched name or phrase, the nearby complaint word, the score. Handlers only. */
export function ConflictNotice({ routing }: { routing?: Routing }) {
  if (!routing) return <Alert tone="warning" title="Routed to you because the assigned adviser may be involved">The system only suggests the routing. It is not a finding.</Alert>
  const title = routingTitles[routing.rule]
  const lines = routing.mentions.filter((m) => m.conflict >= routing.thresholds.triage)
  if (!title && !lines.length && !routing.heldBack.length && !routing.criticalTerm) return null
  return (
    <Alert tone="warning" title={title ?? 'Routing notes'}>
      <ul className="gv-routing">
        {lines.map((m) => <li key={m.personId}>The report mentions the student's {personRoles[m.role] ?? m.role} ({m.name}) as "{m.alias}"{m.term && m.distance != null ? `, ${m.distance} ${m.distance === 1 ? 'word' : 'words'} from "${m.term}"` : ''}. Score {Number(m.conflict ?? 0).toFixed(2)}.</li>)}
        {routing.criticalTerm && <li>Words that may need urgent care: "{routing.criticalTerm}".</li>}
        {routing.heldBack.map((note) => <li key={note}>{note}</li>)}
      </ul>
      The system only suggests the routing. It is not a finding.
    </Alert>
  )
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
      <form className="gv-composer" onSubmit={(event) => { event.preventDefault(); if (body.trim()) action.mutate({ action: 'addNote', recordId: report.id, payload: { body } }, { onSuccess: () => setBody('') }) }}>
        <TextArea label="Add an internal note" description="Only handlers can see it." value={body} onChange={setBody} isRequired maxLength={4000} showCount />
        <div className="gv-composer__foot"><Button type="submit" size="sm" loading={action.isPending} isDisabled={!body.trim() || isClosed(report)}>Add note</Button></div>
      </form>
    </Panel>
  )
}

const actionLabels: Record<string, string> = { respond: 'Respond', recordAction: 'Record action', escalate: 'Escalate', transfer: 'Transfer', resolve: 'Resolve', close: 'Close', convert: 'Open Case File', milestone: 'Add milestone' }
const nextOffices: Record<string, { stage: string; label: string }> = { adviser: { stage: 'chair', label: 'Program Chair' }, chair: { stage: 'dean', label: 'Dean' }, dean: { stage: 'guidance', label: 'Guidance Office' }, guidance: { stage: 'osas', label: 'OSAS' } }
// One line under each action in "What you can do", saying what it does.
const actionNotes: Record<string, string> = {
  respond: 'Send the reporter an update and record it.',
  recordAction: 'Record what you did, with an update for the reporter.',
  resolve: 'Record an outcome. Closing the case is a separate step afterwards.',
  close: 'Close the case with a last update for the reporter.',
  convert: 'Open a Case File to handle it at Guidance.',
  milestone: 'Record a step, for example a session held.',
}

/** The actions this reader can take on the case now, the stage's main one first. */
function caseActions(report: Report) {
  const primary = report.stage === 'adviser' ? 'respond' : report.stage === 'guidance' && !report.caseFileId ? 'convert' : ['guidance', 'osas'].includes(report.stage) ? 'milestone' : 'recordAction'
  const all = (Array.isArray(report.allowedActions) ? report.allowedActions.map(String) : []).sort((a, b) => Number(b === primary) - Number(a === primary))
  // OSAS is the last office: it has no next office, and no case is returned to an earlier one.
  return all.filter((type) => type !== 'return' && !(report.stage === 'osas' && ['escalate', 'transfer'].includes(type)))
}

export function CaseActionBar({ report }: { report: Report }) {
  const [selected, setSelected] = useState('')
  // The opened action names the popup, also while it closes (it read "Record action" during the closing animation).
  const [opened, setOpened] = useState('')
  const [reason, setReason] = useState('')
  const [update, setUpdate] = useState('')
  const [error, setError] = useState('')
  const action = useAction('P22')
  const leave = useAction('P22', '/cases')
  const allowed = caseActions(report)
  const transition = ['escalate', 'transfer'].includes(selected)
  const next = nextOffices[report.stage]
  const decision = ['chair', 'dean'].includes(report.stage)
  const label = (type: string) => type === 'recordAction' && decision ? 'Record decision'
    : ['escalate', 'transfer'].includes(type) && next ? actionLabels[type] + ' to ' + next.label
      : actionLabels[type] ?? type
  const note = (type: string) => type === 'recordAction' && decision ? 'Record your decision, with an update for the reporter.'
    : ['escalate', 'transfer'].includes(type) ? (next ? 'Send it to ' + next.label + ' with your reason.' : 'Send it to the next office with your reason.')
      : actionNotes[type] ?? ''
  if (!allowed.length) return <Panel title="What you can do"><p className="gv-hint">No actions available. You can only read this report at its current stage.</p></Panel>
  const open = (type: string) => { setSelected(type); setOpened(type); setReason(''); setUpdate(''); setError(''); action.reset(); leave.reset() }
  return (
    <Panel title="What you can do">
      <ul className="gv-next" aria-label="Actions on this case">
        {allowed.map((type) => (
          <li key={type}>
            <button type="button" className="gv-next__item" aria-haspopup="dialog" onClick={() => open(type)}>
              <span className="gv-next__text"><strong>{label(type)}</strong>{note(type) && <span>{note(type)}</span>}</span>
              <Icon name="caret-right" size={16} />
            </button>
          </li>
        ))}
      </ul>
      {/* Every action closes on a click outside, unless something has been typed: a stray click never loses a reason. */}
      <Modal title={label(opened) + '?'} isDismissable={!reason.trim() && !update.trim()} isOpen={Boolean(selected)} onOpenChange={(openState) => !openState && setSelected('')}>
        <ModalBody>
          <div className="gv-stack">
            {transition && next && <Select label="Next office" selectedKey={next.stage} onSelectionChange={() => undefined} isRequired><SelectOption id={next.stage}>{next.label}</SelectOption></Select>}
            {/* A milestone is named, not justified: "Counselling session held", not a reason. */}
            <TextArea label={opened === 'milestone' ? 'Milestone' : 'Reason'} description={opened === 'milestone' ? 'What happened, for example "Counselling session held".' : undefined} value={reason} onChange={setReason} isRequired maxLength={2000} showCount />
            <TextArea label="Update shown to the reporter" value={update} onChange={setUpdate} isRequired maxLength={4000} showCount />
            <Note>The reason stays in the handler history. The reporter sees the update you write above.</Note>
            {error && <Alert tone="danger" title="Missing information">{error}</Alert>}
            <ActionError error={action.error ?? leave.error} />
          </div>
        </ModalBody>
        <ModalActions>
          <Button variant="secondary" isDisabled={action.isPending || leave.isPending} onPress={() => setSelected('')}>Cancel</Button>
          <Button loading={action.isPending || leave.isPending} onPress={() => {
            if (!reason.trim() || !update.trim()) { setError(`Add ${opened === 'milestone' ? 'the milestone' : 'a reason'} and an update for the reporter.`); return }
            ;(transition ? leave : action).mutate({ action: 'caseAction', recordId: report.id, reason, payload: { type: selected, update, ...(transition && next ? { nextStage: next.stage } : {}) } }, { onSuccess: () => setSelected('') })
          }}>{label(opened) || 'Save action'}</Button>
        </ModalActions>
      </Modal>
    </Panel>
  )
}

// The stage tracker: every office a case can reach, OSAS included, then Resolved and Closed.
const trackSteps = [['adviser', 'Adviser'], ['chair', 'Program Chair'], ['dean', 'Dean'], ['guidance', 'Guidance'], ['osas', 'OSAS'], ['resolved', 'Resolved'], ['closed', 'Closed']] as const
const upcomingNotes: Record<string, string> = { adviser: 'Reviews it first', chair: 'If escalated', dean: 'If escalated', guidance: 'If referred', osas: 'If transferred', resolved: 'Outcome recorded', closed: 'Close it after resolving' }
const stepStates: Record<string, string> = { done: 'done', current: 'current stage', skipped: 'skipped', todo: 'not reached' }

/**
 * Where the case is: one step per office, with the office it is with now marked. A step the case passed without a history
 * entry there is shown as skipped (an adviser bypass, or a stage it did not need).
 */
function StageTracker({ report, handling }: { report: Report; handling: boolean }) {
  const current = words(report.status) === 'Closed' ? 'closed' : stageOf(report)
  const at = trackSteps.findIndex(([key]) => key === current)
  const staged = items(report.history).filter((entry) => words(entry.stage))
  const visited = new Set(staged.map((entry) => words(entry.stage)))
  const lastVisited = Math.max(-1, ...trackSteps.map(([key], index) => visited.has(key) ? index : -1))
  const since = words(staged.find((entry) => entry.stage === current)?.at, words(report.updatedAt))
  return (
    <Panel title="Where this case is" className="gv-track-card">
      <ol className="gv-track">
        {trackSteps.map(([key, name], index) => {
          const skipped = index < at && staged.length > 0 && !visited.has(key)
          const state = index === at ? 'current' : index < at ? skipped ? 'skipped' : 'done' : 'todo'
          const note = state === 'current' ? key === 'resolved' ? 'Resolved ' + formatDate(report.updatedAt) : key === 'closed' ? 'Closed ' + formatDate(report.updatedAt) : (handling ? 'With you since ' : 'Since ') + formatDate(since)
            : state === 'done' ? 'Done'
              : state === 'skipped' ? key === 'adviser' && report.aboutAdvisor === true ? 'Skipped: the concern is about the adviser'
                : key === 'adviser' && report.bypassed === true ? 'Skipped: sent past the adviser'
                  : index > lastVisited ? 'Not needed' : 'Skipped'
                : upcomingNotes[key]
          return (
            <li key={key} className="gv-track__step" data-state={state} aria-current={state === 'current' ? 'step' : undefined}>
              <span className="gv-track__rail" aria-hidden>
                <span className="gv-track__dot">{state === 'done' || (state === 'current' && (key === 'resolved' || key === 'closed')) ? <Icon name="check" size={16} /> : state === 'skipped' ? <Icon name="x" size={16} /> : index + 1}</span>
                {index < trackSteps.length - 1 && <span className="gv-track__line" data-on={index < at || undefined} />}
              </span>
              <span className="gv-track__name">{name}<span className="gv-visually-hidden">, {stepStates[state]}</span></span>
              <span className="gv-track__note">{note}</span>
            </li>
          )
        })}
      </ol>
    </Panel>
  )
}

/** Details beside the case: who and what, how the student wants to talk, and what they agreed to. */
function CaseDetails({ report }: { report: Report }) {
  const faculty = isFacultyReport(report)
  const talk = readTalk(report)
  const access = readAccess(report)
  const meeting = talk.mode === 'chat' ? 'Not needed for chat' : talk.scheduledAt ? formatDateTime(talk.scheduledAt) : talk.mode ? 'Not added yet' : '—'
  return (
    <Panel title="Details">
      <Facts values={[
        [faculty ? 'Filed by' : 'Reporter', words(object(report.reporter).name, words(report.alias, '—'))],
        ...(faculty ? [['Reported student', reportedStudentText(report)] as [string, string]] : []),
        ['Identity', report.identity === 'anonymous' ? 'Alias unless disclosed to this office' : 'Named'],
        ['Program', words(report.program, '—')],
        ['Category', categoryText(report, '—')],
        ['With', words(report.office, stageLabel(report))],
        ['Filed', formatDate(report.createdAt)],
        ['Updated', relativeTime(report.updatedAt) || '—'],
        ...(faculty ? [] : [
          ['Wants to talk via', modeLabel(talk.mode) || 'Not chosen yet'],
          ['Meeting time', meeting],
          ['Consent', access.consentAt ? 'Given ' + formatDateTime(access.consentAt) : 'Not recorded'],
          ['Also readable by', alsoReadableBy(access)],
          ...(access.aboutAdvisor ? [['About the adviser', 'Yes. The adviser was not told.']] : []),
        ] as Array<[string, string]>),
      ]} />
      {!faculty && access.wording && <details className="gv-details"><summary>What the student agreed to</summary><p className="gv-wording">{access.wording}</p></details>}
    </Panel>
  )
}

/** The adviser's mark: while a concern is with them, they can limit the Program Chair and the Dean to its status. */
export function canMarkConfidential(report: Item) {
  const actions = Array.isArray(report.allowedActions) ? report.allowedActions : []
  return report.stage === 'adviser' && report.aboutAdvisor !== true && actions.length > 0 && !isClosed(report) && report.readOnly !== true
}

function ConfidentialControl({ report }: { report: Report }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const action = useAction('P22')
  if (!canMarkConfidential(report)) return null
  const marked = report.confidential === true
  const save = () => action.mutate(
    { action: 'setConfidential', recordId: report.id, reason: reason.trim(), payload: { confidential: !marked } },
    { onSuccess: () => { setOpen(false); setReason('') } },
  )
  return (
    <Panel title="Confidential">
      <p className="gv-hint">{marked
        ? 'You marked this concern confidential. The Program Chair and the Dean see only its status.'
        : 'The Program Chair and the Dean can read this concern. Mark it confidential to limit them to its status.'}</p>
      <div><Button variant="secondary" icon="lock" onPress={() => { action.reset(); setOpen(true) }}>{marked ? 'Remove confidential mark' : 'Mark confidential'}</Button></div>
      <Modal role="alertdialog" title={marked ? 'Remove the confidential mark?' : 'Mark this concern confidential?'} isOpen={open} onOpenChange={setOpen}>
        <ModalBody>
          <p>{marked ? 'The Program Chair and the Dean will be able to read the whole concern again.' : 'The Program Chair and the Dean will see only its status, office and dates. The student is told.'}</p>
          <TextArea label="Reason" isRequired maxLength={2000} value={reason} onChange={setReason} description="Kept in the case history." />
          <ActionError error={action.error} />
        </ModalBody>
        <ModalActions>
          <Button variant="secondary" onPress={() => setOpen(false)} isDisabled={action.isPending}>Cancel</Button>
          <Button loading={action.isPending} isDisabled={!reason.trim()} onPress={save}>{marked ? 'Remove mark' : 'Mark confidential'}</Button>
        </ModalActions>
      </Modal>
    </Panel>
  )
}

/** Public status updates only: office, what happened, and when. */
function StatusTimeline({ entries }: { entries: Item[] }) {
  if (!entries.length) return <Empty title="No updates yet">Status updates show here.</Empty>
  return (
    <ol className="accs-timeline gv-timeline" aria-label="Status updates">
      {entries.map((entry, index) => (
        <li key={words(entry.at) + index} data-current={index === entries.length - 1 || undefined}>
          <p className="gv-ev__head"><strong>{words(entry.action, 'Update recorded')}</strong>{words(entry.office) && <span className="accs-tag gv-cap">{words(entry.office)}</span>}</p>
          <time className="accs-timeline__time" dateTime={words(entry.at)}>{formatDateTime(entry.at)}</time>
        </li>
      ))}
    </ol>
  )
}

function StatusOnlyView({ report, crumbs }: { report: Report; crumbs: Array<{ label: string; href?: string }> }) {
  const filed = isFacultyReport(report)
  return (
    <MotionConfig reducedMotion="user">
      <div className="gv-page">
        <PageHeader
          crumbs={crumbs}
          title={filed ? categoryText(report) : 'Status of ' + reportReference(report)}
          description={'Filed ' + formatDate(report.createdAt)}
          actions={<div className="gv-chips">
            <StageChip stage={stageOf(report)} />
            <StatusChip tone={toneFor(words(report.status, 'Submitted'))}>{words(report.status, 'Submitted')}</StatusChip>
            {report.confidential === true && <StatusChip tone="warn">Marked confidential by the adviser</StatusChip>}
            {filed && <span className="accs-tag">Faculty report</span>}
          </div>}
        />
        <Alert tone="neutral" title={filed ? 'Your report' : report.confidential === true ? 'Status only' : 'Following this concern'}>{words(report.statusNotice, 'You can follow the status of this concern here.')}</Alert>
        <div className="accs-split">
          <div className="accs-stack">
            {filed && <Narrative report={report} title="Your statement" />}
            <Panel title="Status updates"><StatusTimeline entries={items(report.timeline)} /></Panel>
          </div>
          <aside className="accs-stack" aria-label="Status">
            <Panel title="Where it is">
              <Facts values={[
                ['Status', words(report.status, '—')], ['Office', words(report.office, '—')], ['Program', words(report.program, '—')],
                ['Filed', formatDate(report.createdAt)], ['Updated', relativeTime(report.updatedAt) || '—'],
                ...(filed ? [['Student', reportedStudentText(report)], ['Category', categoryText(report)], ['Severity', <SeverityChip key="severity" report={report} />]] as Array<[string, React.ReactNode]> : []),
              ]} />
              <Note>{filed ? 'You follow the status of your report here. Messages and internal notes stay with the office handling it.' : 'The statement, the student, messages and internal notes are not shown here.'}</Note>
            </Panel>
          </aside>
        </div>
      </div>
    </MotionConfig>
  )
}

function CaseWorkspace({ page }: { page: PageEnvelope }) {
  const report = object(page.data.record) as Report
  const talkAction = useAction('P22')
  if (!report.id) return <RestrictedView record />
  const crumbs = [{ label: 'Cases', href: '/cases' }, { label: reportReference(report) }]
  // Status only (MeetingAt10/accs-backend#30, #31): an office the case has moved past, or the Program Chair and the Dean
  // on a concern the adviser marked confidential. No statement, reporter, messages or notes.
  if (report.statusOnly === true) return <StatusOnlyView report={report} crumbs={crumbs} />
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
  // Read only: the Program Chair and the Dean read every concern in their scope but act only when it is with them.
  const readOnly = report.readOnly === true
  const faculty = isFacultyReport(report)
  const closed = isClosed(report)
  const talk = readTalk(report)
  const actions = readOnly ? [] : caseActions(report)
  // The header buttons take the reader to the part of the page that does it, and move focus there.
  const jump = (id: string) => {
    const target = document.getElementById(id)
    if (!target) return
    target.focus({ preventScroll: true })
    // A plain jump: a smooth scroll started from the press was sometimes cancelled and left the page where it was.
    target.scrollIntoView({ block: 'start' })
  }
  const headerActions = (
    <>
      {!faculty && !readOnly && !closed && talk.mode === 'chat' && <Button variant="secondary" icon="chat" onPress={() => jump('case-messages')}>Message student</Button>}
      {!faculty && !readOnly && !closed && actions.length > 0 && talk.mode && talk.mode !== 'chat' && <Button variant="secondary" icon="calendar" onPress={() => jump('case-talk')}>Book a meeting</Button>}
      {actions.length > 0 && <Button icon="check" onPress={() => jump('case-actions')}>Take action</Button>}
    </>
  )
  return (
    <MotionConfig reducedMotion="user">
      <div className="gv-page gv-case">
        <CaseHeader report={report} crumbs={crumbs} actions={headerActions} />
        {!readOnly && (report.bypassed === true || !!report.routing) && <ConflictNotice routing={report.routing as Routing | undefined} />}
        {readOnly && <Alert tone="neutral" title="Read only">{words(report.office, 'Another office')} is handling this concern. You can read it, but only the office handling it can act on it.</Alert>}
        <StageTracker report={report} handling={!readOnly && !closed} />
        <div className="gv-case__grid">
          <div className="accs-stack accs-stagger">
            <Narrative report={report} title={faculty ? 'Faculty statement' : "Student's statement"} />
            {/* A faculty report has no student talk choice or chat: the office follows it up directly. */}
            {!faculty && <div id="case-talk" className="gv-anchor" tabIndex={-1}><HandlerTalk report={report} action={talkAction} /></div>}
            {!faculty && <div id="case-messages" className="gv-anchor" tabIndex={-1}><Panel title="Messages"><Conversation report={report} pageId="P22" readOnly={readOnly} /></Panel></div>}
            <Panel title="Activity"><Timeline report={report} handler /></Panel>
            {!readOnly && <CaseNotes report={report} />}
          </div>
          <aside className="accs-stack accs-stagger" aria-label="Case details">
            <CaseDetails report={report} />
            <p className="gv-guard"><Icon icon={ShieldIcon} size={20} /><span>Only authorized handlers can open this record. We record every action.</span></p>
            {!readOnly && <div id="case-actions" className="gv-anchor" tabIndex={-1}><CaseActionBar report={report} /></div>}
            <CaseStrikes report={report} />
            {!readOnly && <ConfidentialControl report={report} />}
          </aside>
        </div>
      </div>
    </MotionConfig>
  )
}

// Queue table columns; the ones with a sort key sort on a click. The sort menu offers every key.
const queueColumns: Array<[string, string, string]> = [['id', 'Reference', 'gv-c-ref'], ['category', 'Concern', 'gv-c-title'], ['', 'Stage', 'gv-c-stage'], ['severity', 'Severity', 'gv-c-sev'], ['waiting', 'Waiting', 'gv-c-wait'], ['updatedAt', 'Updated', 'gv-c-time']]
const sortOptions: Array<[string, string]> = [['id', 'Reference'], ['category', 'Category'], ['student', 'Student'], ['severity', 'Severity'], ['status', 'Status'], ['createdAt', 'Submitted'], ['updatedAt', 'Last action'], ['waiting', 'Waiting (days)']]
const waitingText = (days: number) => days < 1 ? 'Under a day' : days === 1 ? '1 day' : days + ' days'

/** A filter on the design-system Select, so it matches the other dropdowns and works with the keyboard and screen readers. */
function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: Array<[string, string]>; onChange: (value: string) => void }) {
  return (
    <Select label={label} selectedKey={value} onSelectionChange={(key) => onChange(String(key ?? ''))}>
      {options.map(([id, name]) => <SelectOption id={id} key={id}>{name}</SelectOption>)}
    </Select>
  )
}

/** A row the reader acts on: not read-only, not status only, not their own past entries. */
export const mine = (report: Item) => report.readOnly !== true && report.statusOnly !== true && report.historyOnly !== true
/** A row the reader can see but not act on. */
export const following = (report: Item) => report.readOnly === true || report.statusOnly === true

const reportedStudentText = (report: Item) => {
  const student = object(report.reportedStudent)
  return [words(student.name), words(student.studentId)].filter(Boolean).join(' · ') || '—'
}

type StudentReportDraft = { studentId: string; narrative: string; category: string; subcategory: string; categoryDetail: string; severity: SeverityLevel | ''; location: string; occurredOn: string; ongoing: boolean }
const blankStudentReport: StudentReportDraft = { studentId: '', narrative: '', category: '', subcategory: '', categoryDetail: '', severity: '', location: '', occurredOn: '', ongoing: false }

/** Faculty report a student from their classes (P21 `reportStudent`). It goes to the Program Chair, or to the Dean when the chair files it. */
function ReportStudent({ page }: { page: PageEnvelope }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<StudentReportDraft>(blankStudentReport)
  const [tried, setTried] = useState(false)
  const action = useAction('P21')
  const options = readCategoryOptions(page.data.categoryOptions)
  const students = items(page.data.reportableStudents)
  const option = options.find((entry) => entry.label === draft.category)
  const missing = choiceProblems(draft, options)
  const update = <K extends keyof StudentReportDraft>(key: K, value: StudentReportDraft[K]) => setDraft((current) => ({ ...current, [key]: value }))
  const refused = (path: string) => (action.error as { fields?: Array<{ path: string; message: string }> } | null)?.fields?.find((field) => field.path === path)?.message
  const fieldError = (path: string, local?: string) => refused(path) ?? (tried ? local : undefined)
  const ready = Boolean(draft.studentId && draft.narrative.trim() && draft.severity && (draft.occurredOn || draft.ongoing)) && Object.keys(missing).length === 0
  // What is still missing, in the form's order, said next to the Send button: the fields' own messages can be off screen.
  const missingNames = [
    !draft.studentId && 'Student',
    missing.category && 'Category',
    missing.categoryDetail && 'Description',
    !draft.severity && 'How serious it is',
    !draft.narrative.trim() && 'What happened',
    !draft.occurredOn && !draft.ongoing && 'When it happened',
  ].filter(Boolean) as string[]
  const close = () => { setOpen(false); setTried(false); action.reset() }
  const send = (form?: HTMLFormElement | null) => {
    setTried(true)
    if (!ready) {
      // Take the reader to the first field that needs them.
      requestAnimationFrame(() => (form?.querySelector('[aria-invalid="true"], [data-invalid] input, [data-invalid] button, [data-invalid] textarea') as HTMLElement | null)?.focus())
      return
    }
    action.mutate({
      action: 'reportStudent',
      payload: {
        studentId: draft.studentId, narrative: draft.narrative.trim(), ...choicePayload(draft, options), severity: draft.severity,
        ...(draft.location.trim() ? { location: draft.location.trim() } : {}),
        ...(draft.ongoing ? { ongoing: true } : draft.occurredOn ? { occurredOn: draft.occurredOn } : {}),
      },
    }, { onSuccess: () => { setDraft(blankStudentReport); close() } })
  }
  return (
    <>
      <Button icon="plus" onPress={() => { action.reset(); setOpen(true) }}>Report a student</Button>
      <Drawer title="Report a student" isOpen={open} onOpenChange={(state) => !state && close()}>
        {/* noValidate: the browser's own required-field check stopped the submit silently (custom lists show no bubble), so our message never appeared. */}
        <form className="gv-stack" noValidate onSubmit={(event) => { event.preventDefault(); send(event.currentTarget) }}>
          <p className="gv-hint">Report a student in your scope: your classes, plus your program for a Chair or the whole college for the Dean. It goes to the Program Chair, or to the Dean if you are the chair. You can follow its status from your case queue.</p>
          <Select label="Student" placeholder="Choose a student" isRequired selectedKey={draft.studentId || null} onSelectionChange={(key) => update('studentId', String(key ?? ''))}
            isInvalid={Boolean(fieldError('studentId', draft.studentId ? undefined : 'Choose a student.'))} errorMessage={fieldError('studentId', draft.studentId ? undefined : 'Choose a student.')}
            description={students.length ? undefined : 'No students in your scope yet.'}>
            {students.map((student) => <SelectOption id={words(student.id)} key={words(student.id)}>{[words(student.name), words(student.studentId), [words(student.program), words(student.section)].filter(Boolean).join(' ')].filter(Boolean).join(' · ')}</SelectOption>)}
          </Select>
          <Select label="Category" placeholder="Choose a category" isRequired selectedKey={draft.category || null} onSelectionChange={(key) => setDraft((current) => current.category === String(key ?? '') ? current : { ...current, category: String(key ?? ''), subcategory: '', categoryDetail: '' })}
            description={option?.description} isInvalid={Boolean(fieldError('category', missing.category))} errorMessage={fieldError('category', missing.category)}>
            {options.map((entry) => <SelectOption id={entry.label} key={entry.label}>{entry.label}</SelectOption>)}
          </Select>
          {option?.requiresDetail
            ? <TextField label="Describe it briefly" isRequired maxLength={categoryDetailMax} value={draft.categoryDetail} onChange={(value) => update('categoryDetail', value)}
              isInvalid={Boolean(fieldError('categoryDetail', missing.categoryDetail))} errorMessage={fieldError('categoryDetail', missing.categoryDetail)} />
            : <Select key={draft.category || 'none'} label="Sub-category (optional)" placeholder="Choose a sub-category" isDisabled={!option} selectedKey={draft.subcategory || null} onSelectionChange={(key) => update('subcategory', String(key ?? ''))}
              description={option ? undefined : 'Choose a category first.'} isInvalid={Boolean(fieldError('subcategory', option ? missing.subcategory : undefined))} errorMessage={fieldError('subcategory', option ? missing.subcategory : undefined)}>
              {(option?.subcategories ?? []).map((sub) => <SelectOption id={sub} key={sub}>{sub}</SelectOption>)}
            </Select>}
          <RadioGroup label="How serious is it?" isRequired value={draft.severity} onChange={(value) => update('severity', value as SeverityLevel)}
            isInvalid={Boolean(fieldError('severity', draft.severity ? undefined : 'Choose how serious it is.'))} errorMessage={fieldError('severity', draft.severity ? undefined : 'Choose how serious it is.')}>
            <Radio value="low">Low</Radio>
            <Radio value="medium">Medium</Radio>
            <Radio value="high">High</Radio>
          </RadioGroup>
          <TextArea label="What happened" isRequired showCount maxLength={4000} value={draft.narrative} onChange={(value) => update('narrative', value)}
            isInvalid={Boolean(fieldError('narrative', draft.narrative.trim() ? undefined : 'Say what happened.'))} errorMessage={fieldError('narrative', draft.narrative.trim() ? undefined : 'Say what happened.')} />
          <Grid columns={2}>
            <TextField label="Where" maxLength={200} value={draft.location} onChange={(value) => update('location', value)} description="Optional" />
            <div>
              <DatePicker label="When" isRequired={!draft.ongoing} isDisabled={draft.ongoing} maxValue={campusToday()} onChange={(value) => update('occurredOn', value?.toString() ?? '')} description="Choose a date, or tick Ongoing" isInvalid={Boolean(tried && !draft.occurredOn && !draft.ongoing)} />
              <Checkbox isSelected={draft.ongoing} onChange={(on) => update('ongoing', on)}>Ongoing / happens repeatedly</Checkbox>
            </div>
          </Grid>
          {action.error && !(action.error as { fields?: unknown[] }).fields?.length && <Alert tone="danger" title="The report was not sent">{action.error.message}</Alert>}
          {tried && missingNames.length > 0 && <Alert tone="danger" title="Fill in the required fields">{missingNames.join(', ')}.</Alert>}
          <div className="gv-foot">
            <Button variant="secondary" onPress={close} isDisabled={action.isPending}>Cancel</Button>
            <Button type="submit" loading={action.isPending}>Send report</Button>
          </div>
        </form>
      </Drawer>
    </>
  )
}

// OSAS has worked a case once it wrote its own history entry; before that it is a new transfer.
const osasActed = (report: Item) => items(report.history).some((entry) => entry.actorRole === 'osas')

function CaseQueue({ page }: { page: PageEnvelope }) {
  const session = useQuery(sessionQuery())
  const roles = session.data?.user.roles ?? []
  const role = ['chair', 'dean', 'guidance', 'osas', 'professor'].find((candidate) => roles.some((value) => value === candidate)) ?? 'professor'
  const initial = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search)
  const [query, setQuery] = useState(initial.get('q') ?? '')
  const [level, setLevel] = useState(initial.get('severity') ?? '')
  const [category, setCategory] = useState(initial.get('category') ?? '')
  const [subcategory, setSubcategory] = useState(initial.get('subcategory') ?? '')
  const [status, setStatus] = useState(initial.get('status') ?? '')
  const [stage, setStage] = useState(initial.get('stage') ?? '')
  const [received, setReceived] = useState('term')
  const [tab, setTab] = useState(initial.get('tab') ?? 'open')
  const [currentPage, setCurrentPage] = useState(1)
  const [sort, setSort] = useState<SortDescriptor>({ column: 'updatedAt', direction: 'descending' })
  const records = items(page.data.cases)
  const categoryOptions = readCategoryOptions(page.data.categoryOptions)
  const queueCategories = [...new Set([...categoryOptions.map((option) => option.label), ...records.map((report) => words(report.category))])].filter(Boolean)
  const queueSubcategories = categoryOptions.find((option) => option.label === category)?.subcategories ?? []
  // Someone who is also a professor (a Chair or the Dean who teaches) handles their advisees' reports too: their own tab,
  // named for what it is (QA 17 November: a Chair could not find them under "Teaching assignments", and the Dean had none).
  const adviserTab = role !== 'professor' && roles.includes('professor') ? [['teaching', 'As adviser']] : []
  const tabDefs = role === 'chair' ? [['bypassed', 'Bypassed'], ['open', 'Escalated to me'], ...adviserTab, ['history', 'Handled by me'], ['closed', 'Closed']]
    : role === 'dean' ? [['open', 'At Dean stage'], ...adviserTab, ['history', 'Transferred'], ['closed', 'Closed']]
      : role === 'guidance' ? [['intake', 'Escalated to me'], ['open', 'Active Case Files'], ['history', 'Transferred to OSAS'], ['closed', 'Closed']]
        : role === 'osas' ? [['open', 'New transfers'], ['active', 'Active'], ['history', 'Transferred'], ['closed', 'Closed']]
          : [['open', 'Open'], ['waiting', 'Waiting on reporter'], ['closed', 'Closed']]
  // Rows this reader can see but not act on (read-only, status only) have their own tab.
  const followLabel = role === 'chair' ? 'All in program' : role === 'dean' ? 'All concerns' : 'Following'
  const tabsShown = records.some(following) ? [...tabDefs, ['following', followLabel]] : tabDefs
  const validTab = tabsShown.some(([id]) => id === tab) ? tab : tabsShown[0][0]
  const sortValue = (report: Item) => sort.column === 'id' ? reportReference(report) : sort.column === 'student' ? studentName(report) : words(report[String(sort.column)])
  const inTab = (report: Item, selected: string) => selected === 'closed' ? isClosed(report)
    : selected === 'history' ? report.historyOnly === true
      : selected === 'following' ? following(report) && !isClosed(report)
        : !mine(report) ? false
          : selected === 'bypassed' ? report.bypassed === true && !isClosed(report)
            : selected === 'teaching' ? report.stage === 'adviser' && !isClosed(report)
              : selected === 'waiting' ? words(report.status).toLowerCase().includes('waiting')
                : selected === 'intake' ? report.stage === 'guidance' && !report.caseFileId && !isClosed(report)
                  : selected === 'active' ? !isClosed(report) && osasActed(report)
                    : !isClosed(report) && (role !== 'chair' || !report.bypassed && report.stage === 'chair') && (role !== 'guidance' || Boolean(report.caseFileId)) && (role !== 'osas' || !osasActed(report)) && (!adviserTab.length || report.stage !== 'adviser')
  const inQueue = records.filter((report) => inTab(report, validTab))
  const filtered = inQueue.filter((report) => (!stage || stageOf(report) === stage) && (!query || [reportReference(report), words(report.id), studentName(report), words(report.category), words(report.subcategory), words(report.severity)].join(' ').toLowerCase().includes(query.trim().toLowerCase())) && (!level || report.severity === level) && (!category || report.category === category) && (!subcategory || report.subcategory === subcategory) && (!status || report.status === status) && (received === 'term' || new Date(words(report.createdAt)).getTime() >= Date.now() - Number(received) * 86400000))
    .sort((a, b) => (sort.column === 'waiting' ? waitingDays(a) - waitingDays(b) : sortValue(a).localeCompare(sortValue(b))) * (sort.direction === 'descending' ? -1 : 1))
  const pageCount = Math.max(1, Math.ceil(filtered.length / 8))
  const shown = filtered.slice((Math.min(currentPage, pageCount) - 1) * 8, Math.min(currentPage, pageCount) * 8)
  const reset = (change: () => void) => { change(); setCurrentPage(1) }
  const title = role === 'chair' ? 'Program reports · ' + (session.data?.user.program ?? '') : role === 'dean' ? 'Escalated reports' : role === 'guidance' ? 'Case Files' : role === 'osas' ? 'OSAS cases' : 'Assigned reports'
  const intro = role === 'chair' ? 'Every concern in your program, who holds it, and how long it has waited.' : 'The reports routed to you, where each one is, and how long it has waited.'
  const toggleSort = (column: string) => setSort((current) => ({ column, direction: current.column === column && current.direction === 'ascending' ? 'descending' : 'ascending' }))
  const shownPage = Math.min(currentPage, pageCount)
  return (
    <MotionConfig reducedMotion="user">
      <div className="gv-page gv-queue">
        <PageHeader title={title} description={intro} actions={page.data.canReportStudent === true ? <ReportStudent page={page} /> : undefined} />
        <div className="gv-page accs-stagger">
          {items(page.data.filedReports).length > 0 && (
            <Panel title="Reports you filed" flush>
              <ul className="accs-rows gv-rows">
                {items(page.data.filedReports).map((report) => (
                  <li key={words(report.id)}>
                    <a className="accs-row gv-row" href={casePath(report)}>
                      <span className="accs-mono gv-row__ref" title={reportReference(report)}>{reportReference(report)}</span>
                      <span className="gv-row__main">
                        <span className="accs-row__title">{studentName(report) || '—'} · {categoryText(report)}</span>
                        <span className="accs-row__sub">Filed {formatDate(report.createdAt)} · {words(report.office, '—')}</span>
                      </span>
                      <StatusChip tone={toneFor(words(report.status, 'Submitted'))}>{words(report.status, 'Submitted')}</StatusChip>
                      <span className="gv-row__go" aria-hidden><Icon name="caret-right" size={16} /></span>
                    </a>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          <QueueTabs validTab={validTab} onChange={(key) => reset(() => setTab(key))} defs={tabsShown} records={records} inTab={inTab} />
          <div className="accs-toolbar gv-toolbar gv-qbar">
            <div className="gv-qbar__search"><Search label="Search reports" placeholder="Search by reference, student or category" size="sm" value={query} onChange={(value) => reset(() => setQuery(value))} /></div>
            <FilterSelect label="Severity" value={level} onChange={(value) => reset(() => setLevel(value))} options={[['', 'All'], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High']]} />
            {/* Every category, not only those in the list now, and its sub-categories once one is chosen. */}
            <FilterSelect label="Category" value={category} onChange={(value) => reset(() => { setCategory(value); setSubcategory('') })} options={[['', 'All'], ...queueCategories.map((value): [string, string] => [value, value])]} />
            {queueSubcategories.length > 0 && <FilterSelect label="Sub-category" value={subcategory} onChange={(value) => reset(() => setSubcategory(value))} options={[['', 'All'], ...queueSubcategories.map((value): [string, string] => [value, value])]} />}
            <FilterSelect label="Status" value={status} onChange={(value) => reset(() => setStatus(value))} options={[['', 'All'], ...[...new Set(records.map((report) => words(report.status)))].filter(Boolean).map((value): [string, string] => [value, value])]} />
            <FilterSelect label="Stage" value={stage} onChange={(value) => reset(() => setStage(value))} options={[['', 'All'], ...stages.map(([key, name]): [string, string] => [key, name + ' (' + inQueue.filter((report) => stageOf(report) === key).length + ')'])]} />
            <FilterSelect label="Received" value={received} onChange={(value) => reset(() => setReceived(value))} options={[['term', 'Any time'], ['7', 'Last 7 days'], ['30', 'Last 30 days']]} />
            <div className="gv-qbar__sort">
              <FilterSelect label="Sorted by" value={String(sort.column)} onChange={(value) => setSort((current) => ({ ...current, column: value }))} options={sortOptions} />
              <button type="button" className="gv-filter gv-filter--dir" onClick={() => setSort((current) => ({ ...current, direction: current.direction === 'ascending' ? 'descending' : 'ascending' }))}
                aria-label={sort.direction === 'ascending' ? 'Sorted ascending. Sort descending' : 'Sorted descending. Sort ascending'}>
                <Icon name={sort.direction === 'ascending' ? 'sort-ascending' : 'sort-descending'} size={16} />
              </button>
            </div>
          </div>
          {filtered.length ? (
            <div className="gv-qcard">
              <div className="gv-qscroll">
                <table className="gv-table" aria-label="Reports in this queue">
                  <thead>
                    <tr>
                      {queueColumns.map(([id, name, className]) => (
                        <th key={name} className={className} aria-sort={id && sort.column === id ? sort.direction : id ? 'none' : undefined}>
                          {id ? <button type="button" className="gv-sort" onClick={() => toggleSort(id)}>{name}{sort.column === id && <span aria-hidden>{sort.direction === 'ascending' ? '↑' : '↓'}</span>}</button> : name}
                        </th>
                      ))}
                      <th className="gv-c-go"><span className="gv-visually-hidden">Open</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((report) => {
                      const talk = modeLabel(readTalk(report).mode)
                      const days = waitingDays(report)
                      const late = days > 30 && !isClosed(report)
                      // A status-only row names no student and has no talk choice to show.
                      const sub = (report.statusOnly === true ? [words(report.program)] : [studentName(report), words(report.program), talk || 'Talk not chosen']).filter((value) => value && value !== '—').join(' · ')
                      return (
                        <tr key={words(report.id)}>
                          <td className="gv-c-ref"><a className="gv-ref-link" href={casePath(report)} title={reportReference(report)}>{reportReference(report)}</a></td>
                          <td className="gv-c-title">
                            <span className="gv-title">{report.statusOnly === true && !isFacultyReport(report) ? 'Status only' : categoryText(report)}</span>
                            <span className="gv-title-sub">
                              {sub}
                              {isFacultyReport(report) && <span className="gv-flag">Faculty report</span>}
                              {report.confidential === true && <span className="gv-flag"><Icon name="lock" size={16} />Confidential</span>}
                              {report.bypassed === true && <span className="gv-flag">Adviser bypassed</span>}
                            </span>
                          </td>
                          <td className="gv-c-stage" data-label="Stage"><StageChip stage={stageOf(report)} /><span className="gv-stage-sub">{words(report.status)}</span></td>
                          <td className="gv-c-sev" data-label="Severity">{report.statusOnly === true ? <span className="gv-muted">—</span> : <SeverityChip report={report} dot />}</td>
                          <td className="gv-c-wait" data-label="Waiting" data-late={late || undefined}>{waitingText(days)}{late && <span className="gv-visually-hidden">, over 30 days</span>}</td>
                          <td className="gv-c-time" data-label="Updated"><span title={formatDateTime(report.updatedAt)}>{relativeTime(report.updatedAt) || '—'}</span></td>
                          <td className="gv-c-go"><a className="gv-open" href={casePath(report)} aria-label={'Open ' + reportReference(report)}><Icon name="caret-right" size={16} /></a></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <nav className="gv-qfoot" aria-label="Queue pages">
                <p className="gv-qfoot__text">
                  Showing {shown.length} of {filtered.length} reports{pageCount > 1 ? ' · Page ' + shownPage + ' of ' + pageCount : ''}
                  <span className="gv-qfoot__hint"> · Reports waiting over 30 days are flagged red</span>
                </p>
                <div className="gv-qfoot__pager">
                  <Button variant="secondary" size="sm" isDisabled={shownPage <= 1} onPress={() => setCurrentPage(shownPage - 1)}>Previous</Button>
                  <Button variant="secondary" size="sm" isDisabled={shownPage >= pageCount} onPress={() => setCurrentPage(shownPage + 1)}>Next</Button>
                </div>
              </nav>
            </div>
          ) : <Panel>{query || level || category || status || stage
            ? <Empty title="No reports match these filters">Clear a filter to see more of your reports.</Empty>
            : <Empty title="No reports in this queue">Nothing is routed to you right now.</Empty>}</Panel>}
          <div className="gv-legend">
            <span className="gv-legend__label" id="gv-legend-label">How a report moves:</span>
            <ol aria-labelledby="gv-legend-label">
              {caseStages.map((key, index) => (
                <li key={key}><StageChip stage={key} />{index < caseStages.length - 1 && <Icon name="caret-right" size={16} />}</li>
              ))}
            </ol>
          </div>
          <Note>{role === 'chair' || role === 'dean' ? 'You see the concerns in your scope and act on those with you. Every action is recorded.' : 'You see only reports routed to you. Every action is recorded.'}</Note>
        </div>
      </div>
    </MotionConfig>
  )
}

/** Queue tabs with counts, in a segmented bar; the current one slides to its place. */
function QueueTabs({ validTab, onChange, defs, records, inTab }: { validTab: string; onChange: (key: string) => void; defs: string[][]; records: Item[]; inTab: (report: Item, selected: string) => boolean }) {
  return (
    <LayoutGroup id="gv-tabs">
      <nav className="gv-qtabs" aria-label="Case queues">
        {defs.map(([id, label]) => (
          <button key={id} type="button" className="gv-qtab" aria-current={validTab === id ? 'page' : undefined} onClick={() => onChange(id)}>
            {validTab === id && <motion.span layoutId="gv-tab-ind" className="gv-qtab__bg" transition={spring} />}
            <span className="gv-qtab__label">{label}</span>
            <span className="gv-qtab__count">{records.filter((report) => inTab(report, id)).length}</span>
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
