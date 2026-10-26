import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  // router plugin must come before the react plugin
  plugins: [TanStackRouterVite({ target: 'react', autoCodeSplitting: true }), react()],
  resolve: { alias: { '@': '/src' } },
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:3000' },
  },
})
