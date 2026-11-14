/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  /** JSON map of site id to origin, e.g. {"portal":"https://...","forums":"https://..."}. */
  /** "true" in the development stack's build, which adds the dev toolbox. `vite` (dev server) always adds it. */
  readonly VITE_DEV_TOOLBOX?: string
  /** Grafana Faro collector URL. Public by design. Unset: no telemetry. */
  readonly VITE_FARO_URL?: string
  /** Environment label in Grafana (`prod` or `dev`). Defaults to the Vite mode. */
  readonly VITE_FARO_ENV?: string
  /** Release shown in Grafana; the deploy workflow sets the commit SHA. Defaults to `local`. */
  readonly VITE_APP_VERSION?: string
}
