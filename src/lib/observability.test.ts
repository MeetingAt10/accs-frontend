import { describe, expect, it } from 'vitest'

import { apiOriginPattern, gaPageLocation, gaReferrer } from './observability'

describe('apiOriginPattern', () => {
  const [pattern] = apiOriginPattern('https://api.example.com/api')
  it('matches the API origin only', () => {
    expect(pattern.test('https://api.example.com/api/x')).toBe(true)
    expect(pattern.test('https://bucket.s3.ap-southeast-1.amazonaws.com/key?X-Amz-Signature=1')).toBe(false)
    expect(pattern.test('https://api.example.com.evil.test/api')).toBe(false)
  })
  it('is empty for a relative or missing URL', () => {
    expect(apiOriginPattern('/api')).toEqual([])
    expect(apiOriginPattern(undefined)).toEqual([])
  })
})

describe('GA sanitizers', () => {
  it('builds page_location from the template only', () => {
    expect(gaPageLocation('https://portal.access-ccs.com', '/cases/$caseId')).toBe('https://portal.access-ccs.com/cases/$caseId')
  })
  it('reduces the referrer to its origin', () => {
    expect(gaReferrer('https://x.test/people/USER-1?q=a#h')).toBe('https://x.test')
    expect(gaReferrer('')).toBe('')
  })
})
