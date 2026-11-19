import { describe, expect, it } from 'vitest'

import { officeOf } from './page-shell'

describe('officeOf', () => {
  it('names the office a case status points to', () => {
    expect(officeOf('Escalated to Program Chair')).toBe('chair')
    expect(officeOf('Escalated to Guidance Office')).toBe('guidance')
    expect(officeOf('Case File at Guidance')).toBe('guidance')
    expect(officeOf('Escalated to Dean')).toBe('dean')
    expect(officeOf('Escalated to OSAS')).toBe('osas')
    expect(officeOf('With adviser')).toBe('adviser')
  })

  it('leaves other words alone', () => {
    expect(officeOf('Resolved')).toBeUndefined()
    expect(officeOf('Dean')).toBeUndefined()
    expect(officeOf('Pending')).toBeUndefined()
  })
})
