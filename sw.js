const CACHE_NAME = 'simu-cert-v2'; // Subimos versión por el cambio de rutas
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/main.js',
  './js/storage.js',
  './js/uiManager.js',
  './manifest.json',
  './img/icon.svg',
  './img/icon-512.png',
  './img/screenshot-desktop.png',
  './img/screenshot-mobile.png'
];

// Instalación: Guardar todo en caché
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Cacheando archivos de la PWA...');
      return cache.addAll(ASSETS);
    })
  );
});

// Estrategia: Network First (Intenta red, si no hay, usa caché)
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});