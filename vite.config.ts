/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        lang: 'it',
        name: 'Palacalcetto · Prenota Campi',
        short_name: 'Palacalcetto',
        start_url: '/prenota',
        display: 'standalone',
        background_color: '#ECEFE9',
        theme_color: '#146B3F',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        // Il service worker precache solo gli asset dell'app (JS, CSS,
        // l'HTML della SPA). Supabase (REST, Auth, Realtime) vive su
        // un'origine diversa in ogni ambiente (porta 54321 in locale,
        // sottodominio *.supabase.co in produzione): la route di
        // precache di Workbox non intercetta richieste cross-origin, e
        // qui non è definito nessun runtimeCaching che le riguardi, per
        // non rischiare mai di servire una risposta di rete in cache al
        // posto della verità del database. navigateFallbackDenylist è
        // una seconda rete di sicurezza, nel caso un domani un reverse
        // proxy mettesse le API sotto lo stesso dominio dell'app.
        navigateFallbackDenylist: [/^\/rest\//, /^\/auth\//, /^\/realtime\//, /^\/storage\//],
      },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
})
