import { describe, expect, it } from 'vitest'

import { chunk, credentialsCsv, parseStudentRows, toStudent } from './account-import'

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
    expect(students[1]!.problems).toEqual({})
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
