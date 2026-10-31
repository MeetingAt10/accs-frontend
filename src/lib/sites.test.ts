import { afterEach, describe, expect, it, vi } from 'vitest'

import inventory from './doc003-modules.json'
import { pageIdForPath } from './page-catalog'
import { siteForPath, sites } from './sites'

// One concrete URL per page (P03-P52; P01 `/` and P02 `/sign-in` are served on every host).
const samplePaths: Record<string, string> = {
  P03: '/home', P04: '/feed', P05: '/feed/new', P06: '/feed/POST-1', P07: '/spaces', P08: '/spaces/S-1', P09: '/organizations',
  P10: '/organizations/O-1', P11: '/messages', P12: '/messages/T-1', P13: '/calendar', P14: '/consultations',
  P15: '/consultations/faculty/F-1', P16: '/consultations/requests/R-1', P17: '/consultations/availability', P18: '/reports',
  P19: '/reports/new', P20: '/reports/R-1', P21: '/cases', P22: '/cases/C-1', P23: '/cases/clusters', P24: '/cases/clusters/K-1',
  P25: '/analytics', P26: '/evaluations', P27: '/evaluations/forms/A-1', P28: '/evaluations/results', P29: '/evaluations/results/F-1',
  P30: '/evaluations/cycles', P31: '/evaluations/cycles/Y-1', P32: '/evaluations/cycles/Y-1/review', P33: '/records',
  P34: '/records/S-1', P35: '/restrictions', P36: '/standing', P37: '/directory', P38: '/people/U-1', P39: '/profile',
  P40: '/notifications', P41: '/assistant', P42: '/help', P43: '/settings', P44: '/settings/notifications', P45: '/admin',
  P46: '/admin/users', P47: '/admin/users/U-1', P48: '/admin/roles', P49: '/admin/moderation', P50: '/admin/moderation/M-1',
  P51: '/admin/audit', P52: '/admin/monitoring',
}

describe('module sites follow DOC003', () => {
  it('assigns each of the 58 inventory modules to exactly one site', () => {
    const assigned = sites.flatMap((site) => site.modules)
    expect(inventory.modules).toHaveLength(58)
    expect([...assigned].sort()).toEqual(inventory.modules.map((m) => m.id).sort())
  })

  it('maps every page to its route and to one site', () => {
    for (const [pageId, path] of Object.entries(samplePaths)) {
      expect(pageIdForPath(path), path).toBe(pageId)
      expect(sites.map((s) => s.id)).toContain(siteForPath(path))
    }
  })

  for (const module of inventory.modules) {
    it(`${module.id} is served on its site through one of its pages`, () => {
      const site = sites.find((s) => s.modules.includes(module.id))!
      const owned = module.pages.filter((page) => samplePaths[page] && siteForPath(samplePaths[page]) === site.id)
      expect(owned, `${module.id} on ${site.id}: pages ${module.pages.join(', ')}`).not.toHaveLength(0)
    })
  }

  it('gives every site a landing route that belongs to it', () => {
    for (const site of sites) for (const href of site.landings) expect(siteForPath(href)).toBe(site.id)
  })
})

describe('cross-host links', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  async function load(href: string, origins?: Record<string, string>) {
    vi.resetModules()
    if (origins) vi.stubEnv('VITE_SITE_ORIGINS', JSON.stringify(origins))
    const url = new URL(href)
    vi.stubGlobal('window', { location: { origin: url.origin, hostname: url.hostname, protocol: url.protocol, port: url.port } })
    return import('./sites')
  }

  it('uses configured origins', async () => {
    const m = await load('https://f.example', { portal: 'https://p.example', forums: 'https://f.example' })
    expect(m.currentSite()).toBe('forums')
    expect(m.siteHref('/feed?q=x')).toBe('/feed?q=x')
    expect(m.siteHref('/home')).toBe('https://p.example/home')
    expect(m.siteHref('/sign-in?redirect=%2Ffeed')).toBe('/sign-in?redirect=%2Ffeed')
    // A site without an origin stays on this host.
    expect(m.siteHref('/cases')).toBe('/cases')
  })

  it('swaps the host label', async () => {
    const m = await load('http://forums.localhost:5173')
    expect(m.currentSite()).toBe('forums')
    expect(m.siteHref('/calendar')).toBe('http://schedule.localhost:5173/calendar')
    expect(m.siteHref('https://other.example/x')).toBe('https://other.example/x')
  })

  it('keeps every route on one host in unified mode', async () => {
    const m = await load('http://localhost:5173')
    expect(m.currentSite()).toBeUndefined()
    expect(m.siteHref('/admin/users')).toBe('/admin/users')
  })

  it('lands on the current site first, then Home', async () => {
    const m = await load('http://cases.localhost:5173')
    expect(m.landingFor({ allowedPages: ['P03', 'P18'], user: { roles: ['student'] } })).toBe('/reports')
    expect(m.landingFor({ allowedPages: ['P03'], user: { roles: ['student'] } })).toBe('/home')
    expect(m.landingFor({ allowedPages: ['P45'], user: { roles: ['administrator'] } }, 'portal')).toBe('/admin')
  })
})
