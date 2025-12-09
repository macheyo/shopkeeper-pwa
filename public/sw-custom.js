// Custom service worker for PWA
const CACHE_NAME = "shopkeeper-pwa-v3";

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
  const url = new URL(event.request.url);
  const swUrl = new URL(self.location.href);

  // Skip service worker for requests to different origins (different host OR port)
  // This handles CouchDB on :5984, other services on :8080, etc.
  if (url.origin !== swUrl.origin) {
    // Don't intercept - let the request pass through to network
    return;
  }

  // Skip service worker for CouchDB proxy requests
  if (url.pathname.startsWith("/api/couchdb-proxy")) {
    // Don't intercept - let API requests pass through
    return;
  }

  // Skip service worker for all API routes (they shouldn't be cached)
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  // Only handle same-origin requests (our app assets)
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
            // Don't cache auth requests, problematic paths, or non-GET requests
            if (
              !event.request.url.includes("/_next/app-build-manifest.json") &&
              event.request.method === "GET"
            ) {
              cache.put(event.request, responseToCache);
            }
          });

          return response;
        })
        .catch((error) => {
          console.log(
            "[Service Worker] Fetch failed:",
            event.request.url,
            error.message
          );
          // If fetch fails, return the offline page for navigate requests
          if (event.request.mode === "navigate") {
            return caches.match("/offline.html");
          }
          // For non-navigate requests, return a simple error response instead of throwing
          // This prevents unhandled promise rejections
          return new Response(
            JSON.stringify({ error: "Network request failed" }),
            {
              status: 503,
              statusText: "Service Unavailable",
              headers: { "Content-Type": "application/json" },
            }
          );
        });
    })
  );
});
