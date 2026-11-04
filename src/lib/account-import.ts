import type { Credentials, NewStudent, Program } from '@/lib/api'

// Reading the registrar's class list and checking each student the way the server will, so mistakes show before anything
// is created. Pure functions, no browser APIs: the spreadsheet itself is read by `read-excel-file` in the page.

/** A request creates at most this many accounts: hashing a password is slow and a request is cut off after a few seconds. */
export const batchLimit = 25

export const programs: Program[] = ['BSIT', 'BSCS', 'BSIS']
export const programNames: Record<Program, string> = {
  BSIT: 'Information Technology',
  BSCS: 'Computer Science',
  BSIS: 'Information Systems',
}

export const chunk = <T>(items: T[], size = batchLimit) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size))

const fields = ['name', 'email', 'studentId', 'program', 'year', 'section'] as const
export type StudentField = (typeof fields)[number]
/** What was typed or read from a cell, before it is checked. */
export type StudentDraft = Record<StudentField, string>
export type StudentProblems = Partial<Record<StudentField, string>>
export type ParsedStudent = { row: number; draft: StudentDraft; problems: StudentProblems }

export const emptyStudent: StudentDraft = { name: '', email: '', studentId: '', program: '', year: '', section: '' }

export const columnLabels: Record<StudentField, string> = {
  name: 'Name',
  email: 'Email or Gmail',
  studentId: 'Student ID',
  program: 'Program',
  year: 'Year',
  section: 'Section',
}

export const isEmail = (value: string) => value.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

/** The same checks the server makes on a student, with its wording. */
export function studentProblems(draft: StudentDraft): StudentProblems {
  const problems: StudentProblems = {}
  const name = draft.name.trim()
  if (name.length < 2) problems.name = 'Enter the full name.'
  else if (name.length > 100) problems.name = 'Use at most 100 characters.'
  if (!isEmail(draft.email.trim())) problems.email = 'Enter a valid email address.'
  if (!/^[A-Za-z0-9][A-Za-z0-9-]{2,39}$/.test(draft.studentId.trim())) problems.studentId = 'Use letters, numbers, and dashes, like 24-1234.'
  if (!programs.includes(draft.program as Program)) problems.program = 'Choose BSIT, BSCS, or BSIS.'
  if (!/^[1-4]$/.test(draft.year.trim())) problems.year = 'Choose a year level from 1 to 4.'
  if (!/^[A-Za-z0-9]{1,10}$/.test(draft.section.trim())) problems.section = 'Use the section letter, like A.'
  return problems
}

export const toStudent = (draft: StudentDraft): NewStudent => ({
  name: draft.name.trim(),
  email: draft.email.trim(),
  studentId: draft.studentId.trim(),
  program: draft.program as Program,
  year: Number(draft.year),
  section: draft.section.trim().toUpperCase(),
})

// --- reading the sheet -----------------------------------------------------------------------------------------------

const aliases: Record<StudentField, string[]> = {
  name: ['name', 'fullname', 'studentname'],
  email: ['email', 'emailaddress', 'gmail', 'gmailaddress', 'gmailaccount'],
  studentId: ['studentid', 'studentnumber', 'studentno', 'studno', 'idnumber', 'idno', 'id', 'number'],
  program: ['program', 'course'],
  year: ['year', 'yearlevel', 'yearlvl'],
  section: ['section'],
}

const normal = (value: unknown) => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
const columnOf = (row: unknown[], field: StudentField) => row.findIndex((cell) => aliases[field].includes(normal(cell)))
const cellText = (value: unknown) => (value == null || value instanceof Date ? '' : String(value).trim())

/** "BS Information Technology", "it" and "BSIT" all mean BSIT. Anything else is left for the checks to refuse. */
export function programOf(value: string) {
  const key = value.toUpperCase().replace(/[^A-Z]/g, '')
  if (/^(BS)?IT$|INFORMATIONTECHNOLOGY/.test(key)) return 'BSIT'
  if (/^(BS)?CS$|COMPUTERSCIENCE/.test(key)) return 'BSCS'
  if (/^(BS)?IS$|INFORMATIONSYSTEM/.test(key)) return 'BSIS'
  return value.trim()
}

/** "3", 3 and "3rd Year" all mean 3. */
export function yearOf(value: string) {
  const digits = value.replace(/\D/g, '')
  return /^[1-4]$/.test(digits) ? digits : value.trim()
}

/**
 * Turns the rows of a sheet into students. The heading is whichever of the first ten rows names the most of our columns,
 * so a title above it is fine. `missing` lists the columns it could not find; then there are no students.
 */
export function parseStudentRows(rows: unknown[][]) {
  let heading = -1
  let best = 0
  rows.slice(0, 10).forEach((row, index) => {
    const found = fields.filter((field) => columnOf(row, field) >= 0).length
    if (found > best) {
      best = found
      heading = index
    }
  })
  const columns = heading < 0 ? undefined : (Object.fromEntries(fields.map((field) => [field, columnOf(rows[heading]!, field)])) as Record<StudentField, number>)
  const missing = fields.filter((field) => !columns || columns[field] < 0)
  const students: ParsedStudent[] = []
  if (!columns || missing.length) return { students, missing }

  const seen = { email: new Map<string, number>(), studentId: new Map<string, number>() }
  rows.slice(heading + 1).forEach((row, offset) => {
    const draft = Object.fromEntries(fields.map((field) => [field, cellText(row[columns[field]])])) as StudentDraft
    if (!Object.values(draft).some(Boolean)) return
    draft.program = programOf(draft.program)
    draft.year = yearOf(draft.year)
    draft.section = draft.section.replace(/^section\s*/i, '')
    const rowNumber = heading + offset + 2
    const problems = studentProblems(draft)
    for (const key of ['email', 'studentId'] as const) {
      const value = draft[key].toLowerCase()
      const first = value ? seen[key].get(value) : undefined
      if (first !== undefined) problems[key] ??= key === 'email' ? `Same email as row ${first}.` : `Same student ID as row ${first}.`
      else if (value) seen[key].set(value, rowNumber)
    }
    students.push({ row: rowNumber, draft, problems })
  })
  return { students, missing }
}

// --- the credentials file --------------------------------------------------------------------------------------------

export type IssuedStudent = { student: NewStudent; credentials: Credentials; signInUrl: string }

// A spreadsheet reads a cell that starts with = + - or @ as a formula. Text that came from the uploaded list gets a
// leading quote; the generated username and password do not, because a quote would become part of the password.
const csvCell = (value: string, guard = false) => {
  const text = guard && /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

/** The sign-in details of the students just created, as CSV text for the secretary to hand out. Built here, never sent anywhere. */
export function credentialsCsv(rows: IssuedStudent[]) {
  const header = ['Name', 'Email', 'Student ID', 'Program', 'Year', 'Section', 'Username', 'Temporary password', 'Sign-in link']
  const lines = rows.map(({ student: s, credentials: c, signInUrl }) => [
    csvCell(s.name, true),
    csvCell(s.email, true),
    csvCell(s.studentId, true),
    s.program,
    String(s.year),
    csvCell(s.section, true),
    csvCell(c.username),
    csvCell(c.temporaryPassword),
    csvCell(signInUrl),
  ])
  // The byte order mark makes Excel read names with accents correctly.
  return '﻿' + [header, ...lines].map((line) => line.join(',')).join('\r\n') + '\r\n'
}
