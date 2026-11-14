import { describe, expect, it } from 'vitest'

import { labelKey } from './community'
import { readReactions, topReactions } from './reactions'

describe('forum', () => {
  it('turns a label into the key for its colour', () => {
    expect(['Announcement', 'Announcements', 'Discussion', 'Rant', 'Assistance', 'Support'].map(labelKey)).toEqual(['announcement', 'announcement', 'discussion', 'rant', 'assistance', 'support'])
  })

  it('reads reaction counts, and an older post with one "agree" reaction as likes', () => {
    expect(readReactions({ reactionCounts: { like: 1, love: 2 }, myReaction: 'love' })).toMatchObject({ mine: 'love', total: 3 })
    expect(readReactions({ reactionCount: 4, reacted: true })).toMatchObject({ mine: 'like', total: 4 })
    expect(readReactions({})).toMatchObject({ mine: null, total: 0 })
    expect(topReactions({ like: 1, love: 3, laugh: 2 }).map((r) => r.id)).toEqual(['love', 'laugh', 'like'])
  })
})
