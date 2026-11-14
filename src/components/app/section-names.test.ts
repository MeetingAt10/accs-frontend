import { describe, expect, it } from 'vitest'

import { isSectionGroup, sectionCode, sortBySection } from './community'

describe('section names', () => {
  const group = { title: 'SBIT3A', subject: 'Section group' }
  const subject = { title: 'Data Structures, SBIT3A', subject: 'CC 104 Data Structures' }
  const other = { title: 'SBCS2A', subject: 'Section group' }

  it('shows every space under its section code', () => {
    expect(sectionCode(group)).toBe('SBIT3A')
    expect(sectionCode(subject)).toBe('SBIT3A')
    expect(isSectionGroup(group)).toBe(true)
    expect(isSectionGroup(subject)).toBe(false)
  })

  it('lists a section group first, then its subjects, section by section', () => {
    expect(sortBySection([subject, other, group]).map((space) => space.title)).toEqual(['SBCS2A', 'SBIT3A', 'Data Structures, SBIT3A'])
  })
})
