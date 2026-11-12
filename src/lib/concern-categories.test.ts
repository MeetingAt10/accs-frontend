import { describe, expect, it } from 'vitest'

import { categoryText, choicePayload, choiceProblems, cleanChoice, readCategoryOptions } from './concern-categories'

const options = readCategoryOptions([
  { label: 'Bullying', description: 'In person.', studentOnStudent: true, subcategories: ['Name-calling or insults', 'Other bullying'] },
  { label: 'Other (please specify)', description: 'Anything else.', subcategories: [], requiresDetail: true },
  { description: 'no label' },
  'junk',
])

describe('concern categories', () => {
  it('reads the options the page sent and skips malformed ones', () => {
    expect(options.map((option) => option.label)).toEqual(['Bullying', 'Other (please specify)'])
    expect(options[1].requiresDetail).toBe(true)
    expect(readCategoryOptions(undefined)).toEqual([])
  })

  it('clears an old category or a sub-category from another category, and keeps a valid one', () => {
    expect(cleanChoice({ category: 'General concern', subcategory: '', categoryDetail: '' }, options)).toEqual({ category: '', subcategory: '', categoryDetail: '' })
    expect(cleanChoice({ category: 'Bullying', subcategory: 'Weapon', categoryDetail: 'x' }, options)).toEqual({ category: 'Bullying', subcategory: '', categoryDetail: '' })
    expect(cleanChoice({ category: 'Bullying', subcategory: 'Other bullying', categoryDetail: '' }, options).subcategory).toBe('Other bullying')
    expect(cleanChoice({ category: 'Other (please specify)', subcategory: 'Other bullying', categoryDetail: 'Lost ID' }, options)).toEqual({ category: 'Other (please specify)', subcategory: '', categoryDetail: 'Lost ID' })
  })

  it('asks for a sub-category, or a description for Other', () => {
    expect(choiceProblems({ category: '', subcategory: '', categoryDetail: '' }, options)).toHaveProperty('category')
    expect(choiceProblems({ category: 'Bullying', subcategory: '', categoryDetail: '' }, options)).toHaveProperty('subcategory')
    expect(choiceProblems({ category: 'Bullying', subcategory: 'Other bullying', categoryDetail: '' }, options)).toEqual({})
    expect(choiceProblems({ category: 'Other (please specify)', subcategory: '', categoryDetail: '   ' }, options)).toHaveProperty('categoryDetail')
    expect(choiceProblems({ category: 'Other (please specify)', subcategory: '', categoryDetail: 'Lost ID' }, options)).toEqual({})
  })

  it('sends a sub-category, or only the description for Other', () => {
    expect(choicePayload({ category: 'Bullying', subcategory: 'Other bullying', categoryDetail: 'stale' }, options)).toEqual({ category: 'Bullying', subcategory: 'Other bullying' })
    expect(choicePayload({ category: 'Other (please specify)', subcategory: 'stale', categoryDetail: ' Lost ID ' }, options)).toEqual({ category: 'Other (please specify)', categoryDetail: 'Lost ID' })
  })

  it('shows "Category · Sub-category", the description for Other, or the category alone', () => {
    expect(categoryText({ category: 'Bullying', subcategory: 'Other bullying' })).toBe('Bullying · Other bullying')
    expect(categoryText({ category: 'Other (please specify)', categoryDetail: 'Lost ID' })).toBe('Other (please specify) · Lost ID')
    expect(categoryText({ category: 'Facilities' })).toBe('Facilities')
    expect(categoryText({})).toBe('General concern')
  })
})
