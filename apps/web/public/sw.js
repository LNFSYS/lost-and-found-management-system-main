const CACHE_VERSION = "lnfs-pwa-v1";
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const PUBLIC_API_CACHE = `${CACHE_VERSION}-public-api`;
const SHELL_ASSETS = ["/", "/home", "/posts", "/my-posts", "/manifest.webmanifest", "/icons/lnfs-icon.svg"];

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isMutation(request) {
  return !["GET", "HEAD"].includes(request.method);
}

function isPrivateApi(url) {
  return url.pathname.startsWith("/api/auth") ||
    url.pathname.includes("/media/") ||
    url.pathname.includes("/evidence") ||
    url.pathname.includes("/private") ||
    url.pathname.startsWith("/api/admin") ||
    url.pathname.startsWith("/api/staff");
}

function hasAuthorization(request) {
  return request.headers.has("authorization");
}

function isPublicBoardApi(url) {
  return url.pathname === "/api/posts" ||
    url.pathname === "/api/posts/catalog" ||
    /^\/api\/posts\/[^/]+$/.test(url.pathname);
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(SHELL_CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

async function networkFirstPublicApi(request) {
  const cache = await caches.open(PUBLIC_API_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (!cached) throw new Error("offline");
    const headers = new Headers(cached.headers);
    headers.set("x-lnfs-cache", "stale");
    return new Response(cached.body, { status: cached.status, statusText: cached.statusText, headers });
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((key) => !key.startsWith(CACHE_VERSION)).map((key) => caches.delete(key))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (!isSameOrigin(url) || isMutation(request) || isPrivateApi(url)) return;
  if (isPublicBoardApi(url)) {
    if (hasAuthorization(request)) return;
    event.respondWith(networkFirstPublicApi(request));
    return;
  }
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/home").then((cached) => cached || caches.match("/"))));
    return;
  }
  if (["script", "style", "image", "font", "manifest"].includes(request.destination)) {
    event.respondWith(cacheFirst(request));
  }
});
