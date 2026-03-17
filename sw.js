const CACHE_NAME = 'simulador-certs-v1';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/main.js',
  './js/storage.js',
  './js/uiManager.js',
  './manifest.json'
];

// Instalación: Guarda los archivos en la memoria del móvil
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// Estrategia: Intentar red, si falla, usar lo guardado en caché
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});