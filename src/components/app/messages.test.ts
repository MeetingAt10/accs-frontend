import { describe, expect, it } from 'vitest'

import { mentionQuery } from '@/components/ds-next/chat'
import { matchesPerson } from './communications'

describe('messages', () => {
  it('finds a person by the start of any word of their name, with or without @', () => {
    expect(matchesPerson('Prof. Robin Elm', 'rob')).toBe(true)
    expect(matchesPerson('Prof. Robin Elm', '@rob')).toBe(true)
    expect(matchesPerson('Prof. Robin Elm', '@elm')).toBe(true)
    expect(matchesPerson('Prof. Robin Elm', 'robin e')).toBe(true)
    expect(matchesPerson('Prof. Robin Elm', 'obin')).toBe(false)
    expect(matchesPerson('Prof. Robin Elm', '@')).toBe(true)
  })

  it('reads the name typed after @ at the end of a message', () => {
    expect(mentionQuery('Hi @rob')).toBe('rob')
    expect(mentionQuery('@')).toBe('')
    expect(mentionQuery('email me at prof@school')).toBeUndefined()
    expect(mentionQuery('Hi @robin elm')).toBeUndefined()
  })
})
