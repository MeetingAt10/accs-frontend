import { describe, expect, it } from 'vitest'

import { ApiError } from './api'
import { authRedirectFor, retryDelay, sessionEndedHref, shouldRetry } from './session-errors'

const apiError = (status: number, code?: string) => new ApiError('x', status, code ? { code } : undefined)

describe('authRedirectFor', () => {
  it('sends an ended session to Sign in and temporary details to First login', () => {
    expect(authRedirectFor(apiError(401, 'UNAUTHENTICATED'))).toBe('sign-in')
    expect(authRedirectFor(apiError(403, 'CREDENTIALS_CHANGE_REQUIRED'))).toBe('first-login')
  })

  it('leaves a wrong password, a page the role cannot open, and network failures to the page', () => {
    expect(authRedirectFor(apiError(401, 'INVALID_CREDENTIALS'))).toBeUndefined()
    expect(authRedirectFor(apiError(403, 'FORBIDDEN'))).toBeUndefined()
    expect(authRedirectFor(apiError(403))).toBeUndefined()
    expect(authRedirectFor(new TypeError('Failed to fetch'))).toBeUndefined()
  })
})

describe('sessionEndedHref', () => {
  it('comes back to the page the person was on', () => {
    expect(sessionEndedHref('/feed?q=lab')).toBe('/sign-in?ended=1&redirect=%2Ffeed%3Fq%3Dlab')
  })

  it('never redirects back to Sign in, First login, or another site', () => {
    expect(sessionEndedHref('/sign-in?redirect=%2Fhome')).toBe('/sign-in?ended=1')
    expect(sessionEndedHref('/first-login')).toBe('/sign-in?ended=1')
    expect(sessionEndedHref('//evil.example/x')).toBe('/sign-in?ended=1')
  })
})

describe('shouldRetry', () => {
  it('tries a throttled, failed, or unreachable request up to twice more', () => {
    for (const error of [apiError(429), apiError(500), apiError(503), new TypeError('Failed to fetch')]) {
      expect(shouldRetry(0, error)).toBe(true)
      expect(shouldRetry(1, error)).toBe(true)
      expect(shouldRetry(2, error)).toBe(false)
    }
  })

  it('takes no access, not found, and a bad request as the answer', () => {
    for (const status of [400, 401, 403, 404, 409]) expect(shouldRetry(0, apiError(status))).toBe(false)
  })

  it('waits longer each time', () => {
    expect([retryDelay(0), retryDelay(1)]).toEqual([500, 1000])
  })
})
