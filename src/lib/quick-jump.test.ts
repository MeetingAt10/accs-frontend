import { describe, expect, it } from 'vitest'

import { isQuickJumpKey, jumpItems, matchesJump } from './quick-jump'

const pages = [{ label: 'Home', href: '/home' }, { label: 'Feed', href: '/feed' }, { label: 'My reports', href: '/reports' }, { label: 'Feed', href: '/feed' }]

describe('jumpItems', () => {
  it('lists the actions the role may use, then its pages once each', () => {
    expect(jumpItems(pages, ['P05', 'P19', 'P15']).map((item) => item.label)).toEqual(['New post', 'New report', 'Book a consultation', 'Home', 'Feed', 'My reports'])
  })

  it('leaves out actions the role cannot open', () => {
    expect(jumpItems(pages, ['P05']).filter((item) => item.kind === 'Action').map((item) => item.label)).toEqual(['New post'])
  })
})

describe('matchesJump', () => {
  const report = { id: 'a', label: 'New report', href: '/reports/new', kind: 'Action' as const }
  it('matches the start of each word, in any letter case', () => {
    expect(matchesJump(report, 'new rep')).toBe(true)
    expect(matchesJump(report, 'REPORT')).toBe(true)
    expect(matchesJump(report, '')).toBe(true)
    expect(matchesJump(report, 'port')).toBe(false)
  })
})

describe('isQuickJumpKey', () => {
  const key = (k: string, mods: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean }> = {}) => ({ key: k, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...mods })
  it('is Ctrl+K or Cmd+K only', () => {
    expect(isQuickJumpKey(key('k', { ctrlKey: true }))).toBe(true)
    expect(isQuickJumpKey(key('K', { metaKey: true }))).toBe(true)
    expect(isQuickJumpKey(key('k'))).toBe(false)
    expect(isQuickJumpKey(key('k', { ctrlKey: true, shiftKey: true }))).toBe(false)
  })
})
