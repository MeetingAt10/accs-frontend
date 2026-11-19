import { rememberRoleLabels } from '@/lib/role-labels'
import { queryOptions } from '@tanstack/react-query'

import { ApiError, getPage, getSession, type PageEnvelope } from './api'
import { retryDelay, shouldRetry } from './session-errors'

export const sessionQuery = () =>
  queryOptions({
    queryKey: ['session'],
    queryFn: async () => {
      const session = await getSession()
      rememberRoleLabels(session.roleLabels)
      return session
    },
    retry: false,
    staleTime: 30_000,
  })

/**
 * True only when a failed session check means the user is actually signed out. A network
 * error or a 5xx from the server doesn't mean that, and must not be treated as if it did.
 */
export const sessionCheckSignedOut = (error: unknown) => error instanceof ApiError && error.status === 401

/** True when the previous page data belongs to the same page and record, so only the filters differ. */
export const keepFilteredPage = (previousKey: readonly unknown[] | undefined, pageId: string, recordId?: string) =>
  !!previousKey && previousKey[0] === 'page' && previousKey[1] === pageId && previousKey[2] === recordId

export const pageQuery = (pageId: string, recordId?: string, filters = '') =>
  queryOptions({
    queryKey: ['page', pageId, recordId, filters],
    queryFn: () => getPage(pageId, recordId, filters),
    // A request turned away as one too many, or a server hiccup, is tried again before the page says it failed.
    retry: shouldRetry,
    retryDelay,
  })

/**
 * The unread notifications not seen before, given the ones seen so far. The first list only marks everything as seen,
 * so opening the portal does not pop up old notifications.
 */
export function newNotifications(seen: { current: Set<string> | null }, items: unknown) {
  if (!Array.isArray(items)) return []
  const list = items as Record<string, unknown>[]
  if (seen.current === null) {
    seen.current = new Set(list.map((notice) => String(notice.id)))
    return []
  }
  const known = seen.current
  const fresh = list.filter((notice) => notice.read !== true && !known.has(String(notice.id)))
  for (const notice of list) known.add(String(notice.id))
  return fresh
}

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
