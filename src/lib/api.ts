export type Role =
  | 'student'
  | 'organization'
  | 'professor'
  | 'chair'
  | 'dean'
  | 'administrator'
  | 'guidance'
  | 'osas'
  | 'secretary'

export interface SessionUser {
  id: string
  name: string
  email: string
  username?: string
  roles: Role[]
  program?: string
  section?: string
  office?: string
  organizationId?: string
  restrictions: string[]
  title?: string
  /** True until the person replaces the temporary username and password they were given. */
  mustChangeCredentials?: boolean
}

export interface Session {
  user: SessionUser
  permissions: string[]
  allowedPages: string[]
  /** The name of each role, for example "System Administrator". */
  roleLabels?: Record<string, string>
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

/** A plain description of a failed request: the server's own message, or a network-error fallback. */
export const apiErrorText = (error: unknown) =>
  error instanceof ApiError ? error.message : "Can't reach ACCS right now. Check your connection and try again."

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
type Recorded<T> = Done & { record: T }

export const forgotPassword = (input: { emailOrId: string }) => post<Done>('/auth/forgot-password', input)

export const resetPassword = (input: { emailOrId: string; code: string; password: string }) =>
  post<Done>('/auth/reset-password', input)

export const changePassword = (input: { currentPassword: string; password: string }) =>
  post<Done>('/auth/change-password', input)

/** Replaces the temporary username and password. Answers with the new session. */
export const completeFirstLogin = (input: { currentPassword: string; username: string; password: string }) =>
  post<Session>('/auth/complete-first-login', input)

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

// --- Accounts. The dean activates the secretary, who creates and manages everyone else. ---

export type Program = 'BSIT' | 'BSCS' | 'BSIS'
export type AccountType = 'secretary' | 'faculty' | 'advisor' | 'chair' | 'student'

export interface AccountSummary {
  id: string
  name: string
  email: string
  roles: Role[]
  program?: string
  section?: string
  year?: number
  studentId?: string
  adviserId?: string
  active: boolean
  mustChangeCredentials?: boolean
}

export interface AccountTypeRow {
  type: AccountType
  label: string
  active: number
  inactive: number
  canManage: boolean
}

export interface FacultyAccount extends AccountSummary {
  advisorYears: number[]
  chairProgram: string | null
}

export interface Credentials {
  username: string
  temporaryPassword: string
}

export interface Invite {
  sent: boolean
  signInUrl: string
}

/** A new account with the temporary sign-in details the server shows only once. */
export interface Provisioned {
  account: AccountSummary
  credentials: Credentials
  invite: Invite
}

/** One row of a batch: created, or refused with a reason. `index` is the row's place in the request. */
export type RowResult =
  | ({ index: number; status: 'created' } & Provisioned)
  | { index: number; status: 'error'; code: string; error: string; fields?: FieldError[] }

export interface BatchResult {
  created: number
  failed: number
  results: RowResult[]
}

export interface NewFaculty {
  name: string
  email: string
  program: Program
}

export interface NewStudent extends NewFaculty {
  studentId: string
  year: number
  section: string
}

const queryString = (params: Record<string, string | undefined>) => {
  const search = new URLSearchParams(Object.entries(params).filter((entry): entry is [string, string] => !!entry[1]))
  return search.size ? '?' + search.toString() : ''
}

const put = <T>(path: string, body: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(body) })

export const getAccountTypes = () => request<{ types: AccountTypeRow[]; secretary?: AccountSummary }>('/accounts/types')

export const activateSecretary = (input: { name?: string; email?: string }) =>
  post<Recorded<Provisioned>>('/accounts/secretary/activate', input)

export const setAccountActive = (id: string, active: boolean) =>
  post<Recorded<{ id: string; active: boolean }>>('/accounts/' + encodeURIComponent(id) + '/active', { active })

/** The first 200 matches; `total` is the full count. */
export const listAccounts = (filters: { role?: Role; q?: string } = {}) =>
  request<{ accounts: AccountSummary[]; total: number }>('/accounts' + queryString(filters))

export const listFaculty = (filters: { q?: string; program?: Program } = {}) =>
  request<{ faculty: FacultyAccount[] }>('/accounts/faculty' + queryString(filters))

export const createFaculty = (faculty: NewFaculty[]) => post<Recorded<BatchResult>>('/accounts/faculty', { faculty })

/** At most 25 students per request. */
export const createStudents = (students: NewStudent[]) => post<Recorded<BatchResult>>('/accounts/students', { students })

export const getAdvisors = () =>
  request<{ advisors: { yearLevel: number; faculty: AccountSummary[] }[] }>('/accounts/advisors')

export const setAdvisors = (yearLevel: number, facultyIds: string[]) =>
  put<Recorded<{ yearLevel: number; facultyIds: string[]; studentsUpdated: number }>>('/accounts/advisors/' + yearLevel, { facultyIds })

export const setChair = (program: Program, facultyId: string) =>
  put<Recorded<{ program: Program; chairId: string; previousChairIds: string[] }>>('/accounts/chairs/' + program, { facultyId })

/** A class material file the API is waiting for, and the signed address to send it to. */
export type MaterialUpload = {
  material: { id: string; title: string; fileName?: string; status?: string }
  upload: { url: string; method: 'PUT'; headers: Record<string, string>; expiresInSeconds: number }
}

/** Starts a class material file upload (MeetingAt10/accs-backend#77). */
export const startMaterialUpload = (input: { spaceId: string; title: string; note?: string; fileName: string; contentType: string; size: number }) =>
  post<Recorded<MaterialUpload>>('/materials/uploads', input)

/** Confirms a material file once it has been sent to the signed address. */
export const completeMaterialUpload = (id: string) =>
  post<Recorded<Record<string, unknown>>>('/materials/' + encodeURIComponent(id) + '/complete', {})

/** Sends the file itself to the signed storage address. The address carries its own credentials, so no cookies go with it. */
export async function sendMaterialFile(upload: MaterialUpload['upload'], file: File) {
  const headers = Object.fromEntries(Object.entries(upload.headers).filter(([name]) => name.toLowerCase() !== 'content-length'))
  const response = await fetch(upload.url, { method: upload.method, headers, body: file })
  if (!response.ok) throw new ApiError("The file couldn't be uploaded. Try again.", response.status)
}

/** Issues a password reset code for an account (System Administrator, `role.manage`). The code is in the answer only. */
export const issueResetCode = (accountId: string) =>
  post<Recorded<{ code: string; expiresAt: string }>>('/admin/accounts/' + encodeURIComponent(accountId) + '/reset-code', {})
