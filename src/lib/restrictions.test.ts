import { describe, expect, it } from 'vitest'

import { featureWords, filterRestrictions, newestFirst } from './restrictions'

describe('restricted features', () => {
  it('names features in words, not codes', () => {
    expect(featureWords(['post.create', 'post.comment'])).toBe('Posting, Commenting')
    expect(featureWords(['report.anonymous'])).toBe('Anonymous reporting')
    expect(featureWords(['something.new'])).toBe('something.new')
    expect(featureWords(undefined)).toBe('')
  })
})

describe('filterRestrictions', () => {
  const rows = [
    { id: 'a', features: ['post.create'], student: { id: 'QCU-STU-IT-A', studentId: '24-0103', name: 'Ana Reyes', program: 'BSIT' } },
    { id: 'b', features: ['post.comment', 'report.anonymous'], student: { id: 'QCU-STU-CS', name: 'Ben Cruz', program: 'BSCS' } },
  ]
  const ids = (q: string, feature = '', program = '') => filterRestrictions(rows, { q, feature, program }).map((row) => row.id)
  it('searches the student name or ID, and filters by feature and program', () => {
    expect(ids('')).toEqual(['a', 'b'])
    expect(ids('ben')).toEqual(['b'])
    expect(ids('stu-it')).toEqual(['a'])
    expect(ids('24-0103')).toEqual(['a'])
    expect(ids('', 'report.anonymous')).toEqual(['b'])
    expect(ids('', '', 'BSIT')).toEqual(['a'])
    expect(ids('ana', '', 'BSCS')).toEqual([])
  })
})

describe('newestFirst', () => {
  it('puts the latest start date first, and a change request by when it was made', () => {
    const rows = [{ id: 'old', starts: '2026-10-01' }, { id: 'new', starts: '2026-11-18' }, { id: 'mid', at: '2026-11-02T08:00:00.000Z' }]
    expect(newestFirst(rows).map((row) => row.id)).toEqual(['new', 'mid', 'old'])
    expect(rows.map((row) => row.id)).toEqual(['old', 'new', 'mid'])
  })
})
