import { beforeEach, describe, expect, it } from 'vitest'

import { readDraft, removeDraft, writeDraft } from './local-draft'

const store = new Map<string, string>()
beforeEach(() => {
  store.clear()
  Object.assign(globalThis, {
    localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) },
  })
})

describe('local draft storage', () => {
  it('round-trips and merges over the initial value', () => {
    writeDraft('k', { body: 'hi' })
    expect(readDraft('k', { body: '', title: 't' })).toEqual({ body: 'hi', title: 't' })
  })

  it('falls back to initial when nothing or junk is stored', () => {
    expect(readDraft('k', { a: 1 })).toEqual({ a: 1 })
    store.set('k', '{not json')
    expect(readDraft('k', { a: 1 })).toEqual({ a: 1 })
  })

  it('removes the draft', () => {
    writeDraft('k', { a: 2 })
    removeDraft('k')
    expect(readDraft('k', { a: 1 })).toEqual({ a: 1 })
  })
})
