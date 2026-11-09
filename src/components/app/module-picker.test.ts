import { describe, expect, it } from 'vitest'

import { pageIdForPath, routePermission } from '@/lib/page-catalog'

import { moduleTiles } from './module-picker'

// A session that may open the pages behind `paths`. Accounts has no page ID on the server, so it opens on a permission.
const session = (roles: string[], paths: string[], permissions: string[] = []) => ({
  user: { roles },
  allowedPages: paths.map((path) => pageIdForPath(path) ?? path),
  permissions,
})
const links = (s: ReturnType<typeof session>) => moduleTiles(s).map((tile) => [tile.id, tile.href])

const own = ['/home', '/messages', '/calendar', '/notifications']
// Any one of the keys that open Accounts will do.
const accounts = [routePermission.accounts].flat().slice(0, 1)

describe('module picker tiles', () => {
  it('gives a student the task tiles, each a link', () => {
    expect(links(session(['student'], [...own, '/reports', '/reports/new', '/consultations']))).toEqual([
      ['file-concern', '/reports/new'],
      ['my-concerns', '/reports'],
      ['student-consultations', '/consultations'],
      ['student-messages', '/messages'],
    ])
  })

  it('gives a faculty account the advisor tiles', () => {
    expect(links(session(['professor'], [...own, '/cases', '/consultations', '/consultations/availability']))).toEqual([
      ['assigned-concerns', '/cases'],
      ['faculty-schedule', '/calendar'],
      ['availability', '/consultations/availability'],
      ['faculty-messages', '/messages'],
    ])
  })

  it('leaves out a finished module the session cannot open', () => {
    const noMessages = session(['student'], ['/home', '/reports', '/reports/new'])
    expect(moduleTiles(noMessages).map((tile) => tile.id)).toEqual(['file-concern', 'my-concerns'])
  })

  it('gives the dean the oversight tiles', () => {
    expect(links(session(['dean'], ['/home', '/cases', '/records', '/notifications'], accounts))).toEqual([
      ['dean-accounts', '/accounts'],
      ['dean-cases', '/cases'],
      ['dean-records', '/records'],
      ['dean-notifications', '/notifications'],
    ])
  })

  it('gives the secretary the setup tiles, each on its own tab of Accounts', () => {
    expect(links(session(['secretary'], ['/home'], accounts))).toEqual([
      ['setup', '/accounts?tab=status'],
      ['faculty', '/accounts?tab=faculty'],
      ['advisors', '/accounts?tab=advisors'],
      ['chairs', '/accounts?tab=chairs'],
      ['import', '/accounts?tab=students'],
    ])
  })

  it('hides the secretary tiles from a session that cannot open Accounts', () => {
    expect(moduleTiles(session(['secretary'], ['/home']))).toEqual([])
  })

  it.each(['chair', 'guidance', 'osas', 'president'])('lists the %s module without a link', (role) => {
    const unfinished = moduleTiles(session([role], ['/home'])).filter((tile) => tile.id === role)
    expect(unfinished).toHaveLength(1)
    expect(unfinished[0].href).toBeUndefined()
  })

  it('combines roles in catalog order, unfinished modules last', () => {
    const both = session(['professor', 'chair', 'dean'], [...own, '/cases', '/consultations/availability', '/records'], accounts)
    expect(moduleTiles(both).map((tile) => tile.id)).toEqual([
      'dean-accounts',
      'dean-cases',
      'dean-records',
      'dean-notifications',
      'assigned-concerns',
      'faculty-schedule',
      'availability',
      'faculty-messages',
      'chair',
    ])
  })

  it.each(['administrator', 'organization', 'staff'])('shows %s no tiles', (role) => {
    expect(moduleTiles(session([role], ['/home']))).toEqual([])
  })
})
