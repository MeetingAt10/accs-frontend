import { describe, expect, it } from 'vitest'

import { permissionGroup, permissionLabel, proposalWords } from './permission-words'

describe('permission words', () => {
  it('names each permission in words, and keeps the code for an unknown one', () => {
    expect(permissionLabel('post.anonymous')).toBe('Allow to post anonymously')
    expect(permissionLabel('restriction.manage')).toBe('Manage restrictions')
    expect(permissionLabel('new.thing')).toBe('new.thing')
    expect(permissionGroup('todo.manage')).toBe('Todo')
  })

  it('says a proposed change as a sentence', () => {
    expect(proposalWords('Dean', 'post.anonymous', true)).toBe('Allow Dean to post anonymously')
    expect(proposalWords('Student', 'calendar.view', false)).toBe('Take "Use the calendar" from Student')
  })
})
