import { describe, expect, it } from 'vitest'

import { chunk, credentialsCsv, parseStudentRows, studentProblems, toStudent } from './account-import'

// A title and a blank row above the headings, loose heading names, and one row of each kind.
const sheet: unknown[][] = [
  ['Quezon City University - CCS masterlist'],
  [],
  ['Student No.', 'FULL NAME', 'Gmail Address', 'Course', 'Year Level', 'Section'],
  ['24-1234', 'Ana Reyes', 'ana.reyes@gmail.com', 'BS Information Technology', '3rd Year', 'a'],
  [24056, 'Ben Cruz', 'ben@gmail.com', 'CS', 2, 'B'],
  ['24-1234', 'Dup Person', 'dup@gmail.com', 'IS', '1', 'C'],
  ['', '', '', '', '', ''],
  ['24-9999', 'X', 'not-an-email', 'BSIT', '5', ''],
]

describe('class list import', () => {
  it('finds the headings, numbers rows as the sheet does, and normalizes cells', () => {
    const { students, missing } = parseStudentRows(sheet)
    expect(missing).toEqual([])
    expect(students.map((student) => student.row)).toEqual([4, 5, 6, 8])
    expect(students[0]!.draft).toMatchObject({ studentId: '24-1234', program: 'BSIT', year: '3', section: 'a' })
    expect(students[0]!.problems).toEqual({})
    expect(toStudent(students[0]!.draft)).toMatchObject({ program: 'BSIT', year: 3, section: 'A' })
    expect(students[1]!.draft).toMatchObject({ studentId: '24056', program: 'BSCS', year: '2' })
    // The server takes 00-0000 only, so a bare number is flagged before anything is sent.
    expect(students[1]!.problems).toEqual({ studentId: 'Use the format 00-0000, with the enrollment year first, like 26-0001.' })
  })

  it('flags a repeated student ID and rows the server would refuse', () => {
    const { students } = parseStudentRows(sheet)
    expect(students[2]!.problems).toEqual({ studentId: 'Same student ID as row 4.' })
    expect(Object.keys(students[3]!.problems).sort()).toEqual(['email', 'name', 'section', 'year'])
  })

  it('lists the columns it cannot find', () => {
    const result = parseStudentRows([['Name', 'Email'], ['A B', 'a@b.co']])
    expect(result.missing).toEqual(['studentId', 'program', 'year', 'section'])
    expect(result.students).toEqual([])
  })

  it('splits a list into batches', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })
})

describe('credentials file', () => {
  const student = { name: '=cmd, "x"', email: 'a@b.co', studentId: '24-1', program: 'BSIT' as const, year: 1, section: 'A' }
  const csv = credentialsCsv([{ student, credentials: { username: 'ana.k7f3', temporaryPassword: '-Ab3x,y' }, signInUrl: 'https://x.test/sign-in' }])

  it('starts with a byte order mark and the headings', () => {
    expect(csv.startsWith('﻿Name,Email,Student ID,')).toBe(true)
  })

  it('quotes list text that could run as a formula, but never alters the password', () => {
    expect(csv).toContain(`"'=cmd, ""x"""`)
    expect(csv).toContain('"-Ab3x,y"')
  })
})

describe('sections (QA 17 November: section 200 was accepted)', () => {
  it('takes letters only', () => {
    const base = { name: 'Ana Reyes', email: 'ana@example.com', studentId: '26-7001', program: 'BSIT', year: '1', section: 'A' }
    expect(studentProblems(base).section).toBeUndefined()
    expect(studentProblems({ ...base, section: 'ab' }).section).toBe('Use the section letter, like A.')
    expect(studentProblems({ ...base, section: '200' }).section).toBe('Use the section letter, like A.')
    expect(studentProblems({ ...base, section: 'A1' }).section).toBe('Use the section letter, like A.')
  })
})

describe('student IDs (code review, 23 November 2026: the server takes 00-0000 only)', () => {
  const base = { name: 'Ana Reyes', email: 'ana@example.com', studentId: '26-7001', program: 'BSIT', year: '1', section: 'A' }
  it('takes 00-0000 with the enrollment year first, as the server does', () => {
    expect(studentProblems(base).studentId).toBeUndefined()
    expect(studentProblems({ ...base, studentId: 'QCU-2026-0001' }).studentId).toBe('Use the format 00-0000, with the enrollment year first, like 26-0001.')
  })
  it('refuses an enrollment year after this one', () => {
    const next = String((new Date(Date.now() + 8 * 3_600_000).getUTCFullYear() + 1) % 100).padStart(2, '0')
    expect(studentProblems({ ...base, studentId: `${next}-0001` }).studentId).toBe('The first two digits are the enrollment year; they cannot be a later year.')
  })
})
