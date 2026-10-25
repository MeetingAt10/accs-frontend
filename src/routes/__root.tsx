import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Outlet, useRouter } from '@tanstack/react-router'
import { DesignSystemProvider, ToastRegion } from '@meetingat10/design-system/react'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: Root,
})

// Design system context: Motion defaults, client-side routing for its links (through the router's history), locale.
function Root() {
  const router = useRouter()
  return (
    <DesignSystemProvider
      navigate={(href) => router.history.push(href)}
      useHref={(href) => router.history.createHref(href)}
      locale="en-PH"
    >
      <Outlet />
      <ToastRegion />
    </DesignSystemProvider>
  )
}
