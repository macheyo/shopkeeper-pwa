// This is a test service worker
self.addEventListener("install", (event) => {
  console.log("[Test Service Worker] Install");
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("[Test Service Worker] Activate");
  return self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  console.log("[Test Service Worker] Fetch", event.request.url);
  event.respondWith(fetch(event.request));
});
