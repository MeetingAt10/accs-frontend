import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Outlet, useRouter } from '@tanstack/react-router'
import { DesignSystemProvider, ToastRegion } from '@meetingat10/design-system/react'

import { siteHref } from '@/lib/sites'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  // A route owned by another module site loads on that site's host (docs/deltas/2026-11-01-subdomain-sites.md).
  beforeLoad: ({ location }) => {
    const target = siteHref(location.href)
    if (target !== location.href) {
      window.location.replace(target)
      return new Promise<never>(() => {})
    }
  },
  component: Root,
})

// Design system context: Motion defaults, client-side routing for its links (through the router's history), locale.
// Links to another module site become absolute and load as a full page.
function Root() {
  const router = useRouter()
  return (
    <DesignSystemProvider
      navigate={(href) => {
        const target = siteHref(href)
        if (target === href) router.history.push(href)
        else window.location.assign(target)
      }}
      useHref={(href) => {
        const target = siteHref(href)
        return target === href ? router.history.createHref(href) : target
      }}
      locale="en-PH"
    >
      <Outlet />
      <ToastRegion />
    </DesignSystemProvider>
  )
}
