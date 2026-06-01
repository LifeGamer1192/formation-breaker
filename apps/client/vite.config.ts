import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@fb/sim-core': fileURLToPath(new URL('../../packages/sim-core/src/index.ts', import.meta.url)),
    },
  },
})
