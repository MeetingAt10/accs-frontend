import { Button, Icon, Row, type IconName } from '@meetingat10/design-system/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { type ErrorComponentProps, useRouter, useRouterState } from '@tanstack/react-router'
import { type ReactNode, useEffect } from 'react'

import { reportError } from '@/lib/observability'
import { sessionQuery } from '@/lib/queries'
import { landingFor } from '@/lib/sites'
import { titleForPath } from '@/lib/page-catalog'
import { AppChrome } from './navigation'
import { PageLoading, PageSkeleton } from './skeleton-page'

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
export function RouteError({ error }: ErrorComponentProps) {
  const router = useRouter()
  useEffect(() => reportError(error), [error])
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

/** Router-wide `defaultPendingComponent` (and the session check's): grey placeholders instead of a blank screen while a redirect or load settles. */
export function RoutePending({ shell }: { shell?: boolean }) {
  const path = useRouterState({ select: (state) => state.location.pathname })
  const session = useQueryClient().getQueryData(sessionQuery().queryKey)
  // Sign-in and first-login are not app pages: show only the themed page background, no app-shaped skeleton.
  if (path === '/sign-in' || path === '/first-login') return null
  // With the session cached the real shell (sidebar, top bar) shows and only the page content is a placeholder; a route
  // inside the shell (no `shell`) is already under it, so it draws the content alone.
  if (session) {
    const title = titleForPath(path)
    const content = <PageLoading title={title} />
    return shell ? <AppChrome session={session} title={title}>{content}</AppChrome> : content
  }
  return (
    <div className="pg-skel-page">
      <PageSkeleton pageId={path.startsWith('/feed') ? 'P04' : 'P03'} />
    </div>
  )
}

/** The `/_app` route's pending view. */
export const AppPending = () => <RoutePending shell />
