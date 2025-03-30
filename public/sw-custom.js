// Custom service worker for PWA
const CACHE_NAME = "shopkeeper-pwa-v1";

// Assets to cache
const urlsToCache = [
  "/",
  "/offline.html",
  "/manifest.json",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  "/icons/ios/152.png",
  "/icons/ios/167.png",
  "/icons/ios/180.png",
];

// Install event - cache assets
self.addEventListener("install", (event) => {
  console.log("[Service Worker] Install");
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[Service Worker] Caching all: app shell and content");
      return cache.addAll(urlsToCache);
    })
  );
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  console.log("[Service Worker] Activate");
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("[Service Worker] Removing old cache", key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Fetch event - serve from cache or network
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Cache hit - return response
      if (response) {
        return response;
      }

      // Clone the request
      const fetchRequest = event.request.clone();

      return fetch(fetchRequest)
        .then((response) => {
          // Check if valid response
          if (
            !response ||
            response.status !== 200 ||
            response.type !== "basic"
          ) {
            return response;
          }

          // Clone the response
          const responseToCache = response.clone();

          caches.open(CACHE_NAME).then((cache) => {
            // Don't cache auth requests or problematic paths
            if (!event.request.url.includes("/_next/app-build-manifest.json")) {
              cache.put(event.request, responseToCache);
            }
          });

          return response;
        })
        .catch(() => {
          // If fetch fails, return the offline page for navigate requests
          if (event.request.mode === "navigate") {
            return caches.match("/offline.html");
          }
        });
    })
  );
});
