const CACHE_NAME = 'mi-pwa-cache-v1'; // 1. Cambia el nombre de la versión
const urlsToCache = [
  './',
  './mobile.html',
  './images/icon-192.png'
];

// Instalación: guarda los nuevos archivos e ignora la espera
self.addEventListener('install', event => {
  self.skipWaiting(); // Fuerza al Service Worker entrante a ser el activo
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

// Activación: elimina versiones antiguas de la caché
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache); // Borra las cachés viejas (ej. v1, v2)
          }
        })
      );
    }).then(() => self.clients.claim()) // Toma control inmediato de las pestañas abiertas
  );
});

// Intercepción de peticiones
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});
