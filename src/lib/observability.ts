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
