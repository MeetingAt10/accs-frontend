import { createFileRoute, Outlet, redirect, useRouterState } from '@tanstack/react-router'

import { AccessDenied } from '@/components/app/guards'
import { AppChrome } from '@/components/app/navigation'
import { sessionQuery } from '@/lib/queries'
import { titleForPath } from '@/lib/page-catalog'
import { canOpenPath, siteById, siteForPath } from '@/lib/sites'
import { useEffect } from 'react'

export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ context, location }) => {
    try {
      const session = await context.queryClient.ensureQueryData(sessionQuery())
      return { session }
    } catch {
      throw redirect({ href: '/sign-in?redirect=' + encodeURIComponent(location.href) })
    }
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
