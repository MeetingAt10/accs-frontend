import { describe, expect, it } from 'vitest'

import { featureWords } from './restrictions'

describe('restricted features', () => {
  it('names features in words, not codes', () => {
    expect(featureWords(['post.create', 'post.comment'])).toBe('Posting, Commenting')
    expect(featureWords(['report.anonymous'])).toBe('Anonymous reporting')
    expect(featureWords(['something.new'])).toBe('something.new')
    expect(featureWords(undefined)).toBe('')
  })
})
