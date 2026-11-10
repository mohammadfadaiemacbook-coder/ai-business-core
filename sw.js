"use strict";
const CACHE_NAME = "ai-business-core-shell-v22";
const APP_SHELL = ["./","./index.html","./styles.css","./app.js","./manifest.webmanifest","./icons/icon.svg","./icons/icon-maskable.svg","./icons/icon-192.png","./icons/icon-512.png"];

function cacheNetworkResponse(key, response) {
  return caches.open(CACHE_NAME)
    .then(cache => cache.put(key, response.clone()))
    .catch(() => undefined)
    .then(() => response);
}

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).catch(error => { console.warn("PWA shell cache failed; keeping the app online", error); }));
});

self.addEventListener("message", event => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith("ai-business-core-shell-") && key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(response => response && response.ok ? cacheNetworkResponse("./index.html", response) : response)
        .catch(() => caches.match("./index.html").then(cached => cached || new Response("آفلاین هستید و نسخه ذخیره‌شده این صفحه در دسترس نیست.", { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } })).catch(() => new Response("Offline", { status: 503 })))
    );
    return;
  }
  const path = new URL(request.url).pathname;
  const networkFirst = /\/(app\.js|styles\.css|manifest\.webmanifest)$/.test(path);
  if (networkFirst) {
    event.respondWith(
      fetch(request)
        .then(response => response && response.ok ? cacheNetworkResponse(request, response) : response)
        .catch(() => caches.match(request).then(cached => cached || new Response("آفلاین هستید؛ فایل برنامه در حافظه موجود نیست.", { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } })).catch(() => new Response("Offline", { status: 503 })))
    );
    return;
  }
  event.respondWith(
    caches.match(request).catch(() => null).then(cached => cached || fetch(request).then(response => response && response.ok ? cacheNetworkResponse(request, response) : response))
  );
});
