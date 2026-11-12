import { describe, expect, it } from 'vitest'

import { canMarkConfidential, following, mine } from './grievance'

describe('case views', () => {
  const atAdviser = { stage: 'adviser', status: 'With Adviser', allowedActions: ['respond'] }

  it('lets the adviser mark a concern confidential only while it is with them', () => {
    expect(canMarkConfidential(atAdviser)).toBe(true)
    expect(canMarkConfidential({ ...atAdviser, confidential: true })).toBe(true)
    expect(canMarkConfidential({ ...atAdviser, aboutAdvisor: true })).toBe(false)
    expect(canMarkConfidential({ ...atAdviser, stage: 'chair' })).toBe(false)
    expect(canMarkConfidential({ ...atAdviser, allowedActions: [] })).toBe(false)
    expect(canMarkConfidential({ ...atAdviser, readOnly: true })).toBe(false)
    expect(canMarkConfidential({ ...atAdviser, status: 'Closed' })).toBe(false)
  })

  it('puts read-only and status-only rows under Following, never under the reader\'s own queue', () => {
    for (const row of [{ readOnly: true }, { statusOnly: true }, { statusOnly: true, confidential: true }]) {
      expect(following(row)).toBe(true)
      expect(mine(row)).toBe(false)
    }
    expect(mine({ historyOnly: true })).toBe(false)
    expect(mine({ readOnly: false })).toBe(true)
    expect(following({})).toBe(false)
  })
})
