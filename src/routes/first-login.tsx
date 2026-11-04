import { Alert } from '@meetingat10/design-system/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useRef, useState, type FormEvent } from 'react'

import { ApiError, completeFirstLogin, signOut } from '@/lib/api'
import { sessionQuery } from '@/lib/queries'
import { landingFor, siteHref } from '@/lib/sites'

import {
  AuthShell,
  focusFirstInvalid,
  Foot,
  Form,
  PasswordInput,
  PasswordStrength,
  passwordIsStrong,
  Reveal,
  Stage,
  Sub,
  SubmitButton,
  TextInput,
  Title,
  useFinishAuth,
  validateAuthSearch,
} from './_auth/-auth-shell'

// The one page a person with temporary sign-in details can open. Every other route sends them here.
export const Route = createFileRoute('/first-login')({
  validateSearch: validateAuthSearch,
  beforeLoad: async ({ context, search }) => {
    const session = await context.queryClient.ensureQueryData(sessionQuery()).catch(() => undefined)
    if (!session) throw redirect({ href: '/sign-in' })
    if (!session.user.mustChangeCredentials) throw redirect({ href: siteHref(search.redirect ?? landingFor(session)) })
  },
  component: FirstLoginPage,
})

type Errors = { current?: string; username?: string; password?: string; confirm?: string }

// The server applies the same rules to a new username.
const usernameProblem = (username: string) =>
  username.length < 3
    ? 'Use at least 3 characters.'
    : username.length > 32
      ? 'Use at most 32 characters.'
      : /^[a-z0-9][a-z0-9._-]*$/.test(username)
        ? undefined
        : 'Use letters, numbers, dots, dashes, or underscores.'

function firstLoginMessage(error: unknown) {
  if (!(error instanceof ApiError)) return "Can't reach ACCS right now. Check your connection and try again."
  if (error.status === 401) return 'Your session has ended. Sign out, then sign in again with your temporary details.'
  return error.message
}

function FirstLoginPage() {
  const { redirect: redirectTo } = Route.useSearch()
  const router = useRouter()
  const queryClient = useQueryClient()
  const session = useQuery(sessionQuery()).data
  const finish = useFinishAuth(redirectTo)
  const form = useRef<HTMLFormElement>(null)
  const [current, setCurrent] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const mutation = useMutation({
    mutationFn: completeFirstLogin,
    onSuccess: finish,
    onError: (error) => {
      const next: Errors = {}
      if (error instanceof ApiError) {
        if (error.code === 'INVALID_CREDENTIALS') next.current = 'That is not the temporary password you were given. Check it and try again.'
        for (const field of error.fields ?? []) {
          const key = field.path.split('.').pop()
          if (key === 'username' || key === 'password') next[key] = field.message
        }
      }
      setErrors(next)
      focusFirstInvalid(form.current)
    },
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    const chosen = username.trim().toLowerCase()
    const next: Errors = {
      current: current ? undefined : 'Enter the temporary password you were given.',
      username:
        usernameProblem(chosen) ??
        (chosen === session?.user.username?.toLowerCase() ? 'Choose a username that is different from the temporary one.' : undefined),
      password: !passwordIsStrong(password)
        ? 'Use at least 10 characters with upper and lower case, a number, and a symbol.'
        : password === current
          ? 'Choose a password that is different from the temporary one.'
          : undefined,
      confirm: password === confirm ? undefined : 'The passwords do not match.',
    }
    setErrors(next)
    if (Object.values(next).some(Boolean)) return focusFirstInvalid(form.current)
    mutation.mutate({ currentPassword: current, username: chosen, password })
  }

  async function leave() {
    await signOut().catch(() => undefined)
    queryClient.removeQueries()
    router.history.push('/sign-in')
  }

  return (
    <AuthShell>
      <Stage>
        <Title>Choose your sign-in details</Title>
        <Sub>
          You signed in with a temporary username and password. Choose your own to continue. Nothing else opens until you do.
        </Sub>
        <Form formRef={form} onSubmit={submit}>
          <PasswordInput
            label="Temporary password"
            autoComplete="current-password"
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
            error={errors.current}
          />
          <TextInput
            label="New username"
            hint="3 to 32 letters, numbers, dots, dashes, or underscores. You can sign in with it instead of your email."
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            error={errors.username}
          />
          <PasswordInput
            label="New password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={errors.password}
          />
          <PasswordStrength password={password} />
          <PasswordInput
            label="Confirm new password"
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            error={errors.confirm}
          />
          <Reveal show={!!mutation.error && !Object.values(errors).some(Boolean)}>
            <Alert tone="danger" title={mutation.error ? firstLoginMessage(mutation.error) : ''} />
          </Reveal>
          <SubmitButton loading={mutation.isPending}>Save and continue</SubmitButton>
        </Form>
        <Foot>
          {session ? `Signed in as ${session.user.name}. ` : ''}
          <button type="button" className="au-link" onClick={() => void leave()}>
            Sign out
          </button>
        </Foot>
      </Stage>
    </AuthShell>
  )
}
