import { describe, expect, it } from 'vitest'

import { photoFileProblem, photoSrc } from './photo'

describe('profile photos', () => {
  it('accepts JPEG, PNG and WebP files and refuses others', () => {
    expect(photoFileProblem({ type: 'image/jpeg', size: 200_000 })).toBe('')
    expect(photoFileProblem({ type: 'image/webp', size: 10 })).toBe('')
    expect(photoFileProblem({ type: 'image/gif', size: 10 })).toMatch(/JPEG, PNG or WebP/)
    expect(photoFileProblem({ type: 'image/png', size: 20 * 1024 * 1024 })).toMatch(/15 MB/)
  })

  it('only shows data URL images', () => {
    expect(photoSrc('data:image/jpeg;base64,AAAA')).toBe('data:image/jpeg;base64,AAAA')
    expect(photoSrc('https://example.com/me.jpg')).toBe('')
    expect(photoSrc(undefined)).toBe('')
  })
})
