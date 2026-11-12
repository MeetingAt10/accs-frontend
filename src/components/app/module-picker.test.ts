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

  it('gives the dean six oversight tiles, without Notifications (the bell has them)', () => {
    expect(links(session(['dean'], ['/home', '/cases', '/records', '/analytics', '/evaluations/cycles', '/evaluations/results', '/notifications'], accounts))).toEqual([
      ['dean-accounts', '/accounts'],
      ['dean-cases', '/cases'],
      ['dean-records', '/records'],
      ['dean-analytics', '/analytics'],
      ['dean-cycles', '/evaluations/cycles'],
      ['dean-results', '/evaluations/results'],
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

  it('gives the program chair the program tiles', () => {
    expect(links(session(['chair'], ['/home', '/cases', '/records', '/analytics', '/evaluations/results']))).toEqual([
      ['chair-cases', '/cases'],
      ['chair-records', '/records'],
      ['chair-analytics', '/analytics'],
      ['chair-results', '/evaluations/results'],
    ])
  })

  it('gives Guidance six case tiles, each a link', () => {
    expect(links(session(['guidance'], [...own, '/cases', '/records', '/restrictions', '/directory']))).toEqual([
      ['guidance-cases', '/cases'],
      ['guidance-records', '/records'],
      ['guidance-messages', '/messages'],
      ['guidance-restrictions', '/restrictions'],
      ['guidance-calendar', '/calendar'],
      ['guidance-directory', '/directory'],
    ])
  })

  it('gives OSAS six case and record tiles, each a link', () => {
    expect(links(session(['osas'], [...own, '/cases', '/records', '/restrictions', '/directory']))).toEqual([
      ['osas-cases', '/cases'],
      ['osas-records', '/records'],
      ['osas-restrictions', '/restrictions'],
      ['osas-messages', '/messages'],
      ['osas-calendar', '/calendar'],
      ['osas-directory', '/directory'],
    ])
  })

  it('has no tile that is not available yet, and none for the removed offices', () => {
    for (const role of ['chair', 'guidance', 'osas', 'president', 'staff']) {
      for (const tile of moduleTiles(session([role], [...own, '/cases', '/records', '/analytics', '/evaluations/results', '/restrictions']))) expect(tile.href, tile.id).toBeDefined()
    }
    expect(moduleTiles(session(['president'], [...own, '/cases', '/records']))).toEqual([])
  })

  it('combines roles in catalog order', () => {
    const both = session(['professor', 'chair', 'dean'], [...own, '/cases', '/consultations/availability', '/records'], accounts)
    expect(moduleTiles(both).map((tile) => tile.id)).toEqual([
      'dean-accounts',
      'dean-cases',
      'dean-records',
      'assigned-concerns',
      'faculty-schedule',
      'availability',
      'faculty-messages',
      'chair-cases',
      'chair-records',
      'chair-messages',
      'chair-calendar',
    ])
  })

  it('gives students and faculty six tiles when they may open every page, and no Notifications tile to anyone', () => {
    const student = session(['student'], [...own, '/reports', '/reports/new', '/consultations', '/evaluations', '/standing'])
    expect(moduleTiles(student).map((tile) => tile.id)).toEqual(['file-concern', 'my-concerns', 'student-consultations', 'student-messages', 'student-evaluations', 'student-standing'])
    const professor = session(['professor'], [...own, '/cases', '/consultations', '/consultations/availability', '/evaluations/results', '/spaces'])
    expect(moduleTiles(professor).map((tile) => tile.id)).toEqual(['assigned-concerns', 'faculty-schedule', 'availability', 'faculty-messages', 'faculty-results', 'faculty-classes'])
    const chair = session(['chair'], [...own, '/cases', '/records', '/analytics', '/evaluations/results'])
    expect(moduleTiles(chair)).toHaveLength(6)
    for (const role of ['dean', 'guidance', 'osas', 'chair', 'student', 'professor']) {
      expect(moduleTiles(session([role], [...own, '/cases', '/records'], accounts)).some((tile) => tile.href === '/notifications'), role).toBe(false)
    }
  })

  it.each(['administrator', 'organization', 'staff'])('shows %s no tiles', (role) => {
    expect(moduleTiles(session([role], ['/home']))).toEqual([])
  })
})
