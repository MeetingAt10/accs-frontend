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
