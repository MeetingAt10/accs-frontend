import { Pagination } from '@meetingat10/design-system/react'
import { useEffect, useState, type ReactNode } from 'react'

// Long lists come in pages instead of one long scroll. `usePaged` slices the items for the current page and goes back to
// page 1 when the list changes (a new search or filter); `Pager` shows the page links under the list, only when there is
// more than one page.

export const defaultPageSize = 10

export type Paged<T> = { shown: T[]; page: number; pageCount: number; setPage: (page: number) => void; total: number; from: number; to: number }

/** The slice for `page` (1-based, kept within range), and the numbers the pager shows. */
export function pageOf<T>(items: T[], page: number, size = defaultPageSize) {
  const pageCount = Math.max(1, Math.ceil(items.length / size))
  const current = Math.min(Math.max(1, page), pageCount)
  const start = (current - 1) * size
  const shown = items.slice(start, start + size)
  return { shown, page: current, pageCount, total: items.length, from: items.length ? start + 1 : 0, to: start + shown.length }
}

/** The items of the current page. `resetKey` (for example the search text) sends the list back to page 1. */
export function usePaged<T>(items: T[], size = defaultPageSize, resetKey?: unknown): Paged<T> {
  const [page, setPage] = useState(1)
  useEffect(() => setPage(1), [resetKey, items.length])
  return { ...pageOf(items, page, size), setPage }
}

/**
 * "Showing 11–20 of 42 students" and the page links, under a paged list. When everything fits on one page it still says
 * how many there are (testing sheet: lists had no count), without page links.
 */
export function Pager<T>({ paged, noun = 'items', label }: { paged: Paged<T>; noun?: string; label?: string }) {
  if (!paged.total) return null
  if (paged.pageCount <= 1) return <p className="accs-pager accs-pager--count">{`Showing ${paged.total === 1 ? '1' : `1–${paged.total}`} of ${paged.total} ${noun}`}</p>
  return (
    <Pagination
      className="accs-pager"
      page={paged.page}
      pageCount={paged.pageCount}
      onPageChange={paged.setPage}
      label={label ?? `${noun} pages`}
      summary={`Showing ${paged.from}–${paged.to} of ${paged.total} ${noun}`}
    />
  )
}

/**
 * Pages a list without a hook in the parent: `children` gets the items of the current page, and the pager follows.
 * Name the render argument like the list (`{(rows) => ...}`) so the markup inside stays as it was.
 */
export function PagedList<T>({ items, size = defaultPageSize, noun, resetKey, children }: { items: T[]; size?: number; noun?: string; resetKey?: unknown; children: (shown: T[]) => ReactNode }) {
  const paged = usePaged(items, size, resetKey)
  return (
    <>
      {children(paged.shown)}
      <Pager paged={paged} noun={noun} />
    </>
  )
}
