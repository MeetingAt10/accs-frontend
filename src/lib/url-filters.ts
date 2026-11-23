import type { AnyRouter } from '@tanstack/react-router'

/** The address for a path and its filters, without a trailing "?" when there are none. */
export const filterHref = (pathname: string, params: URLSearchParams) => {
  const search = params.toString()
  return pathname + (search ? `?${search}` : '')
}

/**
 * Puts new filters in the address in place: no new history entry, no page transition, no jump to the top. A filter or
 * a search is not a new page, so Back leaves the page instead of stepping through every letter typed.
 */
export function replaceFilters(router: AnyRouter, pathname: string, params: URLSearchParams) {
  void router.navigate({ href: filterHref(pathname, params), replace: true, resetScroll: false, viewTransition: false })
}
