import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa'; // ضفنا المكتبة هنا

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  // أمان: نُدرج في الكود العميل ONLY ما هو آمن للعميل. لا تُمرَّر أسرار الخادم
  // (JWT_SECRET، بيانات قاعدة البيانات، مفاتيح VAPID، إعداد تسجيل الدخول…)
  // إلى bundle الواجهة إطلاقًا — حتى لو أشار أي كود/مكتبة خارجية إلى process.env.
  const clientSafeEnv: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (key === 'NODE_ENV' || key === 'MODE' || key.startsWith('VITE_')) {
      clientSafeEnv[key] = value;
    }
  }
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
      'process.env': JSON.stringify(clientSafeEnv),
      'process.platform': JSON.stringify('win32'),
      'process': { env: clientSafeEnv }, // إضافة هذا السطر لحل مشاكل المكتبات الخارجية
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