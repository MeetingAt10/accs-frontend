import { describe, expect, it } from 'vitest'

import { routePermission, pageIdForPath } from '@/lib/page-catalog'

import { gettingStartedSteps } from './getting-started'

const session = (roles: string[], paths: string[], permissions: string[] = []) => ({
  user: { roles },
  allowedPages: paths.map((path) => pageIdForPath(path) ?? path),
  permissions,
})
const accounts = [routePermission.accounts].flat().slice(0, 1)

describe('getting started steps', () => {
  it('lists the demo process in order for everyone', () => {
    expect(gettingStartedSteps(session(['student'], ['/home'])).map((step) => step.label)).toEqual([
      'Activate the secretary',
      'Create faculty and advisor accounts',
      'Assign program chairs',
      'Import students',
      'Student files a concern',
      'Advisor responds',
      'Schedule or start a conversation',
    ])
  })

  it('links a step only to a page the session may open', () => {
    const steps = gettingStartedSteps(session(['secretary'], ['/home'], accounts))
    expect(steps.map((step) => step.href)).toEqual([
      '/accounts',
      '/accounts?tab=faculty',
      '/accounts?tab=chairs',
      '/accounts?tab=students',
      undefined,
      undefined,
      undefined,
    ])
  })

  it('takes the first conversation page the session may open', () => {
    const steps = gettingStartedSteps(session(['student'], ['/home', '/reports', '/reports/new', '/messages']))
    expect(steps.at(-1)?.href).toBe('/messages')
    expect(steps.find((step) => step.id === 'concern')?.href).toBe('/reports/new')
  })
})
