const CACHE_NAME = 'vloitz-app-v4';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './sets.json',
  './favicon/favicon.ico',
  'https://unpkg.com/wavesurfer.js@7.7.5/dist/wavesurfer.min.js',
  'https://unpkg.com/wavesurfer.js@7.7.5/dist/plugins/regions.min.js'
];

// 1. INSTALACIÓN: Guardamos la interfaz en el caché
self.addEventListener('install', (e) => {
  console.log('[Service Worker] Instalando caché de interfaz...');
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// 2. ACTIVACIÓN: Limpiamos versiones viejas si actualizas la web
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) return caches.delete(key);
      }));
    })
  );
});

// 3. INTERCEPTACIÓN: Si piden algo, miramos el caché primero
self.addEventListener('fetch', (e) => {
  // EXCEPCIÓN: No cachear los archivos de audio gigantes (FLAC) automáticamente
  // Dejamos que el navegador maneje el streaming para no llenar la memoria del usuario
  if (e.request.url.includes('.flac') || e.request.url.includes('media.githubusercontent.com')) {
      return;
  }

  e.respondWith(
    caches.match(e.request).then((response) => {
      // Si está en caché, lo devolvemos (Carga Instantánea)
      // Si no, lo pedimos a internet
      return response || fetch(e.request);
    })
  );
});
