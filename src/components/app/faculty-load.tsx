import { Alert, Button, DatePicker, Select, SelectOption, TextField, ViewState, toast } from '@meetingat10/design-system/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter, useRouterState } from '@tanstack/react-router'
import { useState, type ChangeEvent } from 'react'

import { ApiError, performPageAction, type PageAction, type PageEnvelope } from '@/lib/api'
import { formatDate } from '@/lib/format'
import { pageQuery } from '@/lib/queries'
import { Empty, PageHeader, Panel, StatusChip } from '@/components/app/page-shell'
import { PagedList } from '@/components/app/paging'
import './faculty-load.css'

// Faculty load (P54, MeetingAt10/accs-backend#39): the CCS Secretary uploads each term's class schedule as a CSV file, and
// open appointment times that fall in a class are listed as overlaps. A load with any bad row is not saved; every problem
// comes back by row.

type Item = Record<string, unknown>
const object = (value: unknown): Item => value && typeof value === 'object' && !Array.isArray(value) ? value as Item : {}
const items = (value: unknown): Item[] => Array.isArray(value) ? value.map(object) : []
const text = (value: unknown, fallback = '') => typeof value === 'string' || typeof value === 'number' ? String(value) : fallback

export type LoadRow = { facultyEmail: string; day: string; start: string; end: string; subject: string; section?: string; room?: string }

/** Splits CSV text into rows of cells, honouring quoted cells with commas, quotes and line breaks. */
export function parseCsv(input: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  const source = input.replace(/^﻿/, '')
  for (let i = 0; i < source.length; i++) {
    const char = source[i]
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') { cell += '"'; i++ }
      else if (char === '"') quoted = false
      else cell += char
    } else if (char === '"') quoted = true
    else if (char === ',') { row.push(cell); cell = '' }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') i++
      row.push(cell); rows.push(row); row = []; cell = ''
    } else cell += char
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row) }
  return rows.filter((cells) => cells.some((value) => value.trim() !== ''))
}

const headerNames: Record<string, keyof LoadRow> = {
  facultyemail: 'facultyEmail', email: 'facultyEmail', faculty: 'facultyEmail', day: 'day', start: 'start', end: 'end',
  subject: 'subject', section: 'section', room: 'room',
}

/** The load rows from a CSV file with a header row. Unknown columns are ignored; a missing required column is reported. */
export function loadRowsFromCsv(input: string): { rows: LoadRow[]; missing: string[] } {
  const [header = [], ...body] = parseCsv(input)
  const columns = header.map((name) => headerNames[name.trim().toLowerCase().replace(/[\s_-]/g, '')])
  const missing = (['facultyEmail', 'day', 'start', 'end', 'subject'] as const).filter((name) => !columns.includes(name))
  const rows = body.map((cells) => {
    const row: Partial<LoadRow> = {}
    columns.forEach((name, index) => { if (name && cells[index]?.trim()) row[name] = cells[index].trim() })
    return row as LoadRow
  })
  return { rows, missing: missing.map((name) => ({ facultyEmail: 'facultyEmail (or email)', day: 'day', start: 'start', end: 'end', subject: 'subject' })[name]) }
}

/** API problems grouped by row number (1 is the first row under the header). */
export function rowProblems(error: unknown): Array<{ row: number; messages: string[] }> {
  if (!(error instanceof ApiError) || !error.fields) return []
  const byRow = new Map<number, string[]>()
  for (const field of error.fields) {
    const match = /^rows\.(\d+)(?:\.(\w+))?/.exec(field.path)
    if (!match) continue
    const row = Number(match[1]) + 1
    byRow.set(row, [...(byRow.get(row) ?? []), (match[2] ? match[2] + ': ' : '') + field.message])
  }
  return [...byRow.entries()].sort((a, b) => a[0] - b[0]).map(([row, messages]) => ({ row, messages }))
}

function useLoadAction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (action: PageAction) => performPageAction('P54', action),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['page'] })
      toast(result.message, { tone: 'success' })
    },
  })
}

function UploadLoad({ onSaved }: { onSaved: (term: string) => void }) {
  const [term, setTerm] = useState('')
  const [startsOn, setStartsOn] = useState('')
  const [endsOn, setEndsOn] = useState('')
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<LoadRow[]>([])
  const [fileError, setFileError] = useState('')
  const action = useLoadAction()
  const problems = rowProblems(action.error)
  const saved = action.data?.record ? object(action.data.record) : undefined
  const fieldError = (path: string) => action.error instanceof ApiError ? action.error.fields?.find((field) => field.path === path)?.message : undefined
  const readFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    // Cleared so choosing the same file again, after fixing it, reads it again.
    event.target.value = ''
    action.reset()
    setRows([])
    setFileName(file?.name ?? '')
    if (!file) return
    if (file.size > 1_000_000) { setFileError('The file is too large. Use a CSV file under 1 MB.'); return }
    const parsed = loadRowsFromCsv(await file.text())
    if (parsed.missing.length) { setFileError('The first row must name the columns. Missing: ' + parsed.missing.join(', ') + '.'); return }
    if (!parsed.rows.length) { setFileError('The file has no classes under the header row.'); return }
    if (parsed.rows.length > 500) { setFileError('Upload at most 500 classes at a time.'); return }
    setFileError('')
    setRows(parsed.rows)
  }
  const ready = Boolean(term.trim() && startsOn && endsOn && rows.length && !fileError)
  const save = () => action.mutate(
    { action: 'uploadLoadSchedule', payload: { term: term.trim(), startsOn, endsOn, rows } },
    { onSuccess: () => { onSaved(term.trim()); setRows([]); setFileName('') } },
  )
  return (
    <Panel title="Upload a load">
      <form className="fl-form" onSubmit={(event) => { event.preventDefault(); if (ready) save() }}>
        <div className="fl-grid">
          <TextField label="Term" isRequired maxLength={60} value={term} onChange={setTerm} description="For example 1st Semester AY 2026-2027." isInvalid={Boolean(fieldError('term'))} errorMessage={fieldError('term')} />
          <DatePicker label="Classes start" isRequired onChange={(value) => setStartsOn(value?.toString() ?? '')} isInvalid={Boolean(fieldError('startsOn'))} errorMessage={fieldError('startsOn')} />
          <DatePicker label="Classes end" isRequired onChange={(value) => setEndsOn(value?.toString() ?? '')} isInvalid={Boolean(fieldError('endsOn'))} errorMessage={fieldError('endsOn')} />
        </div>
        <label className="fl-file">
          <span className="fl-file__label">Load file (CSV)</span>
          <input type="file" accept=".csv,text/csv" onChange={(event) => void readFile(event)} />
          <span className="fl-hint">
            Columns: facultyEmail, day (Mon to Sat), start and end (24-hour, like 07:30), subject, and optionally section and room.
            Uploading again replaces those faculty members' classes for the term.
          </span>
        </label>
        {fileError && <Alert tone="danger" title="Check the file">{fileError}</Alert>}
        {rows.length > 0 && !fileError && <p className="fl-hint">{fileName}: {rows.length} {rows.length === 1 ? 'class' : 'classes'} ready to upload.</p>}
        {problems.length > 0 && (
          <Alert tone="danger" title={`Nothing was saved. Fix ${problems.length} ${problems.length === 1 ? 'row' : 'rows'} and upload again.`}>
            <ul className="fl-problems">
              {problems.map((problem) => <li key={problem.row}><strong>Row {problem.row}</strong>: {problem.messages.join('; ')}</li>)}
            </ul>
          </Alert>
        )}
        {action.error && !problems.length && !(action.error instanceof ApiError && action.error.fields?.length) && <Alert tone="danger" title="The load was not saved">{action.error.message}</Alert>}
        {saved && (
          <Alert tone={Number(saved.conflicts) ? 'warning' : 'success'} title={action.data?.message ?? 'Load saved.'}>
            {text(saved.classes)} classes for {text(saved.faculty)} faculty in {text(saved.term)}.
          </Alert>
        )}
        <div><Button type="submit" loading={action.isPending} isDisabled={!ready}>Upload load</Button></div>
      </form>
    </Panel>
  )
}

function FacultyLoadScreen({ page }: { page: PageEnvelope }) {
  const router = useRouter()
  const location = useRouterState({ select: (state) => state.location })
  const terms = items(page.data.terms)
  const term = object(page.data.term)
  const faculty = items(page.data.faculty)
  const withClasses = faculty.filter((person) => items(person.classes).length)
  const conflicts = faculty.reduce((total, person) => total + items(person.conflicts).length, 0)
  const showTerm = (value: string) => router.history.replace(location.pathname + (value ? '?period=' + encodeURIComponent(value) : ''))
  return (
    <div className="accs-stack">
      <PageHeader
        title="Faculty load"
        description={text(term.term) ? `${text(term.term)} · ${formatDate(term.startsOn)} to ${formatDate(term.endsOn)}` : 'No load uploaded yet.'}
      />
      <UploadLoad onSaved={showTerm} />
      {terms.length > 1 && (
        <div className="fl-term">
          <Select label="Term" selectedKey={text(term.term) || null} onSelectionChange={(key) => showTerm(String(key ?? ''))}>
            {terms.map((entry) => <SelectOption id={text(entry.term)} key={text(entry.term)}>{text(entry.term)}</SelectOption>)}
          </Select>
        </div>
      )}
      {conflicts > 0 && (
        <Alert tone="warning" title={`${conflicts} appointment ${conflicts === 1 ? 'time overlaps' : 'times overlap'} a class`}>
          The faculty members below should move or remove these times.
        </Alert>
      )}
      <Panel flush title="Faculty" action={<span className="accs-mono">{withClasses.length} of {faculty.length} with classes</span>}>
        {faculty.length ? (
          <PagedList items={faculty} noun="faculty">
            {(shown) => (
              <ul className="accs-rows">
                {shown.map((person) => {
                  const classes = items(person.classes)
                  const overlaps = items(person.conflicts)
                  return (
                    <li key={text(person.id)} className="accs-row fl-row">
                      <div className="fl-row__body">
                        <p className="fl-row__name">
                          {text(person.name)}
                          {overlaps.length > 0 && <StatusChip tone="warn">{overlaps.length} {overlaps.length === 1 ? 'overlap' : 'overlaps'}</StatusChip>}
                        </p>
                        <p className="fl-hint">{text(person.email)} · {classes.length} {classes.length === 1 ? 'class' : 'classes'}</p>
                        {classes.length > 0 && (
                          <p className="fl-classes">
                            {classes.map((entry) => `${text(entry.day)} ${text(entry.start)}–${text(entry.end)} ${text(entry.subject)}${text(entry.section) ? ' (' + text(entry.section) + ')' : ''}`).join(' · ')}
                          </p>
                        )}
                        {overlaps.map((entry) => (
                          <p className="fl-overlap" key={text(entry.slotId)}>
                            Appointment time {formatDate(entry.date)} {text(entry.start)}–{text(entry.end)} overlaps {text(entry.subject)} ({text(entry.day)} {text(entry.classStart)}–{text(entry.classEnd)})
                          </p>
                        ))}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </PagedList>
        ) : <Empty title="No faculty accounts">Faculty show here once their accounts exist.</Empty>}
      </Panel>
    </div>
  )
}

export function FacultyLoadPage() {
  const filters = useRouterState({ select: (state) => state.location.searchStr.replace(/^\?/, '') })
  const page = useQuery(pageQuery('P54', undefined, filters))
  if (page.isPending) return <ViewState kind="loading" title="Loading faculty load" />
  if (page.isError) return <ViewState kind="error" title="Faculty load didn't load" description={page.error.message} actions={<Button variant="secondary" onPress={() => void page.refetch()}>Try again</Button>} />
  return <FacultyLoadScreen page={page.data} />
}
