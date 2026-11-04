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

export interface FieldError {
  path: string
  message: string
}

export class ApiError extends Error {
  readonly code?: string
  readonly fields?: FieldError[]

  constructor(message: string, readonly status: number, readonly details?: unknown) {
    super(message)
    this.name = 'ApiError'
    const body = details as { code?: unknown; fields?: unknown } | undefined
    if (typeof body?.code === 'string') this.code = body.code
    if (Array.isArray(body?.fields)) this.fields = body.fields as FieldError[]
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

export const getSession = () => request<Session>('/session')

const post = <T>(path: string, body: unknown) =>
  request<T>(path, { method: 'POST', body: JSON.stringify(body) })

export const signIn = (input: { emailOrId: string; password: string; remember?: boolean }) =>
  post<Session>('/auth/sign-in', input)

type Done = { ok: true; message: string }

export const forgotPassword = (input: { emailOrId: string }) => post<Done>('/auth/forgot-password', input)

export const resetPassword = (input: { emailOrId: string; code: string; password: string }) =>
  post<Done>('/auth/reset-password', input)

export const changePassword = (input: { currentPassword: string; password: string }) =>
  post<Done>('/auth/change-password', input)

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
