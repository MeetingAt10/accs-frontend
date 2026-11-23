import { describe, expect, it } from 'vitest'

import { keepFilteredPage } from '@/lib/queries'

describe('keeping a page while its filters change', () => {
  it('keeps the same page and record, whatever the filters', () => {
    expect(keepFilteredPage(['page', 'P04', undefined, 'q=ex'], 'P04')).toBe(true)
    expect(keepFilteredPage(['page', 'P22', 'RPT-1', ''], 'P22', 'RPT-1')).toBe(true)
  })

  it('starts fresh for another page or record, or with nothing before', () => {
    expect(keepFilteredPage(['page', 'P04', undefined, ''], 'P13')).toBe(false)
    expect(keepFilteredPage(['page', 'P22', 'RPT-1', ''], 'P22', 'RPT-2')).toBe(false)
    expect(keepFilteredPage(undefined, 'P04')).toBe(false)
  })
})
