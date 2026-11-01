import { Alert } from '@meetingat10/design-system/react'
import { useMutation } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { AnimatePresence } from 'motion/react'
import { useRef, useState, type FormEvent } from 'react'

import { ApiError, forgotPassword, resetPassword, signIn } from '@/lib/api'

import {
  AuthShell,
  focusFirstInvalid,
  Foot,
  Form,
  PasswordInput,
  PasswordStrength,
  passwordIsStrong,
  redirectIfSignedIn,
  Reveal,
  Rise,
  Stage,
  Sub,
  SubmitButton,
  TextInput,
  Title,
  useFinishAuth,
  validateAuthSearch,
} from './-auth-shell'

export const Route = createFileRoute('/_auth/sign-in')({
  validateSearch: validateAuthSearch,
  beforeLoad: redirectIfSignedIn,
  component: SignInPage,
})

function signInMessage(error: unknown) {
  if (!(error instanceof ApiError)) return "Can't reach ACCS right now. Check your connection and try again."
  if (error.code === 'INVALID_CREDENTIALS') return 'The email, ID, or password is incorrect.'
  if (error.code === 'TOO_MANY_ATTEMPTS') return 'Too many attempts. Wait 15 minutes and try again.'
  return error.message
}

type View = 'sign-in' | 'forgot' | 'reset'

function SignInPage() {
  const { redirect: redirectTo } = Route.useSearch()
  const [view, setView] = useState<View>('sign-in')
  const [emailOrId, setEmailOrId] = useState('')
  const [notice, setNotice] = useState('')

  return (
    <AuthShell>
      <AnimatePresence mode="wait">
        <Stage key={view}>
          {view === 'sign-in' && (
            <SignInForm
              redirectTo={redirectTo}
              emailOrId={emailOrId}
              setEmailOrId={setEmailOrId}
              notice={notice}
              onForgot={() => {
                setNotice('')
                setView('forgot')
              }}
            />
          )}
          {view === 'forgot' && (
            <ForgotForm
              emailOrId={emailOrId}
              setEmailOrId={setEmailOrId}
              onSent={() => setView('reset')}
              onBack={() => setView('sign-in')}
            />
          )}
          {view === 'reset' && (
            <ResetForm
              emailOrId={emailOrId}
              onDone={() => {
                setNotice('Your password was changed. Sign in with the new password.')
                setView('sign-in')
              }}
              onBack={() => setView('sign-in')}
            />
          )}
        </Stage>
      </AnimatePresence>
    </AuthShell>
  )
}

function SignInForm({
  redirectTo,
  emailOrId,
  setEmailOrId,
  notice,
  onForgot,
}: {
  redirectTo?: string
  emailOrId: string
  setEmailOrId: (value: string) => void
  notice: string
  onForgot: () => void
}) {
  const finish = useFinishAuth(redirectTo)
  const form = useRef<HTMLFormElement>(null)
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [errors, setErrors] = useState<{ emailOrId?: string; password?: string }>({})
  const mutation = useMutation({ mutationFn: signIn, onSuccess: finish })

  function submit(event: FormEvent) {
    event.preventDefault()
    const next = {
      emailOrId: emailOrId.trim() ? undefined : 'Enter your email or ID.',
      password: password ? undefined : 'Enter your password.',
    }
    setErrors(next)
    if (next.emailOrId || next.password) return focusFirstInvalid(form.current)
    mutation.mutate({ emailOrId: emailOrId.trim(), password, remember })
  }

  return (
    <>
      <Title>Sign in</Title>
      <Sub>Use your QCU email or student / employee ID.</Sub>
      <Form formRef={form} onSubmit={submit}>
        {notice && <Rise><Alert tone="success" title={notice} /></Rise>}
        <TextInput
          label="Email or ID"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          value={emailOrId}
          onChange={(event) => setEmailOrId(event.target.value)}
          error={errors.emailOrId}
        />
        <PasswordInput
          label="Password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={errors.password}
        />
        <Rise className="au-row">
          <label className="au-check">
            <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
            Remember me
          </label>
          <button type="button" className="au-link" onClick={onForgot}>
            Forgot password?
          </button>
        </Rise>
        <Reveal show={!!(mutation.error)}>
          <Alert tone="danger" title={mutation.error ? signInMessage(mutation.error) : ''} />
        </Reveal>
        <SubmitButton loading={mutation.isPending}>Sign in</SubmitButton>
      </Form>
      <Foot>
        Don't have an account?{' '}
        <Link to="/register" search={{ redirect: redirectTo }}>
          Create your QCU ACCS account
        </Link>
      </Foot>
    </>
  )
}

function ForgotForm({
  emailOrId,
  setEmailOrId,
  onSent,
  onBack,
}: {
  emailOrId: string
  setEmailOrId: (value: string) => void
  onSent: () => void
  onBack: () => void
}) {
  const form = useRef<HTMLFormElement>(null)
  const [error, setError] = useState<string>()
  const mutation = useMutation({ mutationFn: forgotPassword, onSuccess: onSent })

  function submit(event: FormEvent) {
    event.preventDefault()
    const missing = emailOrId.trim() ? undefined : 'Enter your email or ID.'
    setError(missing)
    if (missing) return focusFirstInvalid(form.current)
    mutation.mutate({ emailOrId: emailOrId.trim() })
  }

  return (
    <>
      <Title>Reset your password</Title>
      <Sub>Enter your QCU email or ID and we'll send a 6-digit code to its QCU email.</Sub>
      <Form formRef={form} onSubmit={submit}>
        <TextInput
          label="Email or ID"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          value={emailOrId}
          onChange={(event) => setEmailOrId(event.target.value)}
          error={error}
        />
        <Reveal show={!!(mutation.error)}>
          <Alert tone="danger" title={mutation.error ? signInMessage(mutation.error) : ''} />
        </Reveal>
        <SubmitButton loading={mutation.isPending}>Send reset code</SubmitButton>
      </Form>
      <Foot>
        <button type="button" className="au-link" onClick={onBack}>
          Back to sign in
        </button>
      </Foot>
    </>
  )
}

function ResetForm({ emailOrId, onDone, onBack }: { emailOrId: string; onDone: () => void; onBack: () => void }) {
  const form = useRef<HTMLFormElement>(null)
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<{ code?: string; password?: string; confirm?: string }>({})
  const mutation = useMutation({
    mutationFn: resetPassword,
    onSuccess: onDone,
    onError: (error) => {
      if (!(error instanceof ApiError) || error.status !== 400) return
      const next: typeof errors = {}
      for (const field of error.fields ?? []) {
        const key = field.path.split('.').pop()
        if (key === 'code' || key === 'password') next[key] = field.message
      }
      if (!Object.keys(next).length) next.code = 'That code is wrong or has expired. Check it or request a new one.'
      setErrors(next)
      focusFirstInvalid(form.current)
    },
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    const next = {
      code: /^\d{6}$/.test(code.trim()) ? undefined : 'Enter the 6-digit code.',
      password: passwordIsStrong(password) ? undefined : 'Use at least 10 characters with upper and lower case, a number, and a symbol.',
      confirm: password === confirm ? undefined : 'The passwords do not match.',
    }
    setErrors(next)
    if (next.code || next.password || next.confirm) return focusFirstInvalid(form.current)
    mutation.mutate({ emailOrId: emailOrId.trim(), code: code.trim(), password })
  }

  return (
    <>
      <Title>Enter your code</Title>
      <Sub>
        If an account matches, a 6-digit code was sent to its QCU email. No email? Contact the CCS office.
      </Sub>
      <Form formRef={form} onSubmit={submit}>
        <TextInput
          label="6-digit code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(event) => setCode(event.target.value)}
          error={errors.code}
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
        <Reveal show={!!(mutation.error && !errors.code)}>
          <Alert tone="danger" title={mutation.error ? signInMessage(mutation.error) : ''} />
        </Reveal>
        <SubmitButton loading={mutation.isPending}>Set new password</SubmitButton>
      </Form>
      <Foot>
        <button type="button" className="au-link" onClick={onBack}>
          Back to sign in
        </button>
      </Foot>
    </>
  )
}
