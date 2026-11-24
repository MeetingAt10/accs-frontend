import { ApiError } from './api'

/**
 * Where a failed request has to send the person, if anywhere. Only an ended session ("Sign in to continue") goes to
 * Sign in, and only temporary sign-in details go to First login. A wrong password on the sign-in form is also a 401,
 * but with its own code, so the form keeps showing its own message.
 */
export function authRedirectFor(error: unknown): 'sign-in' | 'first-login' | undefined {
  if (!(error instanceof ApiError)) return undefined
  if (error.status === 401 && (error.code === 'UNAUTHENTICATED' || error.code === 'SESSION_EXPIRED')) return 'sign-in'
  if (error.status === 403 && error.code === 'CREDENTIALS_CHANGE_REQUIRED') return 'first-login'
  return undefined
}

/** Pages that must not bounce to Sign in when a request there finds no session: they are where that leads. */
export const signedOutPaths = ['/sign-in', '/first-login']

/** Whether the server found an old session cookie that no longer works, as opposed to no session at all (a first visit). */
export function isSessionExpired(error: unknown) {
  return error instanceof ApiError && error.status === 401 && error.code === 'SESSION_EXPIRED'
}

/**
 * The Sign in address for a person turned away on `here`, so they come back to the same page. Only a session that
 * really ended (`ended`) adds the "Your session ended" notice; a first visit just signs in.
 */
export function sessionEndedHref(here: string, ended = true) {
  const back = here.startsWith('/') && !here.startsWith('//') && !signedOutPaths.some((path) => here.startsWith(path)) ? here : ''
  const params = [ended ? 'ended=1' : '', back ? 'redirect=' + encodeURIComponent(back) : ''].filter(Boolean).join('&')
  return '/sign-in' + (params ? '?' + params : '')
}

/**
 * Whether to try a page request again. A request turned away for being one too many (429) or a server or network
 * failure is worth one or two more tries; anything else (no access, not found, a bad filter) is the answer.
 */
export function shouldRetry(failureCount: number, error: Error) {
  if (failureCount >= 2) return false
  if (!(error instanceof ApiError)) return true
  return error.status === 429 || error.status >= 500
}

/** 0.5 s, then 1 s. */
export const retryDelay = (attempt: number) => 500 * 2 ** attempt
