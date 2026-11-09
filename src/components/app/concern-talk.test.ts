import { describe, expect, it } from 'vitest'

import { campusIso, campusLocal, readAccess, readerAccess, readTalk, readWording, secureLink } from './concern-talk'

describe('concern talk', () => {
  it('turns campus time into one moment and back, whatever zone the browser is in', () => {
    expect(campusIso('2026-11-09T14:00')).toBe('2026-11-09T06:00:00.000Z')
    expect(campusLocal('2026-11-09T06:00:00.000Z')).toBe('2026-11-09T14:00')
    expect(campusLocal('')).toBe('')
  })

  it('accepts only https meeting links', () => {
    expect(secureLink('https://meet.example.com/room')).toBe('https://meet.example.com/room')
    for (const link of ['http://meet.example.com', 'javascript:alert(1)', 'meet.example.com', '']) expect(secureLink(link)).toBe('')
  })

  it('reads the latest consent for the way the student chose', () => {
    const talk = readTalk({
      talk: {
        mode: 'video',
        consents: [{ mode: 'chat', at: 'first' }, { mode: 'video', recordCall: false, at: 'second' }, { mode: 'video', recordCall: true, at: 'third' }],
        meetingLink: 'https://meet.example.com/room',
      },
    })
    expect(talk).toMatchObject({ mode: 'video', consentAt: 'third', recordCall: true, meetingLink: 'https://meet.example.com/room', scheduledAt: '' })
    expect(readTalk({}).mode).toBeUndefined()
    expect(readTalk({ talk: { mode: 'fax' } }).mode).toBeUndefined()
  })

  it('reads a report from before the sharing choices as not shared', () => {
    expect(readAccess({})).toEqual({ aboutAdvisor: false, allowChair: false, allowDean: false, consentAt: '', wording: '' })
    expect(readAccess({ aboutAdvisor: true, allowDean: true, consent: { at: 'T', wording: 'W' } })).toEqual({ aboutAdvisor: true, allowChair: false, allowDean: true, consentAt: 'T', wording: 'W' })
  })

  it('keeps the wording the page sent and fills in the rest', () => {
    const wording = readWording({ report: 'Sent text', talk: { chat: 'Chat text' } })
    expect(wording.report).toBe('Sent text')
    expect(wording.talk.chat).toBe('Chat text')
    expect(wording.talk.video).not.toBe('')
    expect(readWording(undefined).recording.allow).toBe('I allow this call to be recorded.')
  })
})

describe('who can read a report before it is sent', () => {
  it('shows the adviser as a reader unless the concern is about them', () => {
    expect(readerAccess({ aboutAdvisor: false, allowChair: false, allowDean: false })).toEqual([
      ['Your adviser', 'Can read it'],
      ['Your program chair', 'Cannot read it'],
      ['The Dean', 'Cannot read it'],
    ])
    expect(readerAccess({ aboutAdvisor: false, allowChair: true, allowDean: true }).map(([, can]) => can)).toEqual(['Can read it', 'Can read it', 'Can read it'])
  })

  it('leaves the adviser out and sends the report to the program chair instead', () => {
    const [adviser, chair, dean] = readerAccess({ aboutAdvisor: true, allowChair: false, allowDean: false })
    expect(adviser[1]).toMatch(/^Cannot read it/)
    expect(chair[1]).toMatch(/^Can read it.*instead/)
    expect(dean[1]).toBe('Cannot read it')
  })
})
