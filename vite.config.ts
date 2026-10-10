import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { VitePWA } from 'vite-plugin-pwa';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        // Prompt mode: the user sees a Persian "new version" banner and
        // chooses when to update (see src/pwa/PwaUpdatePrompt.tsx).
        registerType: 'prompt',
        includeAssets: ['favicon.svg'],
        manifest: {
          name: 'AquaLedger AI — دستیار هوشمند مالی تکنسین',
          short_name: 'AquaLedger',
          description:
            'دستیار هوشمند مالی، مشتریان و انبار تکنسین‌های تصفیه آب — آفلاین و فارسی',
          lang: 'fa',
          dir: 'rtl',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          theme_color: '#020617',
          background_color: '#020617',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          // App-shell offline: cache static assets; API/data stay in IndexedDB.
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          navigateFallback: 'index.html',
          // API calls must never fall back to index.html or any cache.
          navigateFallbackDenylist: [/^\/api\//],
          // Drop outdated precaches so users never stick to an old version.
          cleanupOutdatedCaches: true,
          // Prompt mode controls activation: the update banner calls
          // updateServiceWorker(true) instead of auto skipWaiting.
          skipWaiting: false,
          clientsClaim: false,
          // /api/* is always network-only (both read and write paths).
          runtimeCaching: [
            {
              urlPattern: /\/api\//,
              handler: 'NetworkOnly',
              method: 'GET',
            },
            {
              urlPattern: /\/api\//,
              handler: 'NetworkOnly',
              method: 'POST',
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
