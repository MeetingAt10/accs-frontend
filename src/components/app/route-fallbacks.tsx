import { Button, Icon, Row, type IconName } from '@meetingat10/design-system/react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import type { ReactNode } from 'react'

import { sessionQuery } from '@/lib/queries'
import { landingFor } from '@/lib/sites'

import './sites.css'

/** Full-page state: an icon, a title, one explanation, and a way forward. Same shell as the access screens. */
function FallbackScreen({
  id,
  icon,
  title,
  children,
  actions,
}: {
  id: string
  icon: IconName
  title: string
  children: ReactNode
  actions: ReactNode
}) {
  return (
    <section className="shell-denied shell-denied--page" aria-labelledby={id}>
      <span className="shell-denied__icon" aria-hidden>
        <Icon name={icon} size={24} />
      </span>
      <h1 className="shell-denied__title" id={id}>
        {title}
      </h1>
      <p className="shell-denied__text">{children}</p>
      {actions}
    </section>
  )
}

/** Router-wide `defaultNotFoundComponent`: no route matches the URL. */
export function RouteNotFound() {
  const session = useQuery(sessionQuery()).data
  return (
    <FallbackScreen
      id="not-found-title"
      icon="question"
      title="Page not found"
      actions={
        <Button variant="primary" href={session ? landingFor(session) : '/sign-in'}>
          Back to Home
        </Button>
      }
    >
      The page you&apos;re looking for doesn&apos;t exist. It may have moved, or the link may be out of date.
    </FallbackScreen>
  )
}

/**
 * Router-wide `defaultErrorComponent`: a route threw while loading or rendering. A more specific
 * route may define its own `errorComponent` (for example the session check); this is the fallback
 * for everything else, so it never shows the error's technical detail to the person using the app.
 */
export function RouteError() {
  const router = useRouter()
  const session = useQuery(sessionQuery()).data
  return (
    <FallbackScreen
      id="route-error-title"
      icon="warning-circle"
      title="Something went wrong"
      actions={
        <Row gap={12}>
          <Button variant="secondary" onPress={() => void router.invalidate()}>
            Try again
          </Button>
          <Button variant="primary" href={session ? landingFor(session) : '/sign-in'}>
            Back to Home
          </Button>
        </Row>
      }
    >
      This page ran into a problem. Try again, or go back to a page that works.
    </FallbackScreen>
  )
}
