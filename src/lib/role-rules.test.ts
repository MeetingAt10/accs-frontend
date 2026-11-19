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
