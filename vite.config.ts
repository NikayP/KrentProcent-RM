import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'prompt',
        includeAssets: [
          'favicon.ico',
          'favicon.svg',
          'apple-touch-icon-180x180.png',
        ],
        manifest: {
          id: '/',
          name: 'KrentProcent RM',
          short_name: 'KrentProcent',
          description:
            'Smart bar alcohol value calculator and menu comparator. Compare volume, price, and ABV to find the best bang for your buck.',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          orientation: 'portrait',
          theme_color: '#F21B2D',
          background_color: '#FFF2F3',
          lang: 'en',
          categories: ['food', 'utilities', 'lifestyle'],
          icons: [
            {
              src: 'pwa-64x64.png',
              sizes: '64x64',
              type: 'image/png',
            },
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
              src: 'maskable-icon-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
          shortcuts: [
            {
              name: 'Scan Menu',
              short_name: 'Scan',
              description: 'Scan a bar menu with camera or text',
              url: '/?tab=scanner',
              icons: [
                {
                  src: 'pwa-192x192.png',
                  sizes: '192x192',
                  type: 'image/png',
                },
              ],
            },
            {
              name: 'Compare Bars',
              short_name: 'Bars',
              description: 'Compare drink value across bars',
              url: '/?tab=bars',
              icons: [
                {
                  src: 'pwa-192x192.png',
                  sizes: '192x192',
                  type: 'image/png',
                },
              ],
            },
          ],
        },
        workbox: {
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//],
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          runtimeCaching: [
            {
              urlPattern: /^\/api\/(scan-menu|login)/,
              handler: 'NetworkOnly',
            },
            {
              urlPattern: ({ url }) => url.hostname.endsWith('supabase.co'),
              handler: 'NetworkOnly',
            },
            {
              urlPattern: /^\/api\/config/,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-config-cache',
                networkTimeoutSeconds: 3,
                expiration: {
                  maxEntries: 4,
                  maxAgeSeconds: 60 * 60 * 24,
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
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
