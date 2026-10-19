/* Increment this version whenever the app shell changes. A waiting worker is
 * activated when all existing folio windows close, or after an explicit message.
 * The editor is never reloaded or interrupted by this worker. */
const CACHE_NAME = "folio-shell-v3";
const SCOPE = self.registration.scope;
const SHELL_FILES = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./editor.js",
  "./editor.css",
  "./store.js",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./assets/kyoto.jpg",
];
const SHELL_URLS = new Set(
  SHELL_FILES.map((path) => new URL(path, SCOPE).href),
);
const INDEX_URL = new URL("./index.html", SCOPE).href;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        cache.addAll(
          SHELL_FILES.map(
            (path) => new Request(new URL(path, SCOPE), { cache: "reload" }),
          ),
        ),
      ),
  );
  // Deliberately no skipWaiting(): open notes keep their current app version.
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter(
            (name) => name.startsWith("folio-shell-") && name !== CACHE_NAME,
          )
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate" && url.href.startsWith(SCOPE)) {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          if (response.ok) return response;
        } catch (_) {
          /* Use the installed shell while offline. */
        }
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match(INDEX_URL)) || Response.error();
      })(),
    );
    return;
  }

  // Only known application files enter this cache. User images and note data
  // are deliberately excluded; IndexedDB is managed by the app itself.
  url.search = "";
  url.hash = "";
  if (!SHELL_URLS.has(url.href)) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(url.href);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok && response.type === "basic")
        await cache.put(url.href, response.clone());
      return response;
    })(),
  );
});
