import type { AnyRouter } from '@tanstack/react-router'

/**
 * Matches only the API's own origin. Trace headers must never reach other origins: S3 upload URLs (src/lib/api.ts)
 * allow only content-type and content-length in the bucket's CORS rules, so a catch-all would break uploads.
 * A relative VITE_API_URL (the default `/api`) is same-origin and needs nothing.
 */
export function apiOriginPattern(apiUrl: string | undefined): RegExp[] {
  try {
    const { origin } = new URL(apiUrl ?? '')
    return [new RegExp(`^${origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(/|$)`)]
  } catch {
    return []
  }
}

/** Starts Grafana Faro (Frontend Observability). Does nothing unless VITE_FARO_URL is set. Sets no user identity. */
let faroApi: { pushError(error: Error): void } | undefined

export async function initObservability() {
  const url = import.meta.env.VITE_FARO_URL
  if (!url) return
  // Loaded only when configured, so a build without VITE_FARO_URL never downloads the SDK.
  const [{ getWebInstrumentations, initializeFaro }, { TracingInstrumentation }] = await Promise.all([
    import('@grafana/faro-web-sdk'),
    import('@grafana/faro-web-tracing'),
  ])
  faroApi = initializeFaro({
    url,
    app: {
      name: 'accs-frontend',
      version: import.meta.env.VITE_APP_VERSION ?? 'local',
      environment: import.meta.env.VITE_FARO_ENV ?? import.meta.env.MODE,
    },
    instrumentations: [
      ...getWebInstrumentations(),
      new TracingInstrumentation({
        instrumentationOptions: { propagateTraceHeaderCorsUrls: apiOriginPattern(import.meta.env.VITE_API_URL) },
      }),
    ],
  }).api
}

/** Sends an error to Faro; does nothing when Faro is not initialised. */
export function reportError(error: unknown) {
  faroApi?.pushError(error instanceof Error ? error : new Error(String(error)))
}

/** Route template to the page_location GA sees: origin plus template (`/cases/$caseId`), never the real URL, query or hash. */
export function gaPageLocation(origin: string, template: string) {
  return origin + template
}

/** Referrer reduced to its origin; empty when missing or unparseable. */
export function gaReferrer(referrer: string) {
  try {
    return new URL(referrer).origin
  } catch {
    return ''
  }
}

/**
 * Loads Google Analytics (gtag.js) and sends one page_view per resolved navigation. Does nothing unless VITE_GA_ID is set.
 * Only the matched route's template is ever sent: real paths, query strings and document.title can carry ids and names.
 */
export function initAnalytics(router: Pick<AnyRouter, 'subscribe' | 'state'>) {
  const id = import.meta.env.VITE_GA_ID
  if (!id) return
  const w = window as unknown as { dataLayer: unknown[]; gtag: (...args: unknown[]) => void }
  w.dataLayer = w.dataLayer || []
  // Must push the `arguments` object, not an array: gtag.js ignores arrays.
  w.gtag = function () {
    // eslint-disable-next-line prefer-rest-params
    w.dataLayer.push(arguments)
  }
  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`
  document.head.appendChild(script)

  const sanitized = () => {
    const template = router.state.matches.at(-1)?.fullPath ?? '/'
    return {
      page_location: gaPageLocation(location.origin, template),
      page_title: template,
      page_referrer: gaReferrer(document.referrer),
    }
  }
  w.gtag('js', new Date())
  w.gtag('set', sanitized())
  w.gtag('config', id, { send_page_view: false })
  let last = ''
  router.subscribe('onResolved', () => {
    // Router can resolve twice for one location (initial load, redirects); count each location once.
    const href = router.state.location.href
    if (href === last) return
    last = href
    w.gtag('set', sanitized())
    w.gtag('event', 'page_view')
  })
}
