import { describe, expect, it } from 'vitest'

import { pageIdForPath, routePermission } from '@/lib/page-catalog'

import { tourSteps } from './tour-steps'

const session = (roles: string[], paths: string[], permissions: string[] = []) =>
  ({ user: { roles, name: 'Test', program: '', office: '' }, allowedPages: paths.map((path) => pageIdForPath(path) ?? path), permissions }) as never
const ids = (s: ReturnType<typeof session>) => tourSteps(s).map((step) => step.id)

const dean = ['/home', '/accounts', '/cases', '/analytics', '/evaluations/cycles', '/records', '/calendar', '/messages', '/feed']
const accounts = [routePermission.accounts].flat().slice(0, 1)

describe('guided tour steps', () => {
  it('opens with the welcome card, then the dean path in working order', () => {
    expect(ids(session(['dean'], dean, accounts))).toEqual([
      'welcome', '/accounts', '/cases', '/analytics', '/evaluations/cycles', '/records', '/calendar', 'assistant', 'notifications',
    ])
  })

  it('drops a step whose page the account may not open', () => {
    expect(ids(session(['dean'], dean.filter((path) => path !== '/analytics'), accounts))).not.toContain('/analytics')
  })

  it('gives a dean who also teaches the dean tour, and a student her own', () => {
    expect(ids(session(['professor', 'dean'], dean, accounts))).toContain('/accounts')
    expect(ids(session(['student'], ['/reports', '/consultations']))).toEqual(['welcome', '/reports', '/consultations', 'assistant', 'notifications'])
  })
})
