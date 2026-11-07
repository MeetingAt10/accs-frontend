import { describe, expect, it } from 'vitest'

import { ApiError, apiErrorText } from './api'

describe('apiErrorText', () => {
  it('is the server message for an ApiError', () => {
    expect(apiErrorText(new ApiError('The session could not be ended.', 500))).toBe('The session could not be ended.')
    expect(apiErrorText(new ApiError('Forbidden', 403))).toBe('Forbidden')
  })

  it('is the network-error fallback for anything else', () => {
    expect(apiErrorText(new TypeError('Failed to fetch'))).toBe("Can't reach ACCS right now. Check your connection and try again.")
    expect(apiErrorText(new Error('boom'))).toBe("Can't reach ACCS right now. Check your connection and try again.")
    expect(apiErrorText(undefined)).toBe("Can't reach ACCS right now. Check your connection and try again.")
  })
})
