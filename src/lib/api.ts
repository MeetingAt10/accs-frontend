export type Role =
  | 'student'
  | 'organization'
  | 'professor'
  | 'staff'
  | 'chair'
  | 'dean'
  | 'administrator'
  | 'guidance'
  | 'osas'
  | 'president'

export interface DemoAccount {
  id: string
  name: string
  email: string
  roles: Role[]
  description: string
}

export interface SessionUser {
  id: string
  name: string
  email: string
  roles: Role[]
  program?: string
  section?: string
  office?: string
  organizationId?: string
  restrictions: string[]
  title?: string
}

export interface Session {
  user: SessionUser
  permissions: string[]
  allowedPages: string[]
  sampleData: true
}

export interface PageEnvelope {
  pageId: string
  title: string
  scope: string
  sampleData: true
  data: Record<string, unknown>
}

export interface ActionResult {
  ok: true
  message: string
  record?: unknown
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly details?: unknown) {
    super(message)
    this.name = 'ApiError'
  }
}

const baseUrl = import.meta.env.VITE_API_URL ?? '/api'

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(baseUrl + path, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  })
  const body = response.status === 204 ? undefined : await response.json().catch(() => undefined)
  if (!response.ok) {
    const message = typeof body?.message === 'string'
      ? body.message
      : typeof body?.error === 'string'
        ? body.error
        : 'The request could not be completed.'
    throw new ApiError(message, response.status, body)
  }
  return body as T
}

export const getDemoAccounts = () =>
  request<{ accounts: DemoAccount[]; sampleData: true }>('/demo-accounts')

export const getSession = () => request<Session>('/session')

export const signIn = (accountId: string) =>
  request<Session>('/auth/sign-in', { method: 'POST', body: JSON.stringify({ accountId }) })

export const signOut = () =>
  request<{ ok: true; message: string }>('/auth/sign-out', { method: 'POST', body: '{}' })

export function getPage(pageId: string, recordId?: string, filters = '') {
  const params = new URLSearchParams(filters)
  if (recordId) params.set('id', recordId)
  const query = params.size ? '?' + params.toString() : ''
  return request<PageEnvelope>('/pages/' + encodeURIComponent(pageId) + query)
}

export interface PageAction {
  action: string
  recordId?: string
  payload?: Record<string, unknown>
  reason?: string
}

export function performPageAction(pageId: string, action: PageAction) {
  return request<ActionResult>('/pages/' + encodeURIComponent(pageId) + '/actions', {
    method: 'POST',
    body: JSON.stringify(action),
  })
}
