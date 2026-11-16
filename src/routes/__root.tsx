import type { QueryClient } from '@tanstack/react-query'
import { CatchBoundary, createRootRouteWithContext, Outlet, useRouter } from '@tanstack/react-router'
import { DesignSystemProvider, ToastRegion } from '@meetingat10/design-system/react'
import { lazy, Suspense, useEffect } from 'react'


// Development stack only (docs/deltas/2026-11-05-consultation-50-percent.md, slice E). Both conditions are fixed when the app is
// built, so any other build drops this import together with the toolbox chunk, its stylesheet, and its logo.
const DevToolbox =
  import.meta.env.DEV || import.meta.env.VITE_DEV_TOOLBOX === 'true'
    ? lazy(() => import('@/components/dev-toolbox/dev-toolbox'))
    : null

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: Root,
})

// Design system context: Motion defaults, client-side routing for its links (through the router's history), locale.
function Root() {
  const router = useRouter()
  // Toasts pause while the toast area has focus. Closing one with the mouse left focus on the next toast, so its timer
  // never ran out; let it go after a pointer close. A keyboard close keeps focus there for screen reader users.
  useEffect(() => {
    const release = (event: MouseEvent) => {
      if (event.detail === 0 || !(event.target instanceof Element) || !event.target.closest('.ds-toast__close, .ds-toast__action')) return
      requestAnimationFrame(() => {
        const active = document.activeElement
        if (active instanceof HTMLElement && active.closest('.ds-toast-region')) active.blur()
      })
    }
    document.addEventListener('click', release, true)
    return () => document.removeEventListener('click', release, true)
  }, [])
  return (
    <DesignSystemProvider
      navigate={(href) => router.history.push(href)}
      useHref={(href) => router.history.createHref(href)}
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
