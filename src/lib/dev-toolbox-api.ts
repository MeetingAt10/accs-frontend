import { ApiError, type Session } from '@/lib/api'

// Development-stack routes (docs/deltas/2026-11-05-consultation-50-percent.md, slice E). Any other stack answers 404,
// and a signed-out caller gets 401. Only the dev toolbox imports this file, so other builds never carry it.

export interface DevUser {
  id: string
  name: string
  roles: string[]
  active: boolean
  username?: string
}

const baseUrl = import.meta.env.VITE_API_URL ?? '/api'

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(baseUrl + path, {
    ...init,
    credentials: 'include',
    headers: init.body ? { 'Content-Type': 'application/json' } : undefined,
  })
  const body = await response.json().catch(() => undefined)
  if (!response.ok) {
    const message = typeof body?.error === 'string' ? body.error : typeof body?.message === 'string' ? body.message : 'The request could not be completed.'
    throw new ApiError(message, response.status, body)
  }
  return body as T
}

export const listDevUsers = () => request<{ users: DevUser[] }>('/dev/users').then((body) => body.users)

/** Ends the current session and starts one for `userId`. Answers with the new session. */
export const switchDevUser = (userId: string) =>
  request<Session>('/dev/switch-user', { method: 'POST', body: JSON.stringify({ userId }) })
