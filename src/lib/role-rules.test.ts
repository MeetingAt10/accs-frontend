import { describe, expect, it } from 'vitest'

import { canAddRole, sectionProblem } from './role-rules'

describe('canAddRole', () => {
  it('keeps a student or organization account to that one role', () => {
    expect(canAddRole(['student'], 'administrator')).toBe(false)
    expect(canAddRole(['student'], 'professor')).toBe(false)
    expect(canAddRole(['professor'], 'student')).toBe(false)
    expect(canAddRole(['organization'], 'guidance')).toBe(false)
    expect(canAddRole([], 'student')).toBe(true)
  })

  it('allows two roles for faculty and staff, and no third', () => {
    expect(canAddRole(['professor'], 'dean')).toBe(true)
    expect(canAddRole(['professor', 'dean'], 'chair')).toBe(false)
    expect(canAddRole(['professor', 'dean'], 'dean')).toBe(true)
  })
})

describe('sectionProblem', () => {
  it('takes letters only', () => {
    expect(sectionProblem('A')).toBeUndefined()
    expect(sectionProblem('')).toBeUndefined()
    expect(sectionProblem('200')).toBe('Use the section letter, like A.')
  })
})

describe('full section names (QA 19 November)', () => {
  it('builds the prefix and takes the letter from a full name', async () => {
    const { fullSectionProblem, sectionLetter, sectionPrefix } = await import('./role-rules')
    expect(sectionPrefix({ campus: 'SB', program: 'BSIT', year: 4 })).toBe('SBIT4')
    expect(sectionPrefix({ program: 'BSCS', year: 2 })).toBe('SBCS2')
    expect(sectionLetter('SBIT4A', 'SBIT4')).toBe('A')
    expect(sectionLetter('sbit4ab', 'SBIT4')).toBe('AB')
    expect(sectionLetter('A', 'SBIT4')).toBe('A')
    expect(sectionLetter('SBCS4A', 'SBIT4')).toBeUndefined()
    expect(sectionLetter('SBIT3A', 'SBIT4')).toBeUndefined()
    expect(fullSectionProblem('SBIT3A', 'SBIT4')).toBe('Use the full section name, like SBIT4A.')
    expect(fullSectionProblem('SBIT4K', 'SBIT4')).toBeUndefined()
  })
})
