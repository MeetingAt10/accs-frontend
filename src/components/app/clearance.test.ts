import { describe, expect, it } from 'vitest'

import { evaluationText } from './records'

describe('clearance', () => {
  it('shows how far a student got while an evaluation is not finished', () => {
    expect(evaluationText({ status: 'pending', label: 'Not finished', submitted: 1, total: 2 })).toBe('Not finished: 1 of 2')
    expect(evaluationText({ status: 'missing', label: 'Missing', submitted: 0, total: 2 })).toBe('Missing: 0 of 2')
    expect(evaluationText({ status: 'submitted', label: 'Finished', submitted: 2, total: 2 })).toBe('Finished')
    expect(evaluationText({ status: 'none', label: 'Nothing to evaluate' })).toBe('Nothing to evaluate')
    expect(evaluationText({})).toBe('—')
  })
})
