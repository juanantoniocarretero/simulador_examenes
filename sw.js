// sw.js - Service Worker básico
self.addEventListener('fetch', (event) => {
  // Este código permite que la app funcione incluso con red inestable
  event.respondWith(fetch(event.request));
});