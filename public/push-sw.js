/*
 * Sakani Web Push handler.
 *
 * Imported by the Workbox-generated service worker (see
 * vite.config.ts -> VitePWA.workbox.importScripts). Kept as a plain script so
 * it works with the generateSW strategy and the precache/offline behaviour
 * stays intact. It adds two listeners the generated SW does not provide:
 *   - "push"             -> show a rich, RTL, vibrating notification
 *   - "notificationclick"-> focus an existing tab (or open one) on the target URL
 */
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'سكني', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'سكني';
  const options = {
    body: data.body || '',
    icon: data.icon || '/img/pwa-192x192.png',
    badge: data.badge || '/img/pwa-192x192.png',
    tag: data.tag || 'sakani',
    renotify: data.renotify || false,
    vibrate: data.vibrate || [200, 100, 200],
    dir: 'rtl',
    lang: 'ar',
    data: data.data || { url: '/' },
  };

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, options);
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of allClients) {
        if ('focus' in client) {
          await client.focus();
          if ('navigate' in client) {
            try { await client.navigate(target); } catch (e) { /* cross-origin guard */ }
          }
          return;
        }
      }
      if (self.clients.openWindow) await self.clients.openWindow(target);
    })()
  );
});
