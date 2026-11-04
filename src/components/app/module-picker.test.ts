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
  it('gives a student the four finished modules, each a link', () => {
    expect(links(session(['student'], [...own, '/reports']))).toEqual([
      ['concerns', '/reports'],
      ['schedule', '/calendar'],
      ['messages', '/messages'],
      ['notifications', '/notifications'],
    ])
  })

  it('gives a faculty account the advisor modules, with concerns on the case queue', () => {
    expect(links(session(['professor'], [...own, '/cases']))).toEqual([
      ['concerns', '/cases'],
      ['schedule', '/calendar'],
      ['messages', '/messages'],
      ['notifications', '/notifications'],
    ])
  })

  it('leaves out a finished module the session cannot open', () => {
    const noMessages = session(['student'], ['/home', '/calendar', '/reports', '/notifications'])
    expect(moduleTiles(noMessages).map((tile) => tile.id)).toEqual(['concerns', 'schedule', 'notifications'])
  })

  it('gives the dean and the secretary Accounts', () => {
    expect(links(session(['dean'], ['/home'], accounts))).toEqual([
      ['accounts', '/accounts'],
      ['dean', undefined],
    ])
    expect(links(session(['secretary'], ['/home'], accounts))).toEqual([['accounts', '/accounts']])
  })

  it.each(['dean', 'chair', 'guidance', 'osas', 'president'])('lists the %s module without a link', (role) => {
    const unfinished = moduleTiles(session([role], ['/home'])).filter((tile) => tile.id === role)
    expect(unfinished).toHaveLength(1)
    expect(unfinished[0].href).toBeUndefined()
  })

  it('combines roles in catalog order', () => {
    const both = session(['professor', 'dean'], [...own, '/cases'], accounts)
    expect(moduleTiles(both).map((tile) => tile.id)).toEqual([
      'concerns',
      'schedule',
      'messages',
      'notifications',
      'accounts',
      'dean',
    ])
  })

  it.each(['administrator', 'organization', 'staff'])('shows %s no tiles', (role) => {
    expect(moduleTiles(session([role], ['/home']))).toEqual([])
  })
})
