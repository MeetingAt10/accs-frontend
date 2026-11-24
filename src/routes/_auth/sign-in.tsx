import { Alert } from '@meetingat10/design-system/react'
import { useMutation } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { AnimatePresence } from 'motion/react'
import { useEffect, useRef, useState, type FormEvent } from 'react'

import { ApiError, forgotPassword, resetPassword, signIn } from '@/lib/api'

import {
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
import { LoginShell } from './-login-shell'
import { useMascot, useMascotStatus } from './-mascot'

export const Route = createFileRoute('/_auth/sign-in')({
  validateSearch: validateAuthSearch,
  beforeLoad: redirectIfSignedIn,
  component: SignInPage,
})

function signInMessage(error: unknown) {
  if (!(error instanceof ApiError)) return "Can't reach ACCS right now. Check your connection and try again."
  if (error.code === 'INVALID_CREDENTIALS') return 'The email, ID, username, or password is incorrect.'
  if (error.code === 'TOO_MANY_ATTEMPTS') return 'Too many attempts. Wait 15 minutes and try again.'
  return error.message
}

type View = 'sign-in' | 'forgot' | 'reset'

// With Remember me ticked, the email or ID (never the password) is kept on this device and filled in next time.
const rememberedKey = 'accs.sign-in.remembered'
function rememberedId() {
  try {
    return localStorage.getItem(rememberedKey) ?? ''
  } catch {
    return ''
  }
}
function keepId(emailOrId: string, remember: boolean) {
  try {
    if (remember) localStorage.setItem(rememberedKey, emailOrId)
    else localStorage.removeItem(rememberedKey)
  } catch {
    // Storage can be blocked (private windows); signing in works without it.
  }
}

function SignInPage() {
  const { redirect: redirectTo, ended } = Route.useSearch()
  const [view, setView] = useState<View>('sign-in')
  const [emailOrId, setEmailOrId] = useState(rememberedId)
  const [notice, setNotice] = useState('')

  return (
    <LoginShell>
      <ViewMood view={view} />
      <AnimatePresence mode="wait">
        <Stage key={view}>
          {view === 'sign-in' && (
            <SignInForm
              redirectTo={redirectTo}
              emailOrId={emailOrId}
              setEmailOrId={setEmailOrId}
              notice={notice}
              ended={!!ended}
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
    </LoginShell>
  )
}

/** The mascots think on the forgot-password view and hold a document on the reset-code view. */
function ViewMood({ view }: { view: View }) {
  const { setView } = useMascot()
  useEffect(() => setView(view === 'sign-in' ? null : view), [view, setView])
  return null
}

function SignInForm({
  redirectTo,
  emailOrId,
  setEmailOrId,
  notice,
  ended,
  onForgot,
}: {
  redirectTo?: string
  emailOrId: string
  setEmailOrId: (value: string) => void
  notice: string
  ended: boolean
  onForgot: () => void
}) {
  const finish = useFinishAuth(redirectTo)
  const form = useRef<HTMLFormElement>(null)
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(() => rememberedId() !== '')
  const [errors, setErrors] = useState<{ emailOrId?: string; password?: string }>({})
  const mutation = useMutation({
    mutationFn: signIn,
    onSuccess: (session, input) => {
      keepId(input.emailOrId, !!input.remember)
      finish(session)
    },
  })
  const { signal } = useMascot()
  useMascotStatus(mutation.status, { cheer: true })

  function submit(event: FormEvent) {
    event.preventDefault()
    const next = {
      emailOrId: emailOrId.trim() ? undefined : 'Enter your username or email.',
      password: password ? undefined : 'Enter your password.',
    }
    setErrors(next)
    if (next.emailOrId || next.password) {
      signal('error', 2500)
      return focusFirstInvalid(form.current)
    }
    mutation.mutate({ emailOrId: emailOrId.trim(), password, remember })
  }

  return (
    <>
      <Title>Sign In</Title>
      <Sub>Enter the credentials provided by the CCS Secretary.</Sub>
      <Form formRef={form} onSubmit={submit}>
        {notice && <Rise><Alert tone="success" title={notice} /></Rise>}
        {!notice && ended && !mutation.error && (
          <Rise><Alert tone="info" title="Your session ended">Sign in again to go back to the page you were on.</Alert></Rise>
        )}
        {/* Above the fields, so a screen reader hears the problem before the fields again. */}
        <Reveal show={!!(mutation.error)}>
          <Alert tone="danger" title={mutation.error ? signInMessage(mutation.error) : ''} />
        </Reveal>
        <TextInput
          label="Username or email"
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
            Remember Me
          </label>
          <button type="button" className="au-link" onClick={onForgot}>
            Forgot Password?
          </button>
        </Rise>
        <SubmitButton loading={mutation.isPending}>Sign In</SubmitButton>
      </Form>
      <Rise className="lg-note">
        Note: If you haven’t received your account credentials, kindly contact your immediate program adviser.
      </Rise>
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
  useMascotStatus(mutation.status)

  function submit(event: FormEvent) {
    event.preventDefault()
    const missing = emailOrId.trim() ? undefined : 'Enter your email, ID, or username.'
    setError(missing)
    if (missing) return focusFirstInvalid(form.current)
    mutation.mutate({ emailOrId: emailOrId.trim() })
  }

  return (
    <>
      <Title>Reset your password</Title>
      <Sub>Enter your email, ID, or username. We will send a 6-digit code to the QCU email on that account.</Sub>
      <Form formRef={form} onSubmit={submit}>
        <TextInput
          label="Email, ID, or username"
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
  useMascotStatus(mutation.status)

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
        If an account matches, we sent a 6-digit code to its QCU email. No email? Contact the CCS office.
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
