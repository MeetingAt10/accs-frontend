import { describe, expect, it } from 'vitest'

import { appointmentNote, appointmentText } from './schedule'

describe('appointments', () => {
  it('shows what an appointment is for, falling back to an older free-text purpose', () => {
    expect(appointmentText({ category: 'Thesis or capstone', subcategory: 'Progress check', details: 'Chapter 3' })).toBe('Thesis or capstone · Progress check')
    expect(appointmentText({ category: 'Other (please specify)', details: 'Lost ID' })).toBe('Other (please specify) · Lost ID')
    expect(appointmentText({ purpose: 'Old topic' })).toBe('Old topic')
    expect(appointmentText({})).toBe('')
  })

  it('shows the note only when it is not already the description of an Other appointment', () => {
    expect(appointmentNote({ category: 'Thesis or capstone', subcategory: 'Progress check', details: 'Chapter 3' })).toBe('Chapter 3')
    expect(appointmentNote({ category: 'Other (please specify)', details: 'Lost ID' })).toBe('')
  })
})
