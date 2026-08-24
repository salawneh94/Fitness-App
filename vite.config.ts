import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages serves this as a project site under /Fitness-App/, so the build
// needs that as its base — but the dev server should stay at the domain root.
const base = process.env.GITHUB_PAGES ? '/Fitness-App/' : '/';

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // Disabled for now: real-device debugging kept getting confused by stale/partially-evicted
      // service worker caches from earlier deployments (this app shipped many times in a short
      // window). selfDestroying ships a SW whose only job is to unregister itself and wipe all
      // caches for anyone who still has an old one installed, cleanly migrating everyone off it.
      selfDestroying: true,
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'FitTrack — Fitness & Nutrition Tracker',
        short_name: 'FitTrack',
        description: 'Track workouts, nutrition, and progress — all stored on your device.',
        theme_color: '#f97316',
        background_color: '#0b0d14',
        display: 'standalone',
        start_url: base,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        clientsClaim: true,
        skipWaiting: true,
        navigateFallback: `${base}index.html`,
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // Barcode lookups need the network; never let the SW answer them from a stale cache.
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/world\.openfoodfacts\.org\/.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'openfoodfacts-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
        ],
      },
    }),
  ],
})
