import { describe, expect, it } from 'vitest'

import { pageIdForPath } from '@/lib/page-catalog'

import { communityTabs, dashboardStats, isCommunityRole } from './community-home'

const session = (roles: string[], paths: string[]) => ({
  user: { roles },
  allowedPages: paths.map((path) => pageIdForPath(path) ?? path),
  permissions: [],
})

describe('community home', () => {
  it('is for students and faculty only', () => {
    expect(['student', 'professor'].every(isCommunityRole)).toBe(true)
    expect(['dean', 'secretary', 'chair', 'administrator'].some(isCommunityRole)).toBe(false)
  })

  it('always starts at Home, then adds only the sections the session may open', () => {
    const all = session(['student'], ['/home', '/feed', '/calendar', '/directory'])
    expect(communityTabs(all).map((tab) => tab.id)).toEqual(['home', 'discussion', 'events', 'members'])
    expect(communityTabs(all)[0].href).toBeUndefined()

    const fewer = session(['professor'], ['/home', '/calendar'])
    expect(communityTabs(fewer).map((tab) => tab.id)).toEqual(['home', 'events'])
    expect(communityTabs(session(['student'], ['/home'])).map((tab) => tab.id)).toEqual(['home'])
  })
})

describe('dashboard summary cards', () => {
  const stats = [{ label: 'Active reports' }, { label: 'Unread updates' }, { label: 'Consultations' }, { label: 'Evaluations due' }]

  it('leaves the unread card to the bell for students and faculty, and keeps the rest', () => {
    for (const role of ['student', 'professor']) {
      expect(dashboardStats(stats, role).map((stat) => stat.label)).toEqual(['Active reports', 'Consultations', 'Evaluations due'])
    }
  })

  it('does not change the cards of other roles', () => {
    expect(dashboardStats(stats, 'dean')).toBe(stats)
  })
})
