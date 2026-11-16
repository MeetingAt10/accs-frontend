import { describe, expect, it } from 'vitest'

import { newNotifications } from './queries'

describe('new notifications', () => {
  it('stays quiet on the first list, then reports each unread notification once', () => {
    const seen: { current: Set<string> | null } = { current: null }
    expect(newNotifications(seen, [{ id: 'N1', read: false }, { id: 'N2', read: true }])).toEqual([])
    // A message arrives.
    const next = [{ id: 'N3', kind: 'message', read: false }, { id: 'N1', read: false }, { id: 'N2', read: true }]
    expect(newNotifications(seen, next).map((n) => n.id)).toEqual(['N3'])
    // The same list again reports nothing new.
    expect(newNotifications(seen, next)).toEqual([])
  })

  it('skips a new notification that is already read, and ignores a missing list', () => {
    const seen: { current: Set<string> | null } = { current: new Set(['N1']) }
    expect(newNotifications(seen, [{ id: 'N4', read: true }])).toEqual([])
    expect(newNotifications(seen, undefined)).toEqual([])
    expect(seen.current?.has('N4')).toBe(true)
  })
})
