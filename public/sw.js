/* Service worker Pass Navigay — notifications push (messages). */

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'Pass Navigay';
  const options = {
    body: data.body || '',
    icon: '/icon-192.png?v=2',
    badge: '/favicon-32.png?v=2',
    tag: data.tag || 'passnavigay',
    data: { url: data.url || '/messages' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/messages';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Réutilise un onglet ouvert si possible.
      for (const client of clientList) {
        if ('focus' in client) {
          client.postMessage({ type: 'navigate', url });
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
