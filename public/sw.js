// Service Worker Vitrix
// Stratégie : network-first pour les pages, cache-first pour les assets statiques.
// Version bump = purge automatique des anciens caches.
const VERSION = "vitrix-v2";
const STATIC_CACHE = `${VERSION}-static`;
const RUNTIME_CACHE = `${VERSION}-runtime`;

const STATIC_ASSETS = [
  "/favicon.ico",
  "/favicon.svg",
  "/apple-icon.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => !k.startsWith(VERSION))
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // On ne cache que les GET same-origin
  if (req.method !== "GET" || url.origin !== self.location.origin) return;

  // Skip API et pages dynamiques
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/dashboard")) {
    return;
  }

  // Cache-first pour /icons, /_next/static, favicons
  if (
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/_next/static/") ||
    /\.(png|svg|ico|jpg|jpeg|webp|woff2?)$/i.test(url.pathname)
  ) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req).then((res) => {
            const clone = res.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(req, clone));
            return res;
          })
      )
    );
    return;
  }

  // Network-first pour tout le reste (avec fallback cache si offline)
  event.respondWith(
    fetch(req)
      .then((res) => {
        const clone = res.clone();
        caches.open(RUNTIME_CACHE).then((cache) => cache.put(req, clone));
        return res;
      })
      .catch(() => caches.match(req).then((cached) => cached || new Response("Offline", { status: 503 })))
  );
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    event.waitUntil(
      self.registration.showNotification(data.title || "Vitrix", {
        body: data.body || "",
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        data: data.data || {},
      })
    );
  } catch {
    // payload non-JSON : ignore
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/dashboard";
  event.waitUntil(self.clients.openWindow(url));
});
