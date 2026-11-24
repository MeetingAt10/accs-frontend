import { describe, expect, it } from 'vitest'

import { tidyDraft, tidySentences } from './draft-tidy'

describe('tidySentences', () => {
  it('cleans spacing, capitals, "i", and missing full stops without changing the words', () => {
    expect(tidySentences('  my  classmate took my charger   in the lab\ni asked him to return it')).toBe(
      'My classmate took my charger in the lab. I asked him to return it.',
    )
  })

  it('keeps question and exclamation marks', () => {
    expect(tidySentences('why was the room changed? nobody told us!')).toBe('Why was the room changed? Nobody told us!')
  })
})

describe('tidyDraft', () => {
  it('lays the draft out under What happened, When and Where from the form fields', () => {
    const result = tidyDraft({
      narrative: 'the lab schedule changed and nobody told us so our group missed the activity. please check how changes are announced',
      occurredOn: '2026-11-14',
      location: 'IC 301 laboratory',
      category: 'General concern',
    })
    expect(result.text).toBe(
      'What happened: The lab schedule changed and nobody told us so our group missed the activity. Please check how changes are announced.\n' +
        'When: 14 November 2026.\nWhere: IC 301 laboratory.',
    )
    expect(result.missing).toEqual([])
  })

  it('lists what is missing instead of making anything up', () => {
    const result = tidyDraft({ narrative: 'someone was rude to me' })
    expect(result.text).toBe('What happened: Someone was rude to me.')
    expect(result.missing).toEqual([
      'More about what happened, in your own words',
      'When it happened (the date field)',
      'Where it happened (the place field)',
      'The category that fits best',
      'What you would like the office to look at',
    ])
  })

  it('builds a structured draft from a short English report', () => {
    const result = tidyDraft({ narrative: 'my groupmate took my laptop charger in the lab yesterday', location: 'IC lab' })
    expect(result.text).toBe('What happened: My groupmate took my laptop charger in the lab yesterday.\nWhere: IC lab.')
  })

  it('builds a structured draft from a short Taglish report', () => {
    const result = tidyDraft({ narrative: 'sinigawan ako ng prof namin sa harap ng klase\nnahiya ako', occurredOn: '2026-11-20', ongoing: false })
    expect(result.text).toBe('What happened: Sinigawan ako ng prof namin sa harap ng klase. Nahiya ako.\nWhen: 20 November 2026.')
  })

  it('gives no text for an empty draft', () => {
    expect(tidyDraft({ narrative: '   ' }).text).toBe('')
  })
})
