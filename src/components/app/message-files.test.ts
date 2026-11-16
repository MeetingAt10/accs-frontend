import { describe, expect, it } from 'vitest'

import { fileSize, messageFileAccept, messageFileProblem, messageFileType } from './message-files'

describe('files in messages', () => {
  it('accepts pictures and documents the API accepts', () => {
    for (const [name, type] of [['room.jpg', 'image/jpeg'], ['room.JPEG', 'image/jpeg'], ['map.png', 'image/png'], ['a.webp', 'image/webp'], ['a.gif', 'image/gif'], ['rubric.pdf', 'application/pdf'], ['notes.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'], ['list.txt', 'text/plain']]) {
      expect(messageFileProblem({ name, type, size: 1000 }), name).toBe('')
    }
    expect(messageFileAccept).toContain('image/webp')
  })

  it('names what is wrong with a file', () => {
    expect(messageFileProblem({ name: 'run.exe', type: 'application/x-msdownload', size: 10 })).toBe('Not a picture, PDF, Office or text file.')
    // Browsers often give Office files no type: the extension decides.
    expect(messageFileProblem({ name: 'Report.docx', type: '', size: 10 })).toBe('')
    expect(messageFileType({ name: 'Report.docx', type: '' })).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    expect(messageFileType({ name: 'run.exe', type: '' })).toBeUndefined()
    // The extension must match the type, as the API checks.
    expect(messageFileProblem({ name: 'photo.pdf', type: 'image/png', size: 10 })).toBe('Not a picture, PDF, Office or text file.')
    expect(messageFileProblem({ name: 'big.pdf', type: 'application/pdf', size: 10 * 1024 * 1024 + 1 })).toBe('Larger than 10 MB.')
    expect(messageFileProblem({ name: 'empty.txt', type: 'text/plain', size: 0 })).toBe('This file is empty.')
  })

  it('writes sizes people can read', () => {
    expect(fileSize(300)).toBe('1 KB')
    expect(fileSize(340 * 1024)).toBe('340 KB')
    expect(fileSize(1.25 * 1024 * 1024)).toBe('1.3 MB')
    expect(fileSize(2 * 1024 * 1024)).toBe('2 MB')
  })
})
