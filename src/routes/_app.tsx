import { createFileRoute, Outlet, redirect, useRouterState } from '@tanstack/react-router'

import { AccessDenied } from '@/components/app/guards'
import { AppChrome } from '@/components/app/navigation'
import { sessionQuery } from '@/lib/queries'
import { titleForPath } from '@/lib/page-catalog'
import { canOpenPath, siteById, siteForPath } from '@/lib/sites'
import { useEffect } from 'react'

export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ context, location }) => {
    const session = await context.queryClient.ensureQueryData(sessionQuery()).catch(() => undefined)
    const here = encodeURIComponent(location.href)
    if (!session) throw redirect({ href: '/sign-in?redirect=' + here })
    // Temporary sign-in details open nothing but the page that replaces them.
    if (session.user.mustChangeCredentials) throw redirect({ href: '/first-login?redirect=' + here })
    return { session }
  },
  component: AppLayout,
})

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
