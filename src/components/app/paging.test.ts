import { describe, expect, it } from 'vitest'

import { pageOf } from './paging'

const items = Array.from({ length: 23 }, (_, n) => n + 1)

describe('paged lists', () => {
  it('shows ten items a page, with the numbers for "Showing 11–20 of 23"', () => {
    expect(pageOf(items, 1)).toMatchObject({ shown: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], page: 1, pageCount: 3, total: 23, from: 1, to: 10 })
    expect(pageOf(items, 2)).toMatchObject({ page: 2, from: 11, to: 20 })
    expect(pageOf(items, 3)).toMatchObject({ shown: [21, 22, 23], from: 21, to: 23 })
  })

  it('keeps the page within range when the list shrinks or the page is out of bounds', () => {
    expect(pageOf(items, 9)).toMatchObject({ page: 3, shown: [21, 22, 23] })
    expect(pageOf(items, 0)).toMatchObject({ page: 1 })
    expect(pageOf(items.slice(0, 5), 3)).toMatchObject({ page: 1, pageCount: 1, shown: [1, 2, 3, 4, 5] })
  })

  it('handles an empty list and other page sizes', () => {
    expect(pageOf([], 1)).toMatchObject({ shown: [], page: 1, pageCount: 1, total: 0, from: 0, to: 0 })
    expect(pageOf(items, 2, 8)).toMatchObject({ pageCount: 3, from: 9, to: 16 })
  })
})
