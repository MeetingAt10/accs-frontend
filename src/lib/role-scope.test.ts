import { describe, expect, it } from 'vitest'

import { roleLine } from './role-scope'

describe('roleLine', () => {
  it('names the role and where it applies', () => {
    expect(roleLine({ roles: ['chair', 'professor'], program: 'BSIT' })).toBe('Program Chair and Professor · BSIT program')
    expect(roleLine({ roles: ['dean', 'professor'], program: 'BSIT' })).toBe('Dean and Professor · College of Computer Studies')
    expect(roleLine({ roles: ['student'], program: 'BSIT', section: 'A' })).toBe('Student · BSIT · Section A')
    expect(roleLine({ roles: ['guidance'], office: 'Guidance Office' })).toBe('Guidance · Guidance Office')
    expect(roleLine({ roles: ['administrator'] })).toBe('System Administrator · Platform administration')
    expect(roleLine({ roles: ['secretary'] })).toBe('CCS Secretary')
  })
})
