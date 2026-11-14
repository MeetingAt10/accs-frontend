import { describe, expect, it } from 'vitest'

import { mentionQuery } from '@/components/ds-next/chat'
import { matchesPerson } from './communications'

describe('messages', () => {
  it('finds a person by the start of any word of their name, with or without @', () => {
    expect(matchesPerson('Demo Professor Charlie', 'dem')).toBe(true)
    expect(matchesPerson('Demo Professor Charlie', '@dem')).toBe(true)
    expect(matchesPerson('Demo Professor Charlie', '@charlie')).toBe(true)
    expect(matchesPerson('Demo Professor Charlie', 'demo p')).toBe(true)
    expect(matchesPerson('Demo Professor Charlie', 'emo')).toBe(false)
    expect(matchesPerson('Demo Professor Charlie', '@')).toBe(true)
  })

  it('reads the name typed after @ at the end of a message', () => {
    expect(mentionQuery('Hi @rob')).toBe('rob')
    expect(mentionQuery('@')).toBe('')
    expect(mentionQuery('email me at prof@school')).toBeUndefined()
    expect(mentionQuery('Hi @demo professor')).toBeUndefined()
  })
})
