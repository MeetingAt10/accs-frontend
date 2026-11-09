import { queryOptions } from '@tanstack/react-query'

import { ApiError, getPage, getSession, type PageEnvelope } from './api'

export const sessionQuery = () =>
  queryOptions({
    queryKey: ['session'],
    queryFn: getSession,
    retry: false,
    staleTime: 30_000,
  })

/**
 * True only when a failed session check means the user is actually signed out. A network
 * error or a 5xx from the server doesn't mean that, and must not be treated as if it did.
 */
export const sessionCheckSignedOut = (error: unknown) => error instanceof ApiError && error.status === 401

export const pageQuery = (pageId: string, recordId?: string, filters = '') =>
  queryOptions({
    queryKey: ['page', pageId, recordId, filters],
    queryFn: () => getPage(pageId, recordId, filters),
    retry: false,
  })

/**
 * The notification bell popover's items (the latest 5) and the unread count of every notification, from the P40 page query. Reads them
 * only from a successful fetch - a failed or still-loading query must not read as "zero
 * notifications" (it isn't; the request just hasn't told us yet).
 */
export function notificationsFromQuery(page: { isSuccess: boolean; data?: PageEnvelope }) {
  const items = page.isSuccess ? page.data?.data.notifications : undefined
  const all = Array.isArray(items) ? (items as Record<string, unknown>[]) : []
  return { recent: all.slice(0, 5), unreadCount: all.filter((notice) => notice.read !== true).length }
}
