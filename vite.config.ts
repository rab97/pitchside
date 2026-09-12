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
        // The admin panel is reachable only by an authenticated manager —
        // every customer visiting `/prenota` never runs this code, and
        // `App.tsx` already lazy-loads it for exactly that reason. Without
        // this list, `generateSW`'s default globs precache every built
        // chunk regardless of route, so a customer's service worker would
        // still fetch the whole panel on first visit and the lazy-loading
        // would buy nothing. These patterns name the panel's own lazy
        // chunks (`App.tsx`'s five `lazy()` routes, the `SettingsPage`
        // shell and `useAdminFields` hook they share, `DateField`/
        // `TimeField`, used only from admin dialogs — `DateJump`, the
        // customer-facing date picker, imports `MonthGridPopover` directly
        // and never these two — and `vendor-radix-select`, the one vendor
        // chunk below that only the panel pulls in. dnd-kit is deliberately
        // NOT split into its own vendor chunk (see the comment on
        // `manualChunks`): left inlined, its ~55 KB stays inside
        // `FieldsPage-*.js`, already covered by that pattern above.
        // `@radix-ui/react-popover` is also deliberately absent from this
        // list: `DateField` and the customer's `DateJump` both open it, so
        // every visitor needs it regardless of whether they ever see
        // `/admin`.
        globIgnores: [
          '**/AdminPage-*.js',
          '**/FacilityPage-*.js',
          '**/FieldsPage-*.js',
          '**/PriceBandsPage-*.js',
          '**/ClosuresPage-*.js',
          '**/SettingsPage-*.js',
          '**/useAdminFields-*.js',
          '**/DateField-*.js',
          '**/TimeField-*.js',
          '**/vendor-radix-select-*.js',
        ],
      },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    rollupOptions: {
      output: {
        // Left to its own defaults, the bundler inlines a dependency into
        // whichever chunk first reaches it rather than always factoring it
        // into one shared file — verified by building without this and
        // watching `date-fns` and `@radix-ui/react-select` show up,
        // full-sized, inside more than one admin chunk at once. Naming
        // them explicitly stops that duplication and, as a side effect,
        // gives the `globIgnores` patterns above stable, predictable
        // filenames to match instead of a per-build content hash prefix.
        //
        // `@dnd-kit` is deliberately NOT named here, even though it is the
        // single biggest new dependency (~55 KB): giving it its own vendor
        // chunk made the entry chunk statically `import` two of its
        // exports at the top level — confirmed with `build.sourcemap` and
        // a source-map lookup, traced to `@dnd-kit/sortable`— which means
        // every visitor, including a customer who only ever opens
        // `/prenota`, would fetch and execute the whole chunk, the exact
        // opposite of what `App.tsx`'s lazy-loading of `FieldsPage` is for.
        // `@dnd-kit` has exactly one consumer (`SortableList`, used only by
        // `FieldsPage`), so it never had the multi-chunk duplication
        // problem the other four have — leaving it to the bundler's
        // default keeps its ~55 KB inlined inside `FieldsPage-*.js` alone,
        // with nothing imported from it anywhere else.
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('@radix-ui/react-select')) return 'vendor-radix-select'
          if (id.includes('@radix-ui/react-popover')) return 'vendor-radix-popover'
          if (id.includes('date-fns-tz')) return 'vendor-date-fns-tz'
          if (id.includes('/date-fns/')) return 'vendor-date-fns'
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // One worker per core is a loss here, not a gain. Every worker builds its
    // own jsdom — vitest says so after each run, "jsdom was created 50 times,
    // 33% of tracked time" — so past a point the workers compete for the cores
    // they are waiting on. Measured on a 16-core machine, whole suite, idle:
    //
    //   4 workers   211 passed   34.6s
    //   8 workers   211 passed   29.3s
    //   16 (default) 1 failed    32.7s
    //
    // The failure at 16 was deterministic, 5 runs out of 5: the first test in
    // `NewClosureDialog.test.tsx` drives four real Radix popovers and pays that
    // file's cold import, and under full contention it crossed its 10s timeout.
    // Raising that timeout a second time would have bought a slower suite and
    // hidden the reason. Capping the pool is both faster and green.
    maxWorkers: 8,
    coverage: {
      provider: 'v8',
      // `text-summary` so a local run says something useful in one screen;
      // `lcov` because that is the only format SonarQube reads for
      // JavaScript and TypeScript (`sonar.javascript.lcov.reportPaths`).
      reporter: ['text-summary', 'lcov'],
      reportsDirectory: './coverage',
      // Without `include`, v8 reports only files a test happened to import,
      // so a module nobody tests is absent rather than at 0% — and the
      // headline number then flatters us by ignoring exactly the code that
      // needs the attention.
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        // Generated from the database schema by `npm run types`; nothing to
        // test and its size would dominate the ratio.
        'src/shared/lib/database.types.ts',
        // The bootstrap and the test environment's own scaffolding.
        'src/main.tsx',
        'src/test/**',
        '**/*.d.ts',
      ],
    },
  },
})
