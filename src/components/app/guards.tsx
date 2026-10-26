import { Button, PrivacyNotice, ViewState } from '@meetingat10/design-system/react'
import { useQuery, type QueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { ApiError } from '@/lib/api'
import { routePermission } from '@/lib/page-catalog'
import { sessionQuery } from '@/lib/queries'

export function RestrictedView({ record = false }: { record?: boolean }) {
  return (
    <div className="app-page app-restricted-view">
      <ViewState
        kind="restricted"
        title={record ? "This record isn't available to you" : "This page isn't available to you"}
        description="The item may not exist, or your current role and scope may not include it."
      />
      <PrivacyNotice title="Access follows your role and relationship">
        A link or notification does not grant access. Ask the responsible office if you think you need this item.
      </PrivacyNotice>
    </div>
  )
}

export function RequirePermission({ pageId, children }: { pageId: string; children: ReactNode }) {
  const session = useQuery(sessionQuery())
  if (session.isPending) {
    return <ViewState kind="loading" title="Checking access" />
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
    return <RestrictedView record={['P06', 'P08', 'P10', 'P12', 'P16', 'P20', 'P22', 'P24', 'P27', 'P29', 'P31', 'P32', 'P34', 'P38', 'P47', 'P50'].includes(pageId)} />
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
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return { permission: false }
    return { permission: false }
  }
}

export function RetryView({ onRetry }: { onRetry: () => void }) {
  return (
    <ViewState
      kind="error"
      title="This information couldn't be loaded"
      description="Try again. Your access is checked again when the page reloads."
      actions={<Button variant="secondary" onPress={onRetry}>Try again</Button>}
    />
  )
}
