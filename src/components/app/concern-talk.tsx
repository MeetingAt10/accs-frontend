import {
  Alert, Button, Checkbox, Icon, Link, Modal, ModalActions, ModalBody, TextField,
  type IconProps,
} from '@meetingat10/design-system/react'
import { PhoneIcon, VideoCameraIcon } from '@meetingat10/design-system/icons'
import type { UseMutationResult } from '@tanstack/react-query'
import { useState, type FormEvent, type ReactNode } from 'react'

import type { ActionResult, PageAction } from '@/lib/api'
import { formatDateTime } from '@/lib/format'
import { Empty, Panel } from '@/components/app/page-shell'

// Consent, who can see a report, and how the student and the person handling it talk.

type Item = Record<string, unknown>
export type PageMutation = UseMutationResult<ActionResult, Error, PageAction>
export type TalkMode = 'chat' | 'video' | 'voice' | 'face_to_face'
// Who reads a concern follows from the rules, not from the student's choices (MeetingAt10/accs-backend#31): the adviser
// (or the Program Chair when it is about the adviser), the Program Chair and the Dean. The adviser can mark it confidential;
// then the Program Chair and the Dean see its status only.
export type Sharing = { aboutAdvisor: boolean; confidential?: boolean }

const object = (value: unknown): Item => value && typeof value === 'object' && !Array.isArray(value) ? value as Item : {}
const list = (value: unknown): Item[] => Array.isArray(value) ? value.map(object) : []
const text = (value: unknown) => typeof value === 'string' || typeof value === 'number' ? String(value) : ''
const isClosed = (report: Item) => ['Resolved', 'Closed'].includes(text(report.status))

// ---------- Wording ----------

export type Wording = { report: string; talk: Record<TalkMode, string>; recording: { allow: string; deny: string } }

// The server saves the wording it sent with each consent, and sends it with the report pages (`consentWording`).
// This copy is the same text, for the moment before those pages load it.
const fallbackWording: Wording = {
  report: 'I have read my statement and I want to send it. My adviser can read it so they can help me. The Program Chair of my program and the Dean can also read it, unless my adviser marks it confidential; then they see only its status. If my statement is about my adviser, my adviser is not told about it and cannot read it. It goes to my Program Chair instead. ACCS keeps a record of this agreement with the date and time.',
  talk: {
    chat: 'I agree to talk about my statement in a written chat in ACCS with the office handling it. Only that office and I can read and write in this chat.',
    video: 'I agree to talk about my statement in a video call. The office handling it will add a meeting link and a time. They will see me on the call, so they will know who I am.',
    voice: 'I agree to talk about my statement in a voice call. The office handling it will add a meeting link and a time. They will hear me on the call, so they may know who I am.',
    face_to_face: 'I agree to meet in person to talk about my statement. The office handling it will add a time and a place. They will see me, so they will know who I am.',
  },
  recording: { allow: 'I allow this call to be recorded.', deny: 'I do not allow this call to be recorded.' },
}

/** The wording from the page data, with the same text filled in for anything the page did not send. */
export function readWording(value: unknown): Wording {
  const sent = object(value)
  const talk = object(sent.talk)
  const recording = object(sent.recording)
  return {
    report: text(sent.report) || fallbackWording.report,
    talk: {
      chat: text(talk.chat) || fallbackWording.talk.chat, video: text(talk.video) || fallbackWording.talk.video,
      voice: text(talk.voice) || fallbackWording.talk.voice, face_to_face: text(talk.face_to_face) || fallbackWording.talk.face_to_face,
    },
    recording: { allow: text(recording.allow) || fallbackWording.recording.allow, deny: text(recording.deny) || fallbackWording.recording.deny },
  }
}

// ---------- What the page data says ----------

const modes: Array<{ id: TalkMode; label: string; title: string; blurb: string; icon: Pick<IconProps, 'name' | 'icon'> }> = [
  { id: 'chat', label: 'System chat', title: 'Use system chat?', blurb: 'Write to each other here, any time you like.', icon: { name: 'chat' } },
  { id: 'video', label: 'Video call', title: 'Talk by video call?', blurb: 'Talk on a video call. A meeting link and a time are added here.', icon: { icon: VideoCameraIcon } },
  { id: 'voice', label: 'Voice call', title: 'Talk by voice call?', blurb: 'Talk on a voice call. A meeting link and a time are added here.', icon: { icon: PhoneIcon } },
  { id: 'face_to_face', label: 'Face-to-face', title: 'Meet face-to-face?', blurb: 'Meet in person. A time and a place are added here.', icon: { name: 'users' } },
]
export const modeLabel = (mode: unknown) => modes.find((entry) => entry.id === mode)?.label ?? ''
const isCall = (mode?: TalkMode) => mode === 'video' || mode === 'voice'

export type Talk = {
  mode?: TalkMode
  consentAt: string
  recordCall: boolean
  preferredAt: string
  scheduledAt: string
  meetingLink: string
  place: string
}

/** How the student chose to talk, with the time they agreed to it. */
export function readTalk(report: Item): Talk {
  const talk = object(report.talk)
  const mode = modes.find((entry) => entry.id === talk.mode)?.id
  const consent: Item = list(talk.consents).filter((entry) => entry.mode === mode).at(-1) ?? {}
  return {
    mode, consentAt: text(consent.at), recordCall: consent.recordCall === true,
    preferredAt: text(talk.preferredAt), scheduledAt: text(talk.scheduledAt), meetingLink: text(talk.meetingLink), place: text(talk.place),
  }
}

export type Access = Sharing & { confidential: boolean; consentAt: string; wording: string }

/** Who can read the report, and the consent the student gave when they sent it. */
export function readAccess(report: Item): Access {
  const consent = object(report.consent)
  return { aboutAdvisor: report.aboutAdvisor === true, confidential: report.confidential === true, consentAt: text(consent.at), wording: text(consent.wording) }
}

const handlerOf = (report: Item) => report.stage === 'adviser' ? 'your adviser' : report.stage === 'chair' ? 'your program chair' : 'the office handling this report'

/** Times are entered and shown as campus time (Philippines), whatever zone the browser is in. */
export const campusIso = (local: string) => new Date(local.slice(0, 16) + ':00+08:00').toISOString()
export const campusLocal = (iso: string) => {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('sv-SE', { timeZone: 'Asia/Manila' }).slice(0, 16).replace(' ', 'T')
}
/** The address when it is an https link (the only kind the server keeps), otherwise empty. */
export const secureLink = (value: string) => {
  try { return new URL(value).protocol === 'https:' ? value : '' } catch { return '' }
}

function Facts({ rows }: { rows: Array<[string, ReactNode]> }) {
  return <dl className="gv-facts">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
}

// ---------- Filing: who can read it, and the consent form ----------

const readersOf = ({ aboutAdvisor }: Sharing, adviser = '') => [
  ...(aboutAdvisor ? [] : [adviser ? 'Your adviser, ' + adviser : 'Your adviser']),
  aboutAdvisor ? 'Your program chair, who receives it instead of your adviser' : 'Your program chair',
  'The Dean',
]

const statusOnlyNote = 'Sees its status only. Your adviser marked it confidential.'

/** Who can read a concern, one row per reader. The adviser is left out when the concern is about them. */
export function readerAccess({ aboutAdvisor, confidential = false }: Sharing): Array<[string, string]> {
  const overseer = confidential && !aboutAdvisor ? statusOnlyNote : 'Can read it'
  return [
    ['Your adviser', aboutAdvisor ? 'Cannot read it. They are not told about it.' : 'Can read it'],
    ['Your program chair', aboutAdvisor ? 'Can read it. It goes to them instead of your adviser.' : overseer],
    ['The Dean', overseer],
  ]
}

/** Review step: who will read the concern. There is nothing to choose; the consent form comes next. */
export function ReadersChoice({ sharing, adviser }: { sharing: Sharing; adviser?: string }) {
  return (
    <section aria-labelledby="gv-readers">
      <h2 className="gv-sub" id="gv-readers">Who can read this</h2>
      <div className="gv-stack">
        <Facts rows={readerAccess(sharing).map(([who, can]): [string, ReactNode] => [who === 'Your adviser' && adviser && !sharing.aboutAdvisor ? who + ', ' + adviser : who, can])} />
        {sharing.aboutAdvisor
          ? <Alert tone="info" title="Your adviser is left out">You said this concern is about your adviser. Your adviser is not told and cannot open it. Your program chair receives it instead.</Alert>
          : <p className="gv-hint">If your adviser marks it confidential, the Program Chair and the Dean see only its status.</p>}
        <Alert tone="neutral" title="Consent comes before sending">Your report is not sent until you read the consent form and agree to it. The button below opens that form.</Alert>
      </div>
    </section>
  )
}

/** The consent form. Nothing is sent until the student agrees; cancelling leaves the report as it was. */
export function ConsentDialog({ isOpen, onOpenChange, sharing, adviser, wording, pending, onConfirm }: {
  isOpen: boolean; onOpenChange: (open: boolean) => void; sharing: Sharing; adviser?: string; wording: Wording; pending: boolean; onConfirm: () => void
}) {
  const [agreed, setAgreed] = useState(false)
  return (
    <Modal title="Submit this report?" isOpen={isOpen} onOpenChange={onOpenChange}>
      <ModalBody>
        <p>Your consent comes first. Read this, then agree to send the report.</p>
        <div>
          <p><strong>Who can read it</strong></p>
          <ul className="gv-list">{readersOf(sharing, adviser).map((who) => <li key={who}>{who}</li>)}</ul>
        </div>
        <blockquote className="gv-wording">{wording.report}</blockquote>
        <Checkbox isSelected={agreed} onChange={setAgreed}>I have read this and I agree</Checkbox>
      </ModalBody>
      <ModalActions>
        <Button variant="secondary" onPress={() => onOpenChange(false)} isDisabled={pending}>Cancel</Button>
        <Button loading={pending} isDisabled={!agreed} onPress={onConfirm}>Submit report</Button>
      </ModalActions>
    </Modal>
  )
}

// ---------- Talking: the student's choice ----------

function TalkDialog({ mode, isOpen, onOpenChange, reportId, wording, action }: {
  mode: TalkMode; isOpen: boolean; onOpenChange: (open: boolean) => void; reportId: string; wording: Wording; action: PageMutation
}) {
  const meta = modes.find((entry) => entry.id === mode) ?? modes[0]
  const [agreed, setAgreed] = useState(false)
  const [record, setRecord] = useState(false)
  const [preferredAt, setPreferredAt] = useState('')
  // ponytail: a suggested time, not a list of open times. The report data has no handler id, and the consultation pages list only faculty a student shares a class with. Add a picker when the report data carries the handler's open times.
  const save = () => action.mutate({
    action: 'chooseTalkMode',
    recordId: reportId,
    payload: {
      reportId, mode,
      consent: { participate: true, ...(isCall(mode) ? { recordCall: record } : {}) },
      ...(preferredAt ? { preferredAt: campusIso(preferredAt) } : {}),
    },
  }, { onSuccess: () => onOpenChange(false) })
  return (
    <Modal title={meta.title} isOpen={isOpen} onOpenChange={onOpenChange}>
      <ModalBody>
        <blockquote className="gv-wording">{wording.talk[mode]}</blockquote>
        {isCall(mode) && <Checkbox isSelected={record} onChange={setRecord} description="Optional. If you leave this off, we record that you do not allow recording.">{wording.recording.allow.replace(/\.$/, '')}</Checkbox>}
        {mode !== 'chat' && <TextField type="datetime-local" label="Date and time you prefer" description="Optional. Campus time (Philippines). The final time is confirmed with you." value={preferredAt} onChange={setPreferredAt} />}
        <Checkbox isSelected={agreed} onChange={setAgreed}>I have read this and I agree</Checkbox>
        {action.error && <Alert tone="danger" title="Couldn't save your choice">{action.error.message}</Alert>}
      </ModalBody>
      <ModalActions>
        <Button variant="secondary" onPress={() => onOpenChange(false)} isDisabled={action.isPending}>Cancel</Button>
        <Button loading={action.isPending} isDisabled={!agreed} onPress={save}>Save choice</Button>
      </ModalActions>
    </Modal>
  )
}

/** What was chosen, when the student agreed, and the details the person handling the report added. */
function TalkSummary({ talk, viewer }: { talk: Talk; viewer: 'student' | 'handler' }) {
  const student = viewer === 'student'
  const missing = student ? 'Not added yet' : 'Not added'
  const rows: Array<[string, ReactNode]> = [[student ? 'Your choice' : "Student's choice", modeLabel(talk.mode)]]
  if (talk.consentAt) rows.push(['Consent given', formatDateTime(talk.consentAt)])
  if (isCall(talk.mode) && talk.consentAt) rows.push(['Call recording', talk.recordCall ? 'Allowed' : 'Not allowed'])
  if (talk.preferredAt) rows.push([student ? 'Time you suggested' : 'Time suggested', formatDateTime(talk.preferredAt)])
  if (talk.mode && talk.mode !== 'chat') rows.push(['Scheduled for', talk.scheduledAt ? formatDateTime(talk.scheduledAt) : missing])
  if (isCall(talk.mode)) {
    const url = secureLink(talk.meetingLink)
    rows.push(['Meeting link', url
      ? <Link key="link" href={url} target="_blank" rel="noopener noreferrer" variant="standalone" icon="arrow-up-right">Open meeting link<span className="gv-visually-hidden"> (opens in a new tab)</span></Link>
      : talk.meetingLink || missing])
  }
  if (talk.mode === 'face_to_face') rows.push(['Place', talk.place || missing])
  return <Facts rows={rows} />
}

/** Student: four ways to talk, each with its own consent. The current choice can be changed. */
export function TalkChoice({ report, wording, action }: { report: Item; wording: Wording; action: PageMutation }) {
  const talk = readTalk(report)
  const closed = isClosed(report)
  const [picked, setPicked] = useState<TalkMode>()
  return (
    <Panel title="How we will talk">
      <p className="gv-hint">Choose how you would like to talk with {handlerOf(report)}. Each way asks for your consent first, and you can change your choice later.</p>
      {closed && <Alert tone="neutral" title="This report is closed">You can no longer change how you talk.</Alert>}
      {talk.mode && <TalkSummary talk={talk} viewer="student" />}
      <ul className="gv-modes" aria-label="Ways to talk">
        {modes.map((mode) => (
          <li key={mode.id}>
            <button type="button" className="gv-mode" aria-haspopup="dialog" data-current={talk.mode === mode.id || undefined} disabled={closed} onClick={() => { action.reset(); setPicked(mode.id) }}>
              <Icon {...mode.icon} size={24} />
              <span className="gv-mode__text"><strong>{mode.label}</strong><span>{mode.blurb}</span></span>
              {talk.mode === mode.id && (
                <span className="gv-mode__chosen">
                  <Icon name="check" size={16} />
                  <span className="gv-visually-hidden">Current choice</span>
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
      <TalkDialog key={picked ?? 'closed'} mode={picked ?? 'chat'} isOpen={Boolean(picked)} onOpenChange={(open) => { if (!open) setPicked(undefined) }} reportId={text(report.id)} wording={wording} action={action} />
    </Panel>
  )
}

// ---------- Talking: the person handling the report ----------

function TalkDetailsForm({ talk, reportId, action }: { talk: Talk; reportId: string; action: PageMutation }) {
  const call = isCall(talk.mode)
  const [when, setWhen] = useState(campusLocal(talk.scheduledAt || talk.preferredAt))
  const [link, setLink] = useState(talk.meetingLink)
  const [place, setPlace] = useState(talk.place)
  const [linkError, setLinkError] = useState('')
  const [error, setError] = useState('')
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const url = link.trim()
    const where = place.trim()
    const badLink = call && Boolean(url) && !secureLink(url)
    const empty = !when && !(call ? url : where)
    setLinkError(badLink ? 'Use a link that starts with https://' : '')
    setError(empty ? (call ? 'Add a time or a meeting link to save.' : 'Add a time or a place to save.') : '')
    if (badLink || empty) return
    action.mutate({
      action: 'setTalkDetails',
      recordId: reportId,
      payload: { reportId, ...(when ? { scheduledAt: campusIso(when) } : {}), ...(call && url ? { meetingLink: url } : {}), ...(!call && where ? { place: where } : {}) },
    })
  }
  return (
    <form className="gv-stack" onSubmit={submit} noValidate>
      <h3 className="gv-subhead">{call ? 'Add the time and meeting link' : 'Add the time and place'}</h3>
      <TextField type="datetime-local" label="Date and time" description="Campus time (Philippines). The student sees this." value={when} onChange={setWhen} />
      {call
        ? <TextField type="url" label="Meeting link" description="The student sees this and opens it in a new tab." value={link} onChange={setLink} maxLength={500} isInvalid={Boolean(linkError)} errorMessage={linkError} />
        : <TextField label="Place" description="The student sees this." value={place} onChange={setPlace} maxLength={200} />}
      {error && <Alert tone="danger" title="Check the details">{error}</Alert>}
      {action.error && <Alert tone="danger" title="Couldn't save the details">{action.error.message}</Alert>}
      <div><Button type="submit" loading={action.isPending}>Save details</Button></div>
    </form>
  )
}

/** Handler: the student's choice and consent, with a form for the time, link or place once a call or meeting is chosen. */
export function HandlerTalk({ report, action }: { report: Item; action: PageMutation }) {
  const talk = readTalk(report)
  const canAct = Array.isArray(report.allowedActions) && report.allowedActions.length > 0 && !isClosed(report)
  return (
    <Panel title="How we will talk">
      {talk.mode ? (
        <>
          <TalkSummary talk={talk} viewer="handler" />
          {canAct && talk.mode !== 'chat' && <TalkDetailsForm key={talk.mode} talk={talk} reportId={text(report.id)} action={action} />}
        </>
      ) : <Empty title="No choice yet">The student has not said how they would like to talk. It will show here when they do.</Empty>}
    </Panel>
  )
}

// ---------- Who can see the report ----------

/** Student: who can read the report. Handler: the consent that came with it, and who else it is shared with. */
export function AccessPanel({ access, viewer }: { access: Access; viewer: 'student' | 'handler' }) {
  const student = viewer === 'student'
  const consent = access.consentAt ? 'Given ' + formatDateTime(access.consentAt) : 'Not recorded'
  const rows: Array<[string, ReactNode]> = student
    ? [
      ...readerAccess(access).map(([who, can]): [string, ReactNode] => [who.replace(/^Your program chair$/, 'Program chair'), can]),
      ['Your consent', consent],
    ]
    : [
      ['Student consent', consent],
      ['Also readable by', alsoReadableBy(access)],
      ...(access.aboutAdvisor ? [['About the adviser', 'Yes. The adviser was not told.'] as [string, ReactNode]] : []),
    ]
  return (
    <Panel title={student ? 'Who can see this' : 'Consent and access'}>
      <Facts rows={rows} />
      {!student && access.wording && <details className="gv-details"><summary>What the student agreed to</summary><p className="gv-wording">{access.wording}</p></details>}
    </Panel>
  )
}

/** For a handler: who else reads the concern besides the office handling it. */
export function alsoReadableBy(access: Sharing) {
  return access.confidential && !access.aboutAdvisor ? 'Program chair and Dean, status only (marked confidential)' : 'Program chair and Dean'
}
