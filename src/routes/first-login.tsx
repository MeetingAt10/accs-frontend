import { Alert } from '@meetingat10/design-system/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useRef, useState, type FormEvent } from 'react'

import { markOnboardingPending } from '@/components/app/onboarding'
import { ApiError, completeFirstLogin, signOut } from '@/lib/api'
import { sessionQuery } from '@/lib/queries'
import { landingFor } from '@/lib/sites'

import {
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
  Title,
  useFinishAuth,
  validateAuthSearch,
} from './_auth/-auth-shell'
import { LoginShell } from './_auth/-login-shell'
import { useMascotStatus } from './_auth/-mascot'

// The one page a person with temporary sign-in details can open. Every other route sends them here.
export const Route = createFileRoute('/first-login')({
  validateSearch: validateAuthSearch,
  beforeLoad: async ({ context, search }) => {
    const session = await context.queryClient.ensureQueryData(sessionQuery()).catch(() => undefined)
    if (!session) throw redirect({ href: '/sign-in' })
    if (!session.user.mustChangeCredentials) throw redirect({ href: search.redirect ?? landingFor(session) })
  },
  component: FirstLoginPage,
})

type Errors = { password?: string; confirm?: string }

function firstLoginMessage(error: unknown) {
  if (!(error instanceof ApiError)) return "Can't reach ACCS right now. Check your connection and try again."
  if (error.status === 401) return 'Your session has ended. Sign out, then sign in again with your temporary details.'
  return error.message
}

// Same layout as sign-in (brand panel, card, mascots). The session already proves the temporary password, so the
// person only chooses a new password; the temporary username stays.
function FirstLoginPage() {
  return (
    <LoginShell>
      <Stage>
        <NewPasswordForm />
      </Stage>
    </LoginShell>
  )
}

function NewPasswordForm() {
  const { redirect: redirectTo } = Route.useSearch()
  const router = useRouter()
  const queryClient = useQueryClient()
  const session = useQuery(sessionQuery()).data
  const finish = useFinishAuth(redirectTo)
  const form = useRef<HTMLFormElement>(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const mutation = useMutation({
    mutationFn: completeFirstLogin,
    onSuccess: (next) => {
      // The account is now active: the first-run tour opens on the page the person lands on.
      markOnboardingPending(next.user.id)
      finish(next)
    },
    onError: (error) => {
      const next: Errors = {}
      if (error instanceof ApiError) {
        for (const field of error.fields ?? []) if (field.path.split('.').pop() === 'password') next.password = field.message
        // A rule the server checks itself (same as the temporary password) has no field list; it belongs under the password.
        if (error.code === 'VALIDATION_ERROR' && !next.password && !error.fields?.length) next.password = error.message
      }
      setErrors(next)
      focusFirstInvalid(form.current)
    },
  })
  useMascotStatus(mutation.status, { cheer: true })

  function submit(event: FormEvent) {
    event.preventDefault()
    const next: Errors = {
      password: passwordIsStrong(password) ? undefined : 'Use at least 10 characters with upper and lower case, a number, and a symbol.',
      confirm: password === confirm ? undefined : 'The passwords do not match.',
    }
    setErrors(next)
    if (next.password || next.confirm) return focusFirstInvalid(form.current)
    mutation.mutate({ password })
  }

  async function leave() {
    await signOut().catch(() => undefined)
    queryClient.removeQueries()
    router.history.push('/sign-in')
  }

  return (
    <>
      <Title>Set a new password</Title>
      <Sub>You signed in with a temporary password. Choose your own to continue.</Sub>
      <Form formRef={form} onSubmit={submit}>
        <Reveal show={!!mutation.error && !errors.password && !errors.confirm}>
          <Alert tone="danger" title={mutation.error ? firstLoginMessage(mutation.error) : ''} />
        </Reveal>
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
        <SubmitButton loading={mutation.isPending}>Save and continue</SubmitButton>
      </Form>
      <Foot>
        {session ? `Signed in as ${session.user.name}. ` : ''}
        <button type="button" className="au-link" onClick={() => void leave()}>
          Sign out
        </button>
      </Foot>
    </>
  )
}
