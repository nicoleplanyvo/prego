/* prego. Service Worker – Web Push für "Abholbereit" */
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload = { title: 'prego.', body: 'Deine Bestellung ist fertig!', url: '/' };
  try {
    payload = { ...payload, ...event.data.json() };
  } catch (_) {
    /* Textfallback */
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      data: { url: payload.url },
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url ? event.notification.data.url : '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const win of windows) {
        if (win.url === url && 'focus' in win) return win.focus();
      }
      return clients.openWindow(url);
    })
  );
});
