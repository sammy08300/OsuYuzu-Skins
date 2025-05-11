// Service Worker pour OsuYuzu-Skins
// Version du cache - à incrémenter lors des mises à jour importantes
const CACHE_VERSION = 'osuyuzu-v1';

// Ressources à mettre en cache lors de l'installation
const STATIC_CACHE = `${CACHE_VERSION}-static`;
// Cache séparé pour les données JSON (qui changent plus fréquemment)
const DATA_CACHE = `${CACHE_VERSION}-data`;
// Cache pour les images (durée de vie moyenne)
const IMAGE_CACHE = `${CACHE_VERSION}-images`;

// Ressources statiques à mettre en cache immédiatement
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/app.js',
  '/js/service-worker.js',
  '/favicon.svg',
  '/logo.svg'
];

// Installation du service worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('Mise en cache des ressources statiques');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activation et nettoyage des anciens caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(cacheName => {
            // Supprimer les anciens caches qui ne correspondent pas à la version actuelle
            return cacheName.startsWith('osuyuzu-') && 
                  !cacheName.startsWith(CACHE_VERSION);
          })
          .map(cacheName => {
            console.log('Suppression de l\'ancien cache:', cacheName);
            return caches.delete(cacheName);
          })
      );
    })
    .then(() => self.clients.claim())
  );
});

// Fonction pour notifier tous les clients d'une mise à jour
async function notifyClientsOfUpdate(message = 'updateAvailable') {
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage(message);
  });
}

// Stratégie de mise en cache et de récupération des ressources
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Gestion spéciale pour les fichiers JSON qui contiennent les données principales
  if (url.pathname.endsWith('.json')) {
    event.respondWith(handleDataRequest(event.request));
    return;
  }
  
  // Gestion des images (avec une stratégie cache-first mais vérification en arrière-plan)
  if (url.pathname.includes('/img/') || event.request.url.match(/\.(jpe?g|png|gif|svg|webp|avif)$/i)) {
    event.respondWith(handleImageRequest(event.request));
    return;
  }
  
  // Stratégie par défaut pour les autres ressources (cache-first)
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }
        
        return fetch(event.request)
          .then(response => {
            // Ne pas mettre en cache les erreurs
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Mettre en cache une copie de la réponse
            const responseToCache = response.clone();
            caches.open(STATIC_CACHE)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
              
            return response;
          })
          .catch(error => {
            console.error('Erreur lors de la récupération de la ressource:', error);
            // Comportement de secours pour les pages HTML en cas d'erreur réseau
            if (event.request.headers.get('Accept').includes('text/html')) {
              return caches.match('/index.html');
            }
            
            throw error;
          });
      })
  );
});

// Gestion spécifique des requêtes de données JSON
async function handleDataRequest(request) {
  try {
    // Vérifier les métadonnées du fichier pour détecter les changements
    const metaResponse = await fetch(request.url, { 
      method: 'HEAD',
      cache: 'no-cache' // Pour obtenir les en-têtes les plus récents
    });
    
    const lastModified = metaResponse.headers.get('Last-Modified');
    const etag = metaResponse.headers.get('ETag');
    const fileIdentifier = etag || lastModified;
    
    // Récupérer les informations de cache actuelles
    const cache = await caches.open(DATA_CACHE);
    const cachedResponse = await cache.match(request);
    
    // Si nous avons une réponse en cache, vérifier si elle est à jour
    if (cachedResponse) {
      const cachedLastModified = cachedResponse.headers.get('Last-Modified');
      const cachedEtag = cachedResponse.headers.get('ETag');
      const cachedIdentifier = cachedEtag || cachedLastModified;
      
      // Si l'identifiant a changé, récupérer les nouvelles données
      if (fileIdentifier !== cachedIdentifier) {
        // Récupérer les nouvelles données
        const freshResponse = await fetch(request, { cache: 'no-store' });
        
        // Mettre à jour le cache et notifier les clients
        if (freshResponse && freshResponse.status === 200) {
          await cache.put(request, freshResponse.clone());
          // Notifier les clients qu'une mise à jour est disponible
          notifyClientsOfUpdate('dataUpdated');
          return freshResponse;
        }
      }
      
      // Utiliser la version en cache si elle est toujours à jour
      return cachedResponse;
    }
    
    // Si pas de cache, récupérer les données fraîches
    const response = await fetch(request, { cache: 'no-store' });
    
    if (response && response.status === 200) {
      await cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.log('Erreur lors de la vérification/récupération des données JSON:', error);
    
    // En cas d'erreur réseau, essayer d'utiliser le cache
    const cache = await caches.open(DATA_CACHE);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Si pas de cache disponible, propager l'erreur
    throw error;
  }
}

// Mécanisme de synchronisation périodique des données
self.addEventListener('message', async (event) => {
  // Si le client demande une vérification de mise à jour des données
  if (event.data && event.data.action === 'checkForUpdates') {
    try {
      // URL du fichier JSON principal
      const jsonUrl = new URL('/data/yuzuctus_osu_skins.json', self.location.origin);
      const request = new Request(jsonUrl.toString());
      
      // Vérifier si des mises à jour sont disponibles
      const metaResponse = await fetch(request, { 
        method: 'HEAD',
        cache: 'no-cache'
      });
      
      const lastModified = metaResponse.headers.get('Last-Modified');
      const etag = metaResponse.headers.get('ETag');
      const fileIdentifier = etag || lastModified;
      
      // Récupérer les informations de cache actuelles
      const cache = await caches.open(DATA_CACHE);
      const cachedResponse = await cache.match(request);
      
      if (cachedResponse) {
        const cachedLastModified = cachedResponse.headers.get('Last-Modified');
        const cachedEtag = cachedResponse.headers.get('ETag');
        const cachedIdentifier = cachedEtag || cachedLastModified;
        
        // Si l'identifiant a changé, notifier les clients
        if (fileIdentifier !== cachedIdentifier) {
          // Récupérer et mettre en cache les nouvelles données
          const freshResponse = await fetch(request, { cache: 'no-store' });
          
          if (freshResponse && freshResponse.status === 200) {
            await cache.put(request, freshResponse.clone());
            // Notifier qu'une mise à jour est disponible
            event.source.postMessage('updateAvailable');
          }
        } else {
          // Aucune mise à jour disponible
          event.source.postMessage('noUpdateAvailable');
        }
      } else {
        // Pas de cache existant, récupérer et mettre en cache les données
        const response = await fetch(request, { cache: 'no-store' });
        
        if (response && response.status === 200) {
          await cache.put(request, response.clone());
          event.source.postMessage('initialDataCached');
        }
      }
    } catch (error) {
      console.error('Erreur lors de la vérification des mises à jour:', error);
      // Informer le client de l'erreur
      event.source.postMessage('updateCheckError');
    }
  }
});

// Gestion spécifique des requêtes d'images
async function handleImageRequest(request) {
  // D'abord essayer le cache
  const cachedResponse = await caches.match(request);
  
  // Si aucune mise à jour n'a été vérifiée récemment, vérifier les mises à jour
  if (cachedResponse) {
    // Vérifier en arrière-plan s'il y a une mise à jour de l'image
    // sans bloquer la réponse immédiate
    updateImageCache(request);
    return cachedResponse;
  }
  
  // Si pas en cache, récupérer depuis le réseau et mettre en cache
  try {
    const response = await fetch(request);
    
    if (!response || response.status !== 200) {
      throw new Error('Erreur de récupération d\'image');
    }
    
    // Mise en cache de l'image pour les prochaines utilisations
    const responseToCache = response.clone();
    const cache = await caches.open(IMAGE_CACHE);
    await cache.put(request, responseToCache);
    
    return response;
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'image:', error);
    
    // Si on a une réponse en cache malgré tout, l'utiliser
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Si pas d'image disponible, renvoyer une image de remplacement
    // ou propager l'erreur
    throw error;
  }
}

// Mise à jour du cache d'images en arrière-plan
async function updateImageCache(request) {
  try {
    const cache = await caches.open(IMAGE_CACHE);
    const cachedResponse = await cache.match(request);
    
    // Si l'image est en cache, vérifier si une mise à jour est nécessaire
    if (cachedResponse) {
      // Vérifier les métadonnées de l'image pour voir si elle a changé
      const metaResponse = await fetch(request.url, {
        method: 'HEAD',
        cache: 'no-cache'
      });
      
      const lastModified = metaResponse.headers.get('Last-Modified');
      const etag = metaResponse.headers.get('ETag');
      
      // Si nous avons des informations d'en-tête valides, comparer avec le cache
      if (lastModified || etag) {
        const cachedLastModified = cachedResponse.headers.get('Last-Modified');
        const cachedEtag = cachedResponse.headers.get('ETag');
        
        // Si les en-têtes ont changé, mettre à jour l'image
        if ((lastModified && lastModified !== cachedLastModified) || 
            (etag && etag !== cachedEtag)) {
          
          const freshResponse = await fetch(request.url, { cache: 'no-store' });
          
          if (freshResponse && freshResponse.status === 200) {
            await cache.put(request, freshResponse);
          }
        }
      } else {
        // Si pas d'en-têtes valides, utiliser un paramètre anti-cache
        const url = new URL(request.url);
        url.searchParams.set('_cache_buster', Date.now());
        
        const freshResponse = await fetch(url.toString(), { cache: 'no-store' });
        
        if (freshResponse && freshResponse.status === 200) {
          await cache.put(request, freshResponse);
        }
      }
    }
  } catch (error) {
    console.log('Erreur lors de la mise à jour du cache d\'images:', error);
    // Ne pas faire échouer l'opération, c'est une mise à jour en arrière-plan
  }
} 