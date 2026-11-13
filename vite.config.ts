import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { localRoleLauncher } from './vite.local-role-launcher'

export default defineConfig(({ command }) => {
  const roleLauncherEnabled = command === 'serve' && process.env.ACCS_ROLE_LAUNCHER === '1'
  const configuredApiTarget = command === 'serve' ? process.env.ACCS_DEV_API_TARGET : undefined
  const apiTarget = configuredApiTarget ?? 'http://localhost:3000'

  if (configuredApiTarget || roleLauncherEnabled) {
    try {
      if (!['http:', 'https:'].includes(new URL(apiTarget).protocol)) throw new Error()
    } catch {
      throw new Error('ACCS_DEV_API_TARGET must be an http:// or https:// URL.')
    }
  }

  return {
    // router plugin must come before the react plugin
    plugins: [
      TanStackRouterVite({ target: 'react', autoCodeSplitting: true }),
      react(),
      ...(roleLauncherEnabled ? [localRoleLauncher()] : []),
    ],
    resolve: { alias: { '@': '/src' } },
    build: {
      rollupOptions: {
        output: {
          // Libraries go in their own chunks, so the app's entry stays small and each library is cached on its own
          // between releases (MeetingAt10/accs-frontend#8). Routes are already split by the router plugin.
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined
            if (/node_modules[\/](react|react-dom|scheduler)[\/]/.test(id)) return 'react'
            if (id.includes('@tanstack')) return 'tanstack'
            // React Aria is too big for one chunk: its components, hooks, state and date libraries load separately.
            if (id.includes('react-aria-components')) return 'react-aria-components'
            if (/@react-aria|node_modules[\/]react-aria[\/]/.test(id)) return 'react-aria'
            if (/@react-stately|react-stately|@react-types/.test(id)) return 'react-stately'
            if (id.includes('@internationalized')) return 'internationalized'
            if (/node_modules[\/](motion|framer-motion|motion-dom|motion-utils)[\/]/.test(id)) return 'motion'
            if (id.includes('@meetingat10/design-system')) return 'design-system'
            if (id.includes('@phosphor-icons')) return 'icons'
            return 'vendor'
          },
        },
      },
    },
    server: {
      port: 5173,
      ...(roleLauncherEnabled ? { host: '127.0.0.1', strictPort: true } : {}),
      proxy: {
        '/api': configuredApiTarget || roleLauncherEnabled
          ? { target: apiTarget, changeOrigin: true }
          : 'http://localhost:3000',
      },
    },
  }
})
