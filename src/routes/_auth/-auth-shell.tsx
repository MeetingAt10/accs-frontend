import { DoorPlate, Icon, Spinner } from '@meetingat10/design-system/react'
import { useQueryClient } from '@tanstack/react-query'
import { redirect, useRouter } from '@tanstack/react-router'
import { AnimatePresence, motion, MotionConfig, type Variants } from 'motion/react'
import { useId, useState, type FormEvent, type ReactNode, type RefObject } from 'react'

import type { Session } from '@/lib/api'
import { sessionQuery } from '@/lib/queries'
import { landingFor, siteHref } from '@/lib/sites'
import type { QueryClient } from '@tanstack/react-query'

import './auth.css'

export const validateAuthSearch = (search: Record<string, unknown>) => ({
  redirect: typeof search.redirect === 'string' && search.redirect.startsWith('/') && !search.redirect.startsWith('//')
    ? search.redirect
    : undefined,
})

/** Where a session goes next: the page it asked for, else its landing page. Temporary sign-in details come first. */
export function destinationFor(session: Session, redirectTo?: string) {
  if (session.user.mustChangeCredentials) return '/first-login' + (redirectTo ? '?redirect=' + encodeURIComponent(redirectTo) : '')
  return siteHref(redirectTo ?? landingFor(session))
}

/** beforeLoad for /sign-in: a signed-in visitor goes straight to their landing page. */
export async function redirectIfSignedIn({ context, search }: { context: { queryClient: QueryClient }; search: { redirect?: string } }) {
  const session = await context.queryClient.ensureQueryData(sessionQuery()).catch(() => undefined)
  if (session) throw redirect({ href: destinationFor(session, search.redirect) })
}

/** Stores the new session, then navigates (full-page when the destination is another site). */
export function useFinishAuth(redirectTo?: string) {
  const router = useRouter()
  const queryClient = useQueryClient()
  return (session: Session) => {
    queryClient.setQueryData(['session'], session)
    const destination = destinationFor(session, redirectTo)
    if (destination.startsWith('/')) router.history.push(destination)
    else window.location.assign(destination)
  }
}

/** Focus the first field marked invalid, after React has rendered the errors. */
export function focusFirstInvalid(form: HTMLFormElement | null) {
  requestAnimationFrame(() => form?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
}

const ease = [0.16, 1, 0.3, 1] as const

export const rise: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease } },
}
const stagger = (gap: number, delay = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: gap, delayChildren: delay } },
  exit: { opacity: 0, x: -16, transition: { duration: 0.16, ease: 'easeIn' } },
})
const fade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.3, staggerChildren: 0.05 } },
}
const word: Variants = {
  hidden: { y: '110%' },
  show: { y: 0, transition: { duration: 0.6, ease } },
}

/** One panel of the right column. Key it per view inside AnimatePresence to swap panels; children rise in sequence. */
export function Stage({ children }: { children: ReactNode }) {
  return (
    <motion.div variants={stagger(0.07)} initial="hidden" animate="show" exit="exit">
      {children}
    </motion.div>
  )
}

export const Title = ({ children }: { children: ReactNode }) => (
  <motion.h1 className="au-title" variants={rise}>{children}</motion.h1>
)
export const Sub = ({ children }: { children: ReactNode }) => (
  <motion.p className="au-sub" variants={rise}>{children}</motion.p>
)
export const Foot = ({ children }: { children: ReactNode }) => (
  <motion.p className="au-foot" variants={rise}>{children}</motion.p>
)
export const Form = ({ children, formRef, onSubmit }: { children: ReactNode; formRef: RefObject<HTMLFormElement | null>; onSubmit: (event: FormEvent) => void }) => (
  <motion.form ref={formRef} className="au-form" noValidate onSubmit={onSubmit} variants={stagger(0.05)}>
    {children}
  </motion.form>
)
export const Rise = ({ children, className }: { children: ReactNode; className?: string }) => (
  <motion.div className={className} variants={rise}>{children}</motion.div>
)
export const Group = ({ children }: { children: ReactNode }) => (
  <motion.fieldset className="au-set" variants={fade}>{children}</motion.fieldset>
)

/** Height-and-fade reveal for messages. `gap` cancels the parent grid gap while collapsed so nothing jumps. */
export function Reveal({ show, gap = 16, children }: { show: boolean; gap?: number; children: ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          style={{ overflow: 'hidden' }}
          initial={{ height: 0, opacity: 0, marginTop: -gap }}
          animate={{ height: 'auto', opacity: 1, marginTop: 0, transitionEnd: { overflow: 'visible' } }}
          exit={{ height: 0, opacity: 0, marginTop: -gap, overflow: 'hidden' }}
          transition={{ duration: 0.28, ease }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function SubmitButton({ loading, children }: { loading: boolean; children: ReactNode }) {
  return (
    <motion.div variants={rise}>
      <button type="submit" className="au-submit" disabled={loading} aria-busy={loading}>
        <motion.span
          className="au-submit__spin"
          initial={false}
          animate={{ width: loading ? 20 : 0, marginRight: loading ? 10 : 0, opacity: loading ? 1 : 0 }}
          transition={{ duration: 0.25, ease }}
          aria-hidden
        >
          <Spinner size={20} />
        </motion.span>
        {children}
      </button>
    </motion.div>
  )
}

const facts = ['Join your class spaces', 'Book a faculty consultation', 'Send a confidential report']

const headline = 'The CCS office, online.'

export function AuthShell({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <MotionConfig reducedMotion="user">
      <div className="au">
        <aside className="au-brand" aria-label="About ACCS">
          <motion.div className="au-brand__inner" variants={stagger(0.09, 0.1)} initial="hidden" animate="show">
            <motion.div
              className="au-brand__plate"
              variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, ease } } }}
            >
              <DoorPlate size="lg" code="CCS" className="au-plate-lg" />
              <DoorPlate size="sm" code="CCS" className="au-plate-sm" />
            </motion.div>
            <motion.div className="au-brand__id" variants={rise}>
              <strong className="au-brand__name">ACCS</strong>
              <span className="au-brand__line">QCU · College of Computer Studies</span>
            </motion.div>
            <motion.h2 className="au-brand__headline" variants={stagger(0.045)}>
              {headline.split(' ').map((w, index) => (
                <span key={index}>
                  <span className="au-word">
                    <motion.span variants={word}>{w}</motion.span>
                  </span>{' '}
                </span>
              ))}
            </motion.h2>
            <motion.ul className="au-brand__facts" variants={stagger(0.1)}>
              {facts.map((fact) => (
                <motion.li key={fact} variants={rise}>
                  {fact}
                </motion.li>
              ))}
            </motion.ul>
          </motion.div>
        </aside>
        <main className="au-main">
          <div className="au-col" data-wide={wide || undefined}>
            {children}
          </div>
        </main>
      </div>
    </MotionConfig>
  )
}

type FieldAria = { id: string; 'aria-describedby'?: string; 'aria-invalid'?: true }

/** Visible label, hint, and error tied to the control through the aria props handed to `children`. */
export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: string
  error?: string
  children: (aria: FieldAria) => ReactNode
}) {
  const id = useId()
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined
  return (
    <motion.div className="au-field" variants={rise}>
      <label htmlFor={id}>{label}</label>
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined })}
      {hint && <p id={`${id}-hint`} className="au-hint">{hint}</p>}
      <Reveal show={!!error} gap={6}>
        <p id={`${id}-error`} className="au-error">{error}</p>
      </Reveal>
    </motion.div>
  )
}

type InputProps = Omit<React.ComponentProps<'input'>, 'id' | 'children'>

export function TextInput({ label, hint, error, ...props }: InputProps & { label: string; hint?: string; error?: string }) {
  return (
    <Field label={label} hint={hint} error={error}>
      {(aria) => <input className="au-input" {...aria} {...props} />}
    </Field>
  )
}

export function PasswordInput({ label, hint, error, ...props }: InputProps & { label: string; hint?: string; error?: string }) {
  const [shown, setShown] = useState(false)
  return (
    <Field label={label} hint={hint} error={error}>
      {(aria) => (
        <div className="au-password">
          <input className="au-input" {...aria} {...props} type={shown ? 'text' : 'password'} />
          <button
            type="button"
            className="au-eye"
            aria-label="Show password"
            aria-pressed={shown}
            onClick={() => setShown(!shown)}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={String(shown)}
                className="au-eye__icon"
                initial={{ opacity: 0, scale: 0.6, rotate: -20 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, scale: 0.6, rotate: 20 }}
                transition={{ duration: 0.14 }}
              >
                <Icon name={shown ? 'eye-slash' : 'eye'} size={20} />
              </motion.span>
            </AnimatePresence>
          </button>
        </div>
      )}
    </Field>
  )
}

export const passwordRules = [
  { label: 'At least 10 characters', test: (p: string) => p.length >= 10 },
  { label: 'Upper and lower case letters', test: (p: string) => /[a-z]/.test(p) && /[A-Z]/.test(p) },
  { label: 'A number', test: (p: string) => /\d/.test(p) },
  { label: 'A symbol', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
]

export const passwordIsStrong = (password: string) => passwordRules.every((rule) => rule.test(password))

const strengthLabels = ['Weak', 'Weak', 'Fair', 'Good', 'Strong']

export function PasswordStrength({ password }: { password: string }) {
  const met = passwordRules.filter((rule) => rule.test(password)).length
  const filled = password ? Math.max(met, 1) : 0
  return (
    <motion.div className="au-strength" variants={rise}>
      <div className="au-strength__bar" data-level={filled}>
        {passwordRules.map((rule, index) => (
          <span key={rule.label}>
            <motion.i
              initial={false}
              animate={{ scaleX: index < filled ? 1 : 0 }}
              transition={{ duration: 0.4, ease, delay: index < filled ? index * 0.05 : 0 }}
            />
          </span>
        ))}
      </div>
      <p className="au-strength__label" aria-live="polite">
        Password strength
        <AnimatePresence mode="wait" initial={false}>
          {password && (
            <motion.b
              key={strengthLabels[met]}
              data-level={filled}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16 }}
            >
              {strengthLabels[met]}
            </motion.b>
          )}
        </AnimatePresence>
      </p>
      <ul className="au-checks">
        {passwordRules.map((rule) => {
          const ok = rule.test(password)
          return (
            <li key={rule.label} data-met={ok || undefined}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={String(ok)}
                  className="au-checks__icon"
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.4, opacity: 0 }}
                  transition={{ duration: 0.16 }}
                >
                  <Icon name={ok ? 'check' : 'circle-dashed'} size={16} />
                </motion.span>
              </AnimatePresence>
              {rule.label}
              <span className="au-sr">{ok ? ' (met)' : ' (not met)'}</span>
            </li>
          )
        })}
      </ul>
    </motion.div>
  )
}
