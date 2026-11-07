import { createFileRoute, Outlet, redirect, useRouter, useRouterState } from '@tanstack/react-router'

import { AccessDenied, RetryView } from '@/components/app/guards'
import { AppChrome } from '@/components/app/navigation'
import { sessionCheckSignedOut, sessionQuery } from '@/lib/queries'
import { titleForPath } from '@/lib/page-catalog'
import { canOpenPath, siteById, siteForPath } from '@/lib/sites'
import { useEffect } from 'react'

export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ context, location }) => {
    const here = encodeURIComponent(location.href)
    const session = await context.queryClient.ensureQueryData(sessionQuery()).catch((error) => {
      // Only a 401 means the user is actually signed out. A network error or a 5xx
      // doesn't - let the route's error state offer a retry instead of signing them out.
      if (sessionCheckSignedOut(error)) throw redirect({ href: '/sign-in?redirect=' + here })
      throw error
    })
    // Temporary sign-in details open nothing but the page that replaces them.
    if (session.user.mustChangeCredentials) throw redirect({ href: '/first-login?redirect=' + here })
    return { session }
  },
  errorComponent: SessionErrorView,
  component: AppLayout,
})

// A network error or 5xx from the session check. Retry re-runs beforeLoad, which re-runs
// the session query since React Query has no cached data to serve after a failed fetch.
function SessionErrorView() {
  const router = useRouter()
  return <RetryView onRetry={() => void router.invalidate()} />
}

function AppLayout() {
  const { session } = Route.useRouteContext()
  const path = useRouterState({ select: (state) => state.location.pathname })
  const title = titleForPath(path)
  // Generic page names only, never record or case titles (grievance mode).
  useEffect(() => {
    const site = siteById[siteForPath(path)].label
    document.title = title === site ? `${title} · ACCS` : `${title} · ACCS ${site}`
  }, [title, path])
  // A path or host the role may not open renders the 403 screen, never the shell or the page.
  if (!canOpenPath(session, path)) return <AccessDenied page />
  return (
    <AppChrome session={session} title={title}>
      <Outlet />
    </AppChrome>
  )
}
