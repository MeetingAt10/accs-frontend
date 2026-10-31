/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  /** JSON map of site id to origin, e.g. {"portal":"https://...","forums":"https://..."}. */
  readonly VITE_SITE_ORIGINS?: string
}
