import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'favicon.png', 'favicon-32x32.png', 'apple-touch-icon.png'],
      manifest: {
        name: '麻將勝率計算器',
        short_name: '麻將勝率',
        description: '記錄每局麻將結果，統計自摸率、放槍率、爆擊率與金額',
        lang: 'zh-TW',
        display: 'standalone',
        theme_color: '#166534',
        background_color: '#166534',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  base: '/Mahjong_Win_Rate-_Calculator/',
})
