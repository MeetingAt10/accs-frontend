import { describe, expect, it } from 'vitest'

import { toneFor } from './page-shell'

describe('status colours', () => {
  it('shows done as green, waiting as yellow, refused or urgent as red, and in progress as blue', () => {
    for (const status of ['Resolved', 'Approved', 'Submitted', 'Confirmed', 'Clear', 'Finished', 'Kept', 'Low']) expect(toneFor(status), status).toBe('ok')
    for (const status of ['Requested', 'Pending', 'Not started', 'Not finished', 'Medium', 'Waiting on reporter']) expect(toneFor(status), status).toBe('warn')
    for (const status of ['Declined', 'Rejected', 'High', 'Missing', 'On hold', 'Cancelled']) expect(toneFor(status), status).toBe('danger')
    for (const status of ['With Adviser', 'With Program Chair', 'Case File at Guidance', 'With OSAS', 'Escalated']) expect(toneFor(status), status).toBe('info')
  })
})
