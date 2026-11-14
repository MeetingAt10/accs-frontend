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
    const dean = { name: 'Dr. Sage Linden' }
    const osas = { name: 'Jamie Alder' }
    expect(strikePeople({ status: 'recommended', recommendedBy: dean, recordedBy: dean })).toBe('Recommended by Dr. Sage Linden')
    expect(strikePeople({ status: 'confirmed', recommendedBy: dean, recordedBy: osas })).toBe('Recommended by Dr. Sage Linden, confirmed by Jamie Alder')
    expect(strikePeople({ status: 'rejected', recommendedBy: dean, recordedBy: osas })).toBe('Recommended by Dr. Sage Linden, rejected by Jamie Alder')
    expect(strikePeople({ recordedBy: osas })).toBe('Recorded by Jamie Alder')
  })
})
