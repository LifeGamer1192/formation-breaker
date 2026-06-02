import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  // α15: 静的アセット（テーマ画像・アイコン）はリポジトリ直下 assets/ に置く。
  // 中身は配信URL直下にマップされる（例 assets/themes/default/... → /themes/default/...）。
  publicDir: fileURLToPath(new URL('../../assets', import.meta.url)),
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: {
        name: 'Formation Breaker',
        short_name: 'FormBreaker',
        description: '陣形を崩す決定論ローグライク戦術ゲーム',
        lang: 'ja',
        theme_color: '#0a0a14',
        background_color: '#0a0a14',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        navigateFallback: '/index.html',
      },
    }),
  ],
  resolve: {
    alias: {
      '@fb/sim-core': fileURLToPath(new URL('../../packages/sim-core/src/index.ts', import.meta.url)),
    },
  },
})
