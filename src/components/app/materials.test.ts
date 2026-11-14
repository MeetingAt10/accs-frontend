import { describe, expect, it } from 'vitest'

import { fileProblem, fileSize, materialType } from './materials'

describe('class material files', () => {
  it('works out the type from the name when the browser leaves it empty', () => {
    expect(materialType({ name: 'notes.pdf', type: '' })).toBe('application/pdf')
    expect(materialType({ name: 'photo.JPEG', type: '' })).toBe('image/jpeg')
    expect(materialType({ name: 'deck.pptx', type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' })).toBe('application/vnd.openxmlformats-officedocument.presentationml.presentation')
    expect(materialType({ name: 'run.exe', type: 'application/octet-stream' })).toBeUndefined()
  })

  it('refuses empty, oversized and unsupported files before sending them', () => {
    expect(fileProblem({ name: 'a.pdf', type: 'application/pdf', size: 0 })).toMatch(/empty/)
    expect(fileProblem({ name: 'a.pdf', type: 'application/pdf', size: 26 * 1024 * 1024 })).toMatch(/25 MB/)
    expect(fileProblem({ name: 'a.zip', type: 'application/zip', size: 10 })).toMatch(/PDF, Word/)
    expect(fileProblem({ name: 'a.pdf', type: 'application/pdf', size: 10 })).toBe('')
  })

  it('shows sizes in KB or MB', () => {
    expect(fileSize(200)).toBe('1 KB')
    expect(fileSize(5 * 1024 * 1024)).toBe('5.0 MB')
  })
})
