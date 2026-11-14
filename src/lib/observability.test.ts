import { describe, expect, it } from 'vitest'

import { apiOriginPattern } from './observability'

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
