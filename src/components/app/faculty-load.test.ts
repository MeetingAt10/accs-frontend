import { describe, expect, it } from 'vitest'

import { ApiError } from '@/lib/api'
import { loadRowsFromCsv, parseCsv, rowProblems } from './faculty-load'

describe('faculty load file', () => {
  it('reads quoted cells with commas, quotes and line breaks, and skips blank lines', () => {
    expect(parseCsv('a,b\r\n"x, y","say ""hi"""\n\n"two\nlines",z\n')).toEqual([['a', 'b'], ['x, y', 'say "hi"'], ['two\nlines', 'z']])
    expect(parseCsv('﻿a,b')).toEqual([['a', 'b']])
  })

  it('maps the header to load rows and ignores unknown columns', () => {
    const { rows, missing } = loadRowsFromCsv('Email,Day,Start,End,Subject,Section,Notes\nprof.it@qcu.edu.ph,Mon,07:30,09:00,IT 301,3A,ignored\n')
    expect(missing).toEqual([])
    expect(rows).toEqual([{ facultyEmail: 'prof.it@qcu.edu.ph', day: 'Mon', start: '07:30', end: '09:00', subject: 'IT 301', section: '3A' }])
  })

  it('names the required columns that are missing', () => {
    expect(loadRowsFromCsv('day,start\nMon,07:30').missing).toEqual(['facultyEmail (or email)', 'end', 'subject'])
  })

  it('groups the API problems by row, counting from the first row under the header', () => {
    const error = new ApiError('Check the required fields.', 400, { fields: [
      { path: 'rows.2.facultyEmail', message: 'No active faculty account has this email.' },
      { path: 'rows.0.end', message: 'The end time must be later than the start time.' },
      { path: 'rows.2.day', message: 'Use a day from Mon to Sat.' },
      { path: 'term', message: 'Required' },
    ] })
    expect(rowProblems(error)).toEqual([
      { row: 1, messages: ['end: The end time must be later than the start time.'] },
      { row: 3, messages: ['facultyEmail: No active faculty account has this email.', 'day: Use a day from Mon to Sat.'] },
    ])
    expect(rowProblems(new Error('x'))).toEqual([])
  })
})
