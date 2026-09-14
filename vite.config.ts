import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa'; // ضفنا المكتبة هنا

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(),
      tailwindcss(),
      // إعدادات الـ PWA
      VitePWA({
        registerType: 'autoUpdate',
        devOptions: {
          enabled: true,
        },
        workbox: {
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        },
        manifest: {
          name: 'سكني - نظام إدارة سكن الطلاب الذكي',
          short_name: 'Sakani',
          description: 'سكني - نظام إدارة سكن الطلاب الذكي',
          theme_color: '#ffffff',
          background_color: '#ffffff',
          display: 'standalone',
          orientation: 'portrait',
          icons: [
            {
              src: 'img/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'img/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: 'img/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable'
            }
          ]
        }
      })
    ],
    define: {
      'process.env': JSON.stringify(env),
      'process.platform': JSON.stringify('win32'),
      'process': { env: env }, // إضافة هذا السطر لحل مشاكل المكتبات الخارجية
      'global': 'window',
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      allowedHosts: true,
      proxy: {
        '/api': { // أي طلب يبدأ بـ /api
          target: 'http://localhost:3000', // سيتم توجيهه إلى خادم الـ Backend على المنفذ 3000
          changeOrigin: true,
        },
      },
    },
  };
});