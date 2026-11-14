import { describe, expect, it } from 'vitest'

import { strikePeople, strikeStatus } from './strikes'

describe('strikes', () => {
  it('reads the status, treating a strike from before recommendations as confirmed', () => {
    expect(strikeStatus({ status: 'recommended' })).toBe('recommended')
    expect(strikeStatus({ status: 'rejected' })).toBe('rejected')
    expect(strikeStatus({})).toBe('confirmed')
    expect(strikeStatus({ status: 'pending' })).toBe('confirmed')
  })

  it('says who recommended the strike and who decided it', () => {
    const dean = { name: 'Dr. Paula Joy L. Dela Cruz' }
    const osas = { name: 'Demo OSAS Officer' }
    expect(strikePeople({ status: 'recommended', recommendedBy: dean, recordedBy: dean })).toBe('Recommended by Dr. Paula Joy L. Dela Cruz')
    expect(strikePeople({ status: 'confirmed', recommendedBy: dean, recordedBy: osas })).toBe('Recommended by Dr. Paula Joy L. Dela Cruz, confirmed by Demo OSAS Officer')
    expect(strikePeople({ status: 'rejected', recommendedBy: dean, recordedBy: osas })).toBe('Recommended by Dr. Paula Joy L. Dela Cruz, rejected by Demo OSAS Officer')
    expect(strikePeople({ recordedBy: osas })).toBe('Recorded by Demo OSAS Officer')
  })
})
