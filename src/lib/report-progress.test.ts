import { describe, expect, it } from 'vitest'

import { progressOf } from './report-progress'

describe('progressOf', () => {
  it('reads the step and names where an escalated report went', () => {
    expect(progressOf({ progress: { steps: ['Submitted', 'Read', 'Escalated', 'Resolved', 'Closed'], step: 2, escalatedTo: 'Program Chair' } })).toEqual({
      steps: ['Submitted', 'Read', 'Escalated', 'Resolved', 'Closed'], step: 2, label: 'Escalated to Program Chair',
    })
  })

  it('starts at Submitted when the report has no progress yet, and never goes past the last step', () => {
    expect(progressOf({}).label).toBe('Submitted')
    expect(progressOf({ progress: { step: 9 } }).label).toBe('Closed')
    expect(progressOf({ progress: { step: -1 } }).label).toBe('Submitted')
  })
})
