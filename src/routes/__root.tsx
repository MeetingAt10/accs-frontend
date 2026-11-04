import type { QueryClient } from '@tanstack/react-query'
import { CatchBoundary, createRootRouteWithContext, Outlet, useRouter } from '@tanstack/react-router'
import { DesignSystemProvider, ToastRegion } from '@meetingat10/design-system/react'
import { lazy, Suspense } from 'react'

import { siteHref } from '@/lib/sites'

// Development stack only (docs/deltas/2026-11-05-consultation-50-percent.md, slice E). Both conditions are fixed when the app is
// built, so any other build drops this import together with the toolbox chunk, its stylesheet, and its logo.
const DevToolbox =
  import.meta.env.DEV || import.meta.env.VITE_DEV_TOOLBOX === 'true'
    ? lazy(() => import('@/components/dev-toolbox/dev-toolbox'))
    : null

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
      {DevToolbox && (
        // A failing dev tool must never take the app down with it.
        <CatchBoundary getResetKey={() => 0} errorComponent={() => null}>
          <Suspense fallback={null}>
            <DevToolbox />
          </Suspense>
        </CatchBoundary>
      )}
    </DesignSystemProvider>
  )
}
