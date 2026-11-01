import { Alert } from '@meetingat10/design-system/react'
import { useMutation } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { motion } from 'motion/react'
import { useRef, useState, type FormEvent } from 'react'

import { ApiError, register, type RegisterInput } from '@/lib/api'

import {
  AuthShell,
  Field,
  focusFirstInvalid,
  Foot,
  Form,
  Group,
  PasswordInput,
  PasswordStrength,
  passwordIsStrong,
  redirectIfSignedIn,
  Reveal,
  Rise,
  Stage,
  SubmitButton,
  TextInput,
  Title,
  useFinishAuth,
  validateAuthSearch,
} from './-auth-shell'

export const Route = createFileRoute('/_auth/register')({
  validateSearch: validateAuthSearch,
  beforeLoad: redirectIfSignedIn,
  component: RegisterPage,
})

type Role = RegisterInput['role']
type Errors = Partial<Record<string, string>>

const roles: { value: Role; label: string }[] = [
  { value: 'student', label: 'Student' },
  { value: 'professor', label: 'Faculty' },
  { value: 'staff', label: 'CCS staff' },
]
const programs = ['BSIT', 'BSCS', 'BSIS']
const years = ['1', '2', '3', '4']
const sections = ['A', 'B', 'C', 'D', 'E', 'F']

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const idPattern = (role: Role) => (role === 'student' ? /^\d{2}-\d{4}$/ : /^(\d{2}|\d{4})-\d{4}$/)

function Pick({
  label,
  value,
  options,
  error,
  onChange,
}: {
  label: string
  value: string
  options: string[]
  error?: string
  onChange: (value: string) => void
}) {
  return (
    <Field label={label} error={error}>
      {(aria) => (
        <select className="au-input" {...aria} value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">Select</option>
          {options.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      )}
    </Field>
  )
}

function RegisterPage() {
  const { redirect: redirectTo } = Route.useSearch()
  const finish = useFinishAuth(redirectTo)
  const form = useRef<HTMLFormElement>(null)
  const [values, setValues] = useState({
    fullName: '',
    email: '',
    identifier: '',
    role: 'student' as Role,
    program: '',
    yearLevel: '',
    section: '',
    password: '',
    confirm: '',
  })
  const [errors, setErrors] = useState<Errors>({})
  const set = (key: keyof typeof values) => (value: string) => setValues((prev) => ({ ...prev, [key]: value }))
  const input = (key: keyof typeof values) => ({
    value: values[key],
    onChange: (event: { target: { value: string } }) => set(key)(event.target.value),
    error: errors[key],
  })

  const mutation = useMutation({
    mutationFn: register,
    onSuccess: finish,
    onError: (error) => {
      if (!(error instanceof ApiError)) return
      const next: Errors = {}
      for (const field of error.fields ?? []) next[field.path.split('.').pop() ?? ''] = field.message
      // A conflict names the email or the ID in its message.
      if (error.status === 409 && !Object.keys(next).length) next[/e-?mail/i.test(error.message) ? 'email' : 'identifier'] = error.message
      setErrors(next)
      if (Object.keys(next).length) focusFirstInvalid(form.current)
    },
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    const v = values
    const student = v.role === 'student'
    const next: Errors = {
      fullName: v.fullName.trim().length >= 2 ? undefined : 'Enter your full name.',
      email: emailPattern.test(v.email.trim()) ? undefined : 'Enter a valid email address.',
      identifier: idPattern(v.role).test(v.identifier.trim())
        ? undefined
        : student ? 'Enter your student ID as 24-1234.' : 'Enter your employee ID as 24-1234 or 2024-1234.',
      program: !student || v.program ? undefined : 'Select your program.',
      yearLevel: !student || v.yearLevel ? undefined : 'Select your year level.',
      section: !student || v.section ? undefined : 'Select your section.',
      password: passwordIsStrong(v.password) ? undefined : 'Use at least 10 characters with upper and lower case, a number, and a symbol.',
      confirm: v.password === v.confirm ? undefined : 'The passwords do not match.',
    }
    setErrors(next)
    if (Object.values(next).some(Boolean)) return focusFirstInvalid(form.current)
    mutation.mutate({
      fullName: v.fullName.trim(),
      email: v.email.trim(),
      identifier: v.identifier.trim(),
      role: v.role,
      ...(student && { program: v.program as RegisterInput['program'], yearLevel: Number(v.yearLevel), section: v.section }),
      password: v.password,
    })
  }

  const formError =
    mutation.error && (!(mutation.error instanceof ApiError) || !Object.keys(errors).some((key) => errors[key]))
      ? mutation.error instanceof ApiError
        ? mutation.error.status === 429 ? 'Too many attempts. Try again later.' : mutation.error.message
        : "Can't reach ACCS right now. Check your connection and try again."
      : undefined

  return (
    <AuthShell wide>
      <Stage>
      <Title>Create your ACCS account</Title>
      <Form formRef={form} onSubmit={submit}>
        <Group>
          <legend>About you</legend>
          <TextInput label="Full name" autoComplete="name" {...input('fullName')} />
          <TextInput
            label="QCU email"
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            hint="Use your @qcu.edu.ph address"
            {...input('email')}
          />
          <TextInput
            label="Student or employee ID"
            autoComplete="off"
            spellCheck={false}
            hint="Example: 24-1234"
            {...input('identifier')}
          />
        </Group>

        <Group>
          <legend>Your role at CCS</legend>
          <Rise className="au-seg">
            {roles.map((role) => (
              <label key={role.value}>
                <input
                  type="radio"
                  name="role"
                  value={role.value}
                  checked={values.role === role.value}
                  onChange={() => set('role')(role.value)}
                />
                {values.role === role.value && (
                  <motion.i className="au-seg__pill" layoutId="role-pill" transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }} />
                )}
                <span>{role.label}</span>
              </label>
            ))}
          </Rise>
          <Rise>
            <Reveal show={values.role === 'student'}>
              <div className="au-trio">
              <Pick label="Program" options={programs} value={values.program} error={errors.program} onChange={set('program')} />
              <Pick label="Year level" options={years} value={values.yearLevel} error={errors.yearLevel} onChange={set('yearLevel')} />
              <Pick label="Section" options={sections} value={values.section} error={errors.section} onChange={set('section')} />
              </div>
            </Reveal>
          </Rise>
          <p className="au-hint">
            The CCS administrator creates accounts for chairs, deans, guidance, OSAS, and administrators.
          </p>
        </Group>

        <Group>
          <legend>Choose a password</legend>
          <PasswordInput label="Password" autoComplete="new-password" {...input('password')} />
          <PasswordStrength password={values.password} />
          <PasswordInput label="Confirm password" autoComplete="new-password" {...input('confirm')} />
        </Group>

        <div aria-live="polite">
          <Reveal show={!!formError}>
            <Alert tone="danger" title={formError ?? ''} />
          </Reveal>
        </div>
        <SubmitButton loading={mutation.isPending}>Create account</SubmitButton>
      </Form>
      <Foot>
        Already have an account?{' '}
        <Link to="/sign-in" search={{ redirect: redirectTo }}>
          Sign in
        </Link>
      </Foot>
      </Stage>
    </AuthShell>
  )
}
