import { faro, getWebInstrumentations, initializeFaro } from '@grafana/faro-web-sdk'
import { TracingInstrumentation } from '@grafana/faro-web-tracing'

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
export function initObservability() {
  const url = import.meta.env.VITE_FARO_URL
  if (!url) return
  initializeFaro({
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
  })
}

/** Sends an error to Faro; does nothing when Faro is not initialised. */
export function reportError(error: unknown) {
  faro.api?.pushError(error instanceof Error ? error : new Error(String(error)))
}
