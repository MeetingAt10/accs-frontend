/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  /** JSON map of site id to origin, e.g. {"portal":"https://...","forums":"https://..."}. */
  /** "true" in the development stack's build, which adds the dev toolbox. `vite` (dev server) always adds it. */
  readonly VITE_DEV_TOOLBOX?: string
}
