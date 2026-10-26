import { createFileRoute, Outlet, redirect, useRouterState } from '@tanstack/react-router'

import { AppChrome } from '@/components/app/navigation'
import { sessionQuery } from '@/lib/queries'
import { titleForPath } from '@/lib/page-catalog'

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
  return (
    <AppChrome session={session} title={titleForPath(path)}>
      <Outlet />
    </AppChrome>
  )
}
