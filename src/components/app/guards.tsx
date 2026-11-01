import { Button, Icon, ViewState } from '@meetingat10/design-system/react'
import { useQuery, type QueryClient } from '@tanstack/react-query'
import { useRouterState } from '@tanstack/react-router'
import type { ReactNode } from 'react'

import { routePermission } from '@/lib/page-catalog'
import { sessionQuery } from '@/lib/queries'
import { canOpenSite, currentSite, landingFor, roleLabel, siteById, siteForPath, siteHref } from '@/lib/sites'

import './sites.css'

/** "No access" screen: a title, one explanation, one way back. */
function DeniedView({ title, children, page }: { title: string; children: ReactNode; page?: boolean }) {
  const session = useQuery(sessionQuery()).data
  return (
    <section className={page ? 'shell-denied shell-denied--page' : 'shell-denied'} aria-labelledby="denied-title">
      <span className="shell-denied__icon" aria-hidden>
        <Icon name="lock" size={24} />
      </span>
      <h1 className="shell-denied__title" id="denied-title">
        {title}
      </h1>
      <p className="shell-denied__text">{children}</p>
      <Button variant="primary" href={session ? siteHref(landingFor(session)) : '/sign-in'}>
        Back to Home
      </Button>
    </section>
  )
}

/** 403 for a page or site the role may not open. `page` fills the screen (used instead of the app shell). */
export function AccessDenied({ page = false }: { page?: boolean }) {
  const session = useQuery(sessionQuery()).data
  const path = useRouterState({ select: (state) => state.location.pathname })
  const blocked = session && [siteForPath(path), currentSite()].find((id) => id && !canOpenSite(session, id))
  const role = session?.user.roles.map(roleLabel).join(' / ') ?? 'account'
  return (
    <DeniedView page={page} title="You don't have access to this page">
      Your role ({role}) can't open {blocked ? `the ${siteById[blocked].label} site` : 'this page'}. If you need access, ask the CCS
      administrator.
    </DeniedView>
  )
}

/** Record-level 404/403 inside a page the role may open: the item is missing or outside the person's scope. */
export function RestrictedView({ record = false }: { record?: boolean }) {
  return (
    <DeniedView title={record ? "This record isn't available to you" : "This page isn't available to you"}>
      This record may not exist, or it may be outside your role and scope. Having the link does not give you access.
    </DeniedView>
  )
}

const recordPages = ['P06', 'P08', 'P10', 'P12', 'P16', 'P20', 'P22', 'P24', 'P27', 'P29', 'P31', 'P32', 'P34', 'P38', 'P47', 'P50']

export function RequirePermission({ pageId, children }: { pageId: string; children: ReactNode }) {
  const session = useQuery(sessionQuery())
  if (session.isPending) {
    return <ViewState kind="loading" title="Checking your access" />
  }
  const permission = routePermission[pageId]
  const requiredPermissions = permission
    ? Array.isArray(permission)
      ? permission
      : [permission]
    : []
  const hasPermission = requiredPermissions.some((key) =>
    session.data?.permissions.includes(key),
  )
  if (session.error || !session.data?.allowedPages.includes(pageId) || !hasPermission) {
    return recordPages.includes(pageId) ? <RestrictedView record /> : <AccessDenied />
  }
  return children
}

export async function RoutePermission(queryClient: QueryClient, pageId: string) {
  try {
    const session = await queryClient.ensureQueryData(sessionQuery())
    const permission = routePermission[pageId]
    const requiredPermissions = permission
      ? Array.isArray(permission)
        ? permission
        : [permission]
      : []
    const hasPermission = requiredPermissions.some((key) =>
      session.permissions.includes(key),
    )
    return { permission: session.allowedPages.includes(pageId) && hasPermission }
  } catch {
    return { permission: false }
  }
}

export function RetryView({ onRetry }: { onRetry: () => void }) {
  return (
    <ViewState
      kind="error"
      title="Couldn't load this page"
      description="Try again. We check your access each time the page loads."
      actions={<Button variant="secondary" onPress={onRetry}>Try again</Button>}
    />
  )
}
