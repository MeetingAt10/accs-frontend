import {
  Alert, Button, Modal, ModalActions, ModalBody, Radio, RadioGroup, Select, SelectOption, TextArea, TextField, toast,
} from '@meetingat10/design-system/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { apiErrorText, performPageAction, type PageAction } from '@/lib/api'
import { formatDate, formatDateTime } from '@/lib/format'
import { Empty, Panel, StatusChip, type Tone } from '@/components/app/page-shell'
import './strikes.css'

// Strikes (decided 11 November 2026): the Dean recommends a strike while a case is with the Dean, against a student the
// concern names; OSAS confirms or rejects it once the case reaches OSAS. Only a confirmed strike counts, and three unsettled
// strikes put the student's clearance on hold until OSAS records a settlement (letter or reprimand).

type Item = Record<string, unknown>
const object = (value: unknown): Item => value && typeof value === 'object' && !Array.isArray(value) ? value as Item : {}
const list = (value: unknown): Item[] => Array.isArray(value) ? value.map(object) : []
const text = (value: unknown, fallback = '') => typeof value === 'string' || typeof value === 'number' ? String(value) : fallback
const nameOf = (value: unknown) => text(object(value).name)

export type StrikeStatus = 'recommended' | 'confirmed' | 'rejected'
const statuses: Record<StrikeStatus, { label: string; tone: Tone }> = {
  recommended: { label: 'Recommended', tone: 'warn' },
  confirmed: { label: 'Confirmed', tone: 'danger' },
  rejected: { label: 'Rejected', tone: 'neutral' },
}
/** A strike from before recommendations has no status; it counts as confirmed, as the API treats it. */
export const strikeStatus = (strike: Item): StrikeStatus => text(strike.status) in statuses ? text(strike.status) as StrikeStatus : 'confirmed'

/** Who recommended the strike and who decided it, in one line. */
export function strikePeople(strike: Item) {
  const status = strikeStatus(strike)
  const by = nameOf(strike.recommendedBy)
  const decided = nameOf(strike.recordedBy)
  const parts = [by && 'Recommended by ' + by]
  if (status === 'confirmed') parts.push(decided && (by ? 'confirmed by ' : 'Recorded by ') + decided)
  if (status === 'rejected') parts.push(decided && 'rejected by ' + decided)
  return parts.filter(Boolean).join(', ')
}

function useStrikeAction(pageId: 'P22' | 'P34') {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (action: PageAction) => performPageAction(pageId, action),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['page'] })
      toast(result.message, { tone: 'success' })
    },
  })
}

function StrikeRows({ strikes, showStudent = false, showCase = true }: { strikes: Item[]; showStudent?: boolean; showCase?: boolean }) {
  return (
    <ul className="accs-rows" aria-label="Strikes">
      {strikes.map((strike) => {
        const status = strikeStatus(strike)
        const people = strikePeople(strike)
        return (
          <li key={text(strike.id)} className="accs-row st-row">
            <div className="st-row__body">
              <p className="st-row__title">
                {showStudent ? nameOf(strike.student) || 'Student' : showCase ? 'Case ' + text(strike.caseReference, '—') : 'Strike'}
                <StatusChip tone={statuses[status].tone}>{statuses[status].label}</StatusChip>
                {strike.settled === true && <span className="accs-tag">Settled</span>}
              </p>
              {people && <p className="st-row__meta">{people}</p>}
              {text(strike.note) && <p className="st-row__note">{text(strike.note)}</p>}
              {text(strike.decisionNote) && <p className="st-row__note">{status === 'rejected' ? 'Reason: ' : 'OSAS: '}{text(strike.decisionNote)}</p>}
            </div>
            <time className="st-row__time" dateTime={text(strike.decidedAt, text(strike.at))}>{formatDate(strike.decidedAt ?? strike.at)}</time>
          </li>
        )
      })}
    </ul>
  )
}

/** Case page (P22): the Dean recommends, OSAS confirms or rejects, and both see the case's strikes. */
export function CaseStrikes({ report }: { report: Item }) {
  const canRecommend = report.canRecommendStrike === true
  const canDecide = report.canDecideStrike === true
  const strikes = list(report.strikes)
  if (!canRecommend && !canDecide && !strikes.length) return null
  const pending = strikes.filter((strike) => strikeStatus(strike) === 'recommended')
  return (
    <Panel title="Strikes">
      {canRecommend && <RecommendStrike report={report} strikes={strikes} />}
      {canDecide && (pending.length
        ? <div className="accs-stack accs-stack--tight">{pending.map((strike) => <DecideStrike key={text(strike.id)} strike={strike} />)}</div>
        : !strikes.length && <p className="st-hint">The Dean recommended no strike on this case.</p>)}
      {strikes.length > 0 && <StrikeRows strikes={strikes} showStudent />}
    </Panel>
  )
}

function RecommendStrike({ report, strikes }: { report: Item; strikes: Item[] }) {
  const candidates = list(report.strikeCandidates)
  // A student who already has a strike on this case that was not rejected cannot get another.
  const taken = new Set(strikes.filter((strike) => strikeStatus(strike) !== 'rejected').map((strike) => text(object(strike.student).id)))
  const open = candidates.filter((person) => !taken.has(text(person.id)))
  const [studentId, setStudentId] = useState('')
  const [note, setNote] = useState('')
  const action = useStrikeAction('P22')
  if (!candidates.length) return <p className="st-hint">This concern names no student, so there is no one to recommend a strike against.</p>
  if (!open.length) return <p className="st-hint">Every student this concern names already has a strike on it.</p>
  const chosen = open.some((person) => text(person.id) === studentId) ? studentId : ''
  const send = () => action.mutate(
    { action: 'recommendStrike', payload: { studentId: chosen, reportId: text(report.id), note: note.trim() } },
    { onSuccess: () => { setStudentId(''); setNote('') } },
  )
  return (
    <form className="accs-stack accs-stack--tight" onSubmit={(event) => { event.preventDefault(); if (chosen && note.trim()) send() }}>
      <p className="st-hint">Recommend a strike against a student this concern names. OSAS confirms or rejects it when the case reaches them; only a confirmed strike counts.</p>
      <Select label="Student" placeholder="Choose a student" isRequired selectedKey={chosen || null} onSelectionChange={(key) => setStudentId(String(key ?? ''))}>
        {open.map((person) => <SelectOption id={text(person.id)} key={text(person.id)}>{[nameOf(person), text(person.studentId)].filter(Boolean).join(' · ')}</SelectOption>)}
      </Select>
      <TextArea label="Note for OSAS" isRequired maxLength={1000} value={note} onChange={setNote} description="What happened, and why it should count as a strike." />
      {action.error && <Alert tone="danger" title="The strike was not recommended">{apiErrorText(action.error)}</Alert>}
      <div><Button type="submit" loading={action.isPending} isDisabled={!chosen || !note.trim()}>Recommend a strike</Button></div>
    </form>
  )
}

function DecideStrike({ strike }: { strike: Item }) {
  const [decision, setDecision] = useState<'confirm' | 'reject' | ''>('')
  const [note, setNote] = useState('')
  const action = useStrikeAction('P22')
  const close = () => { setDecision(''); setNote(''); action.reset() }
  const send = () => action.mutate({ action: 'decideStrike', payload: { strikeId: text(strike.id), decision, note: note.trim() } }, { onSuccess: close })
  const reject = decision === 'reject'
  return (
    <div className="st-decide">
      <p><strong>{nameOf(strike.student) || 'Student'}</strong>: recommended by {nameOf(strike.recommendedBy) || 'the Dean'}{text(strike.at) ? ' on ' + formatDate(strike.at) : ''}.</p>
      {text(strike.note) && <p className="st-row__note">{text(strike.note)}</p>}
      <div className="st-actions">
        <Button onPress={() => setDecision('confirm')}>Confirm</Button>
        <Button variant="secondary" onPress={() => setDecision('reject')}>Reject</Button>
      </div>
      <Modal role="alertdialog" title={reject ? 'Reject this strike?' : 'Confirm this strike?'} isOpen={Boolean(decision)} onOpenChange={(open) => !open && close()}>
        <ModalBody>
          <p>{reject ? 'A rejected strike does not count.' : 'A confirmed strike counts toward the student’s clearance. Three unsettled strikes put it on hold.'}</p>
          <TextArea label={reject ? 'Reason' : 'Note'} isRequired={reject} maxLength={1000} value={note} onChange={setNote} description={reject ? 'Required. Kept with the strike.' : 'Optional. Kept with the strike.'} />
          {action.error && <Alert tone="danger" title="Nothing was saved">{apiErrorText(action.error)}</Alert>}
        </ModalBody>
        <ModalActions>
          <Button variant="secondary" onPress={close} isDisabled={action.isPending}>Cancel</Button>
          <Button variant={reject ? 'destructive' : 'primary'} loading={action.isPending} isDisabled={reject && !note.trim()} onPress={send}>{reject ? 'Reject strike' : 'Confirm strike'}</Button>
        </ModalActions>
      </Modal>
    </div>
  )
}

/** Student record (P34): clearance with its reasons, the student's strikes, settlements, and OSAS's settlement form. */
export function StudentStrikes({ record, studentId }: { record: Item; studentId: string }) {
  const strikes = list(record.strikes)
  const settlements = list(record.strikeSettlements)
  const clearance = object(record.clearance)
  const status = object(record.clearanceStatus)
  const reasons = list(status.reasons)
  const onHold = text(status.status) === 'on_hold'
  return (
    <div className="accs-stack">
      <Panel title="Clearance">
        <p className="st-clearance"><StatusChip tone={onHold ? 'warn' : 'ok'}>{text(status.label, onHold ? 'On hold' : 'Clear')}</StatusChip>
          {clearance.limit !== undefined && <span className="st-hint">{text(clearance.unsettledStrikes, '0')} of {text(clearance.limit)} unsettled strikes · {text(clearance.totalStrikes, '0')} on record</span>}</p>
        {reasons.length > 0 && <ul className="st-list">{reasons.map((reason, index) => <li key={text(reason.kind) + index}>{text(reason.message)}</li>)}</ul>}
      </Panel>
      <Panel title="Strikes">
        {strikes.length ? <StrikeRows strikes={strikes} /> : <Empty title="No strikes">Strikes the Dean recommends and OSAS confirms show here.</Empty>}
      </Panel>
      {settlements.length > 0 && (
        <Panel title="Settlements">
          <ul className="accs-rows">
            {settlements.map((entry) => (
              <li key={text(entry.id)} className="accs-row st-row">
                <div className="st-row__body">
                  <p className="st-row__title">{text(entry.kind) === 'letter' ? 'Letter' : 'Reprimand'} <span className="accs-mono">{text(entry.reference)}</span></p>
                  <p className="st-row__meta">Settled {text(entry.strikeCount, '0')} strikes{nameOf(entry.settledBy) ? ' · recorded by ' + nameOf(entry.settledBy) : ''}</p>
                  {text(entry.note) && <p className="st-row__note">{text(entry.note)}</p>}
                </div>
                <time className="st-row__time" dateTime={text(entry.at)}>{formatDateTime(entry.at)}</time>
              </li>
            ))}
          </ul>
        </Panel>
      )}
      {record.canRecordStrikes === true && clearance.onHold === true && <SettleStrikes studentId={studentId} />}
    </div>
  )
}

function SettleStrikes({ studentId }: { studentId: string }) {
  const [kind, setKind] = useState<'letter' | 'reprimand'>('reprimand')
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const action = useStrikeAction('P34')
  const send = () => action.mutate({ action: 'settleStrikes', payload: { studentId, kind, reference: reference.trim(), note: note.trim() } }, { onSuccess: () => { setReference(''); setNote('') } })
  return (
    <Panel title="Record a settlement">
      <form className="accs-stack accs-stack--tight" onSubmit={(event) => { event.preventDefault(); if (reference.trim()) send() }}>
        <p className="st-hint">Settling lifts the clearance hold. The strikes stay on the record.</p>
        <RadioGroup label="Settled by" value={kind} onChange={(value) => setKind(value as 'letter' | 'reprimand')} orientation="horizontal">
          <Radio value="reprimand">Reprimand</Radio>
          <Radio value="letter">Letter</Radio>
        </RadioGroup>
        <TextField label="Reference" isRequired maxLength={100} value={reference} onChange={setReference} description="The number on the letter or reprimand." />
        <TextArea label="Note" maxLength={1000} value={note} onChange={setNote} description="Optional." />
        {action.error && <Alert tone="danger" title="The settlement was not recorded">{apiErrorText(action.error)}</Alert>}
        <div><Button type="submit" loading={action.isPending} isDisabled={!reference.trim()}>Record settlement</Button></div>
      </form>
    </Panel>
  )
}
