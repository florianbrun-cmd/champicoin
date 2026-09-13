// service-worker.js
// Permet à Champicoin de fonctionner sans réseau :
// - l'app elle-même (HTML/CSS/JS) est mise en cache dès la première visite
// - les tuiles de carte OSM sont mises en cache au fur et à mesure qu'on les consulte
//   (donc les zones déjà visitées restent visibles hors-ligne)

const CACHE_APP = 'champicoin-app-v12';
const CACHE_TUILES = 'champicoin-tuiles-v1';

const FICHIERS_APP = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/gpx-icon.png',
  '/icons/champignons/cepe.png',
  '/icons/champignons/chanterelle.png',
  '/icons/champignons/trompette_chanterelle.png',
  '/icons/champignons/trompette_mort.png',
  '/icons/champignons/pied_mouton.png',
  '/icons/champignons/morille.png',
  '/icons/champignons/rose_des_pres.png',
  '/icons/champignons/pleurote.png',
  '/icons/champignons/bolet.png',
  '/icons/champignons/mousseron.png',
  '/icons/champignons/lactaire_amethyste.png',
  '/icons/champignons/autre.png',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'
];

// Installation : on met en cache le "squelette" de l'application
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_APP).then(cache => cache.addAll(FICHIERS_APP))
  );
  self.skipWaiting();
});

// Activation : on nettoie les anciens caches si la version change
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(cles =>
      Promise.all(
        cles
          .filter(cle => cle !== CACHE_APP && cle !== CACHE_TUILES)
          .map(cle => caches.delete(cle))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('message', (event) => {
  if (event.data === 'vider-cache-tuiles') {
    caches.delete(CACHE_TUILES).then(() => {
      if (event.source) event.source.postMessage('cache-tuiles-vide');
    });
  }
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Cas particulier : les tuiles de carte OpenStreetMap
  if (url.includes('tile.openstreetmap.org')) {
    event.respondWith(
      caches.open(CACHE_TUILES).then(async (cache) => {
        const reponseEnCache = await cache.match(event.request);
        if (reponseEnCache) return reponseEnCache;

        try {
          const reponseReseau = await fetch(event.request);
          cache.put(event.request, reponseReseau.clone());
          return reponseReseau;
        } catch (err) {
          // Hors-ligne et tuile jamais vue : on ne peut rien afficher pour cette zone
          return new Response('', { status: 404 });
        }
      })
    );
    return;
  }

  // Requêtes API : toujours tenter le réseau, ne jamais mettre en cache
  // (les données sont gérées côté app.js avec la file d'attente locale)
  if (url.includes('/api/')) {
    return;
  }

  // Reste de l'app : cache d'abord, réseau en secours
  event.respondWith(
    caches.match(event.request).then(reponseEnCache => {
      return reponseEnCache || fetch(event.request);
    })
  );
});
