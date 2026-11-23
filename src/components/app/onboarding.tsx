import { Button, Icon, Modal, ModalActions, ModalBody, type IconName } from '@meetingat10/design-system/react'
import { useState } from 'react'

import { assistantIcon } from '@/components/app/assistant-icon'
import { moduleTiles } from '@/components/app/module-picker'
import { NavLink, type Destination } from '@/components/app/site-chrome'
import type { Session } from '@/lib/api'
import { roleLabel } from '@/lib/sites'

import './onboarding.css'

// First-run onboarding (2026-11-23). A newly activated account sees it once, right after it replaces its temporary
// sign-in details on /first-login: who they are in ACCS, what their role can do, and where things are.
// The first-login page marks the person as pending; closing the tour clears the mark for good.

const pendingKey = 'accs.onboarding.pending'

/** Called when the person finishes first login, so the tour opens on the page they land on. */
export function markOnboardingPending(userId: string) {
  try {
    localStorage.setItem(pendingKey, userId)
  } catch {
    // Private mode: no tour, nothing else breaks.
  }
}

function isPending(userId: string) {
  try {
    return localStorage.getItem(pendingKey) === userId
  } catch {
    return false
  }
}

function clearPending() {
  try {
    localStorage.removeItem(pendingKey)
  } catch {
    // Nothing to clear.
  }
}

/** What this person can do: their role's Home modules, or the sites they may open when the role has none. */
function abilities(session: Session, destinations: Destination[]) {
  const tiles = moduleTiles(session)
  if (tiles.length) return tiles.map(({ id, label, about, icon, href }) => ({ id, label, about, icon: icon as string, href }))
  return destinations
    .filter(({ site }) => site.id !== 'portal')
    .map(({ site, href }) => ({ id: site.id, label: site.label, about: site.purpose, icon: site.icon, href }))
}

const places: { icon: IconName | 'assistant'; title: string; text: string }[] = [
  { icon: 'list', title: 'Navigation', text: 'The sidebar lists everything you can open. On a phone, use the tabs at the bottom and More.' },
  { icon: 'search', title: 'Search', text: 'Find posts, people and cases from the search box at the top. Press Ctrl K (⌘K on a Mac) to jump to a page.' },
  { icon: 'assistant', title: 'ACCS Assistant', text: 'Ask where things are or how a request moves. It explains; staff make the decisions.' },
  { icon: 'bell', title: 'Notifications', text: 'The bell shows replies, updates on reports, and appointment changes.' },
  { icon: 'user', title: 'Your account', text: 'Your name at the top opens your profile, settings and sign out.' },
]

export function Onboarding({ session, destinations }: { session: Session; destinations: Destination[] }) {
  const [open, setOpen] = useState(() => isPending(session.user.id))
  const [step, setStep] = useState(0)
  if (!open) return null

  const roles = session.user.roles.map(roleLabel).join(' and ')
  const scope = session.user.program || session.user.office
  const list = abilities(session, destinations)
  const steps = ['Welcome', 'What you can do', 'Where things are']
  const last = step === steps.length - 1

  function close() {
    clearPending()
    setOpen(false)
  }

  return (
    <Modal title={step === 0 ? `Welcome to ACCS, ${session.user.name}` : steps[step]} isOpen onOpenChange={(next) => !next && close()}>
      <ModalBody>
        <div className="ob">
          <ol className="ob-steps" aria-label={`Step ${step + 1} of ${steps.length}`}>
            {steps.map((label, index) => (
              <li key={label} data-on={index <= step || undefined} aria-current={index === step ? 'step' : undefined}>
                <span className="ob-sr">{label}</span>
              </li>
            ))}
          </ol>

          {step === 0 && (
            <div className="ob-welcome">
              <p className="ob-role">
                {roles}
                {scope ? ` · ${scope}` : ''}
              </p>
              <p>Your account is ready. ACCS is the CCS office online: announcements and class spaces, appointments with faculty, concerns and how they move, and evaluations, in one place.</p>
              <p>This short tour shows what you can do as {roles} and where to find it. It takes under a minute.</p>
            </div>
          )}

          {step === 1 && (
            <>
              <p className="ob-lead">As {roles}, you can:</p>
              <ul className="ob-list" role="list">
                {list.map(({ id, label, about, icon, href }) => (
                  <li key={id}>
                    <span className="ob-icon" aria-hidden>
                      <Icon name={icon as never} size={20} />
                    </span>
                    <span className="ob-item">
                      {href ? (
                        <NavLink href={href} className="ob-item__title" onNavigate={close}>
                          {label}
                        </NavLink>
                      ) : (
                        <span className="ob-item__title">{label}</span>
                      )}
                      {about && <span className="ob-item__about">{about}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {step === 2 && (
            <ul className="ob-list" role="list">
              {places.map(({ icon, title, text }) => (
                <li key={title}>
                  <span className="ob-icon" aria-hidden>
                    {icon === 'assistant' ? <Icon icon={assistantIcon} size={20} weight="fill" /> : <Icon name={icon} size={20} />}
                  </span>
                  <span className="ob-item">
                    <span className="ob-item__title">{title}</span>
                    <span className="ob-item__about">{text}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </ModalBody>
      <ModalActions>
        {step === 0 ? (
          <Button variant="secondary" onPress={close}>
            Skip
          </Button>
        ) : (
          <Button variant="secondary" onPress={() => setStep(step - 1)}>
            Back
          </Button>
        )}
        <Button onPress={() => (last ? close() : setStep(step + 1))}>{last ? 'Get started' : 'Next'}</Button>
      </ModalActions>
    </Modal>
  )
}
