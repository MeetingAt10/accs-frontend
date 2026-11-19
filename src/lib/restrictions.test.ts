import { describe, expect, it } from 'vitest'

import { featureWords, filterRestrictions } from './restrictions'

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
    { id: 'a', features: ['post.create'], student: { id: 'QCU-STU-IT-A', name: 'Ana Reyes', program: 'BSIT' } },
    { id: 'b', features: ['post.comment', 'report.anonymous'], student: { id: 'QCU-STU-CS', name: 'Ben Cruz', program: 'BSCS' } },
  ]
  const ids = (q: string, feature = '', program = '') => filterRestrictions(rows, { q, feature, program }).map((row) => row.id)
  it('searches the student name or ID, and filters by feature and program', () => {
    expect(ids('')).toEqual(['a', 'b'])
    expect(ids('ben')).toEqual(['b'])
    expect(ids('stu-it')).toEqual(['a'])
    expect(ids('', 'report.anonymous')).toEqual(['b'])
    expect(ids('', '', 'BSIT')).toEqual(['a'])
    expect(ids('ana', '', 'BSCS')).toEqual([])
  })
})
