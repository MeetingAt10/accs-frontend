import { describe, expect, it } from 'vitest'

import { ApiError, type PageEnvelope } from './api'
import { notificationsFromQuery, sessionCheckSignedOut } from './queries'

describe('sessionCheckSignedOut', () => {
  it('is true for a 401 from the session check', () => {
    expect(sessionCheckSignedOut(new ApiError('Unauthorized', 401))).toBe(true)
  })

  it('is false for a 5xx from the session check', () => {
    expect(sessionCheckSignedOut(new ApiError('Server error', 500))).toBe(false)
    expect(sessionCheckSignedOut(new ApiError('Bad gateway', 502))).toBe(false)
  })

  it('is false for another 4xx from the session check', () => {
    expect(sessionCheckSignedOut(new ApiError('Forbidden', 403))).toBe(false)
  })

  it('is false for a network error (fetch rejects without a response)', () => {
    expect(sessionCheckSignedOut(new TypeError('Failed to fetch'))).toBe(false)
    expect(sessionCheckSignedOut(new Error('network error'))).toBe(false)
  })

  it('is false for a non-error value', () => {
    expect(sessionCheckSignedOut(undefined)).toBe(false)
  })
})

const notificationsPage = (notifications: unknown): PageEnvelope => ({
  pageId: 'P40',
  title: 'Notifications',
  scope: '',
  data: { notifications },
})

describe('notificationsFromQuery', () => {
  it('is empty while the query is loading, even though it has no error either', () => {
    expect(notificationsFromQuery({ isSuccess: false, data: undefined })).toEqual({ recent: [], unreadCount: 0 })
  })

  it('is empty on a failed query, and ignores leftover data rather than treating it as current', () => {
    expect(notificationsFromQuery({ isSuccess: false, data: notificationsPage([{ id: '1', read: false }]) })).toEqual({
      recent: [],
      unreadCount: 0,
    })
  })

  it('reads the first 5 items and counts the unread ones among all of them on a successful query', () => {
    const items = Array.from({ length: 7 }, (_, index) => ({ id: String(index), read: index < 2 }))
    expect(notificationsFromQuery({ isSuccess: true, data: notificationsPage(items) })).toEqual({
      recent: items.slice(0, 5),
      unreadCount: 5, // of all 7, indexes 2-6 are unread
    })
  })

  it('is empty when a successful response has no notifications list', () => {
    expect(notificationsFromQuery({ isSuccess: true, data: notificationsPage(undefined) })).toEqual({
      recent: [],
      unreadCount: 0,
    })
    expect(notificationsFromQuery({ isSuccess: true, data: undefined })).toEqual({ recent: [], unreadCount: 0 })
  })
})
